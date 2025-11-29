import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export type AnalyzeResponse = {
  imageUrl?: string;
  imagePath?: string;
  result?: { analysis: string };
  fromCache?: boolean;
};

export async function analyzeWithGemini(roomId: string, playerId: string): Promise<AnalyzeResponse> {
  const fn = httpsCallable<{ roomId: string; playerId: string }, AnalyzeResponse>(
    functions,
    "analyzeWithGemini"
  );
  const res = await fn({ roomId, playerId });
  return res.data;
}