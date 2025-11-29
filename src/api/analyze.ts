import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

type AnalyzeResponse = {
  imageUrl: string;
  result?: { analysis: string };
};

export async function analyzeWithGemini(roomId: string, playerId: string): Promise<AnalyzeResponse> {
  const functions = getFunctions(getApp()); // firebase/app 初期化済み前提
  const fn = httpsCallable(functions, "analyzeWithGemini");
  const res = await fn({ roomId, playerId });
  return res.data as AnalyzeResponse;
}
