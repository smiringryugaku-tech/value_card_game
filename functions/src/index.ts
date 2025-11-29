import "dotenv/config";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage, getDownloadURL } from "firebase-admin/storage";

import { scoreDiscardLogsSorted, DiscardLogEntry } from "./scoreDiscardLogs";
import { runGeminiAnalysis } from "./geminiAnalysis";
import { composeImage } from "./imageComposer";
import { makeValueSheetSpec } from "./layout/valueSheetLayout";

initializeApp();
const db = getFirestore();
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

function toISODateTime(v: any): string {
  if (!v) return new Date().toISOString();
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v?.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

async function findRecentValueSheet(params: {
  roomId: string;
  playerId: string;
  withinMs: number;
}): Promise<{ url: string; path: string; ageMs: number } | null> {
  const { roomId, playerId, withinMs } = params;

  const bucket = getStorage().bucket();
  const prefix = `generated/valueSheets/${roomId}/${playerId}/`;

  // 取り急ぎ最大50件くらい見れば十分（増えすぎ防止）
  const [files] = await bucket.getFiles({ prefix, maxResults: 50 });

  // your_value_XXXXXXXXXXXXX.png だけ拾う
  const candidates = files
    .map((f) => f.name)
    .map((name) => {
      const m = name.match(/\/your_value_(\d+)\.png$/);
      if (!m) return null;
      const ts = Number(m[1]);
      if (!Number.isFinite(ts)) return null;
      return { name, ts };
    })
    .filter(Boolean) as Array<{ name: string; ts: number }>;

  if (candidates.length === 0) return null;

  // 一番新しいやつ
  candidates.sort((a, b) => b.ts - a.ts);
  const latest = candidates[0];

  const ageMs = Date.now() - latest.ts;
  if (ageMs < 0 || ageMs > withinMs) return null;

  const file = bucket.file(latest.name);
  const url = await getDownloadURL(file);
  return { url, path: latest.name, ageMs };
}

export const getValueSheetDownloadUrl = onCall(async (req) => {
  const { imagePath, filename } = req.data ?? {};
  if (!imagePath || typeof imagePath !== "string") {
    throw new HttpsError("invalid-argument", "imagePath (string) is required");
  }

  // 念のため：このprefix配下しか許さない（他ファイル抜かれ防止）
  if (!imagePath.startsWith("generated/valueSheets/")) {
    throw new HttpsError("permission-denied", "invalid imagePath");
  }

  const bucket = getStorage().bucket();
  const file = bucket.file(imagePath);

  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "file not found");

  const safeName =
    typeof filename === "string" && filename.trim()
      ? filename.trim().replace(/[\\/:*?"<>|]/g, "_")
      : "value_sheet.png";

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 10 * 60 * 1000, // 10分
    responseDisposition: `attachment; filename="${safeName}"`,
    responseType: "image/png",
  });

  return { url };
});

export const analyzeWithGemini = onCall({ secrets: [GEMINI_API_KEY] }, async (req) => {
  try {
    const { roomId, playerId } = req.data ?? {};
    if (!roomId || !playerId) {
      throw new HttpsError("invalid-argument", "roomId and playerId are required");
    }

    const cached = await findRecentValueSheet({
      roomId: String(roomId),
      playerId: String(playerId),
      withinMs: 60 * 60 * 1000,
    });
    
    if (cached) {
      return {
        fromCache: true,
        imageUrl: cached.url,
        imagePath: cached.path,
        ageMinutes: Math.round(cached.ageMs / 60000),
      };
    }

    const roomSnap = await db.collection("rooms").doc(String(roomId)).get();
    if (!roomSnap.exists) throw new HttpsError("not-found", "room not found");

    const room = roomSnap.data() as any;
    if (room.status !== "finished") {
      throw new HttpsError("failed-precondition", "room is not finished");
    }

    const player = room?.players?.[playerId];
    if (!player) throw new HttpsError("failed-precondition", "player not found in this room");

    const playerName = String(player.name ?? "Player");
    const joinedAtISO = toISODateTime(player.joinedAt);

    const finalHandCardIds = (room?.hands?.[playerId] ?? []).slice(0, 5);
    if (!Array.isArray(finalHandCardIds) || finalHandCardIds.length !== 5) {
      throw new HttpsError("failed-precondition", "hands[playerId] must have 5 cardIds");
    }

    const discardLogs: DiscardLogEntry[] = room?.discardLogs?.[playerId] ?? [];
    if (!Array.isArray(discardLogs)) {
      throw new HttpsError("failed-precondition", "discardLogs[playerId] must be an array");
    }

    const scoreMap = scoreDiscardLogsSorted(discardLogs, { combine: "last" });
    const discardScores = Array.from(scoreMap.entries()).map(([cardId, score]) => ({ cardId, score }));

    const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY.value();
    if (!apiKey) throw new HttpsError("failed-precondition", "GEMINI_API_KEY missing");
    console.log("GEMINI_API_KEY length:", (process.env.GEMINI_API_KEY || GEMINI_API_KEY.value() || "").length);


    const result = await runGeminiAnalysis(apiKey, playerName, finalHandCardIds, discardScores);

    const analysisText = result.analysis;
    const spec = makeValueSheetSpec({
      playerName,
      dateText: joinedAtISO.slice(0, 10),
      analysisText,
    });

    const outBuf = await composeImage(spec);

    const bucket = getStorage().bucket();
    const outPath = `generated/valueSheets/${roomId}/${playerId}/your_value_${Date.now()}.png`;
    const file = bucket.file(outPath);

    await file.save(outBuf, { contentType: "image/png", resumable: false });

    // Admin SDK で “non-expiring download URL” を取れる（公式）
    const url = await getDownloadURL(file);

    return { result, imageUrl: url, imagePath: outPath };
  } catch (err: any) {
    logger.error("analyzeWithGemini failed", err);

    // すでに HttpsError ならそのまま返す
    if (err?.code && err instanceof HttpsError) throw err;

    // それ以外は INTERNAL にまとめつつ、メッセージだけは残す
    throw new HttpsError("internal", err?.message ?? "Unknown error");
  }
});
