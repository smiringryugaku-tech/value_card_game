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

import { computeAxisScores } from "./valueAxisScoring";
import { cardDict } from "./utils/cardInfo";

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

  const bucket = getStorage().bucket("personal-value-card-game.appspot.com");
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

// ステップ1: Gemini AI分析 + 軸スコア計算
export const analyzeWithGemini = onCall({
  secrets: [GEMINI_API_KEY],
  memory: "512MiB",
  timeoutSeconds: 60,
  concurrency: 1,
  maxInstances: 6,
}, async (req) => {
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
      return { fromCache: true, imageUrl: cached.url, imagePath: cached.path };
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
    const dateText = joinedAtISO.slice(0, 10);

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

    const apiKey = process.env.GEMINI_API_KEY_EMU || GEMINI_API_KEY.value();
    if (!apiKey) throw new HttpsError("failed-precondition", "GEMINI_API_KEY missing");

    const result = await runGeminiAnalysis(apiKey, playerName, finalHandCardIds, discardScores);

    const axisRes = computeAxisScores(
      { finalHandCardIds, discardScores },
      { alpha: 0.35, compress: "log1p", excludeFinalFromDiscard: true, confidenceTargetAbs: 60 }
    );

    const valueTypeScores = (["CL", "CS", "UN", "IT"] as const).map(
      (ax) => 100 - axisRes[ax].score100
    );
    const [CL, CS, UN, IT] = valueTypeScores;
    const valueTypeAlphabet = `${CL >= 50 ? "L" : "C"}${CS >= 50 ? "S" : "C"}${UN >= 50 ? "N" : "U"}${IT >= 50 ? "T" : "I"}`;

    const typeNames: Record<string, string> = {
      CCUI: "アントレプレナー", CCUT: "リーダー",
      CCNI: "リサーチャー",    CCNT: "パイオニア",
      CSUI: "ストラテジスト",  CSUT: "マネージャー",
      CSNI: "スペシャリスト",  CSNT: "ワーカー",
      LCUI: "アーティスト",    LCUT: "インフルエンサー",
      LCNI: "バックパッカー",  LCNT: "エクスプローラー",
      LSUI: "ソロツアラー",    LSUT: "プロデューサー",
      LSNI: "ヒーラー",        LSNT: "ゲスト",
    };
    const typeGroups: Record<string, string> = {
      CC: "開拓タイプ", CS: "堅実タイプ", LC: "変革タイプ", LS: "満喫タイプ",
    };
    const typeName = typeNames[valueTypeAlphabet] ?? "留学タイプ";
    const typeGroup = typeGroups[valueTypeAlphabet.slice(0, 2)] ?? "";
    const typeLabel = `${typeGroup}\n${typeName}`;

    const finalHandCardNames = finalHandCardIds.map(
      (id) => cardDict[id]?.japanese ?? `カード ${id}`
    );

    return {
      fromCache: false,
      stepData: {
        analysis: result.analysis,
        valueTypeAlphabet,
        typeLabel,
        valueTypeScores,
        finalHandCardIds,
        finalHandCardNames,
        playerName,
        dateText,
      },
    };
  } catch (err: any) {
    logger.error("analyzeWithGemini failed", err);
    if (err?.code && err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err?.message ?? "Unknown error");
  }
});

// ステップ2: 画像生成・アップロード
export const buildValueSheet = onCall({
  memory: "1GiB",
  timeoutSeconds: 60,
  concurrency: 1,
  maxInstances: 6,
}, async (req) => {
  try {
    const { roomId, playerId, stepData } = req.data ?? {};
    if (!roomId || !playerId || !stepData) {
      throw new HttpsError("invalid-argument", "roomId, playerId, stepData are required");
    }

    const {
      analysis,
      valueTypeAlphabet,
      typeLabel,
      valueTypeScores,
      finalHandCardIds,
      finalHandCardNames,
      playerName,
      dateText,
    } = stepData;

    const TEMPLATE_PATH = "assets/templates/value_sheet_base_temp.png";
    const W = 1350;
    const H = 2400;

    const spec = makeValueSheetSpec({
      templatePath: TEMPLATE_PATH,
      playerName,
      dateText,
      finalHandCardIds,
      analysisText: analysis,
      finalHandCardNames,
      valueType: [valueTypeAlphabet, typeLabel],
      valueTypeScores,
      canvasWidth: W,
      canvasHeight: H,
    });

    const outBuf = await composeImage(spec);

    const bucket = getStorage().bucket();
    const outPath = `generated/valueSheets/${roomId}/${playerId}/your_value_${Date.now()}.png`;
    const file = bucket.file(outPath);
    await file.save(outBuf, { contentType: "image/png", resumable: false });

    const url = await getDownloadURL(file);

    return { imageUrl: url, imagePath: outPath, result: { analysis } };
  } catch (err: any) {
    logger.error("buildValueSheet failed", err);
    if (err?.code && err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err?.message ?? "Unknown error");
  }
});
