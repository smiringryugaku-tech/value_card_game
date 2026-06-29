import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export type AnalysisStepData = {
  analysis: string;
  valueTypeAlphabet: string;
  typeLabel: string;
  valueTypeScores: number[];
  finalHandCardIds: number[];
  finalHandCardNames: string[];
  playerName: string;
  dateText: string;
};

export type AnalyzeResponse =
  | { fromCache: true; imageUrl: string; imagePath: string }
  | { fromCache: false; stepData: AnalysisStepData };

export type BuildSheetResponse = {
  imageUrl: string;
  imagePath: string;
  result: { analysis: string };
};

export async function analyzeWithGemini(
  roomId: string,
  playerId: string
): Promise<AnalyzeResponse> {
  const fn = httpsCallable<{ roomId: string; playerId: string }, AnalyzeResponse>(
    functions,
    "analyzeWithGemini"
  );
  const res = await fn({ roomId, playerId });
  return res.data;
}

export async function buildValueSheet(
  roomId: string,
  playerId: string,
  stepData: AnalysisStepData
): Promise<BuildSheetResponse> {
  const fn = httpsCallable<
    { roomId: string; playerId: string; stepData: AnalysisStepData },
    BuildSheetResponse
  >(functions, "buildValueSheet");
  const res = await fn({ roomId, playerId, stepData });
  return res.data;
}
