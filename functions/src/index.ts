import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import { scoreDiscardLogsSorted, DiscardLogEntry } from "./scoreDiscardLogs";
import { runGeminiAnalysis } from "./geminiAnalysis";

import { getStorage } from "firebase-admin/storage";
import { composeImage } from "./imageComposer";
import { makeValueSheetSpec } from "./layout/valueSheetLayout";
import { getDownloadURL } from "firebase-admin/storage";

initializeApp();
const db = getFirestore();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// Firestore Timestamp / Date / string を ISO文字列に寄せる
function toISODateTime(v: any): string {
  if (!v) return new Date().toISOString();
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v?.toDate === "function") return v.toDate().toISOString(); // 念のため
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v; // すでにISO文字列など
  return new Date().toISOString();
}

export const analyzeWithGemini = onCall({ secrets: [GEMINI_API_KEY] }, async (req) => {
  // ✅ フロントからはこれだけ
  const { roomId, playerId } = req.data ?? {};
  if (!roomId || !playerId) {
    throw new HttpsError("invalid-argument", "roomId and playerId are required");
  }

  // 1) roomを取得
  const roomSnap = await db.collection("rooms").doc(String(roomId)).get();
  if (!roomSnap.exists) {
    throw new HttpsError("not-found", "room not found");
  }
  const room = roomSnap.data() as any;

  //（任意）finished 以外は弾く
  if (room.status !== "finished") {
    throw new HttpsError("failed-precondition", "room is not finished");
  }

  // 2) players / hands / discardLogs から必要情報を抜く
  const player = room?.players?.[playerId];
  if (!player) {
    throw new HttpsError("failed-precondition", "player not found in this room");
  }

  const playerName: string = String(player.name ?? "Player");
  const joinedAtISO: string = toISODateTime(player.joinedAt);

  const finalHandCardIds: number[] = room?.hands?.[playerId];
  if (!Array.isArray(finalHandCardIds) || finalHandCardIds.length !== 5) {
    throw new HttpsError("failed-precondition", "hands[playerId] must be an array of 5 cardIds");
  }

  const discardLogs: DiscardLogEntry[] = room?.discardLogs?.[playerId] ?? [];
  if (!Array.isArray(discardLogs)) {
    throw new HttpsError("failed-precondition", "discardLogs[playerId] must be an array");
  }

  // 3) 捨て札ログを点数化（重複 cardId は last）
  const scoreMap = scoreDiscardLogsSorted(discardLogs, { combine: "last" });

  // Map -> Array（Geminiに渡しやすい）
  const discardScores = Array.from(scoreMap.entries()).map(([cardId, score]) => ({
    cardId,
    score,
  }));

  // 4) Geminiへ
  const apiKey = GEMINI_API_KEY.value();

  const result = await runGeminiAnalysis(
    apiKey,
    playerName,
    finalHandCardIds,
    discardScores,
  );

  const analysisText = result.analysis; // すでに \n 入り
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

// ① 非期限URL（Admin SDKの getDownloadURL が使える場合）
const url = await getDownloadURL(file);

return { result, imageUrl: url, imagePath: outPath };
});
