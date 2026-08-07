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

export type DownloadUrlResponse = { url: string };

// バックエンドの全アクションは単一のCloud Function(api)に集約されている。
// コンテナが1つにまとまることで、warmupのポーリングが他アクションのウォームアップとしても機能する。
const apiFn = httpsCallable<{ action: string; [key: string]: unknown }, unknown>(
  functions,
  "api"
);

async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await apiFn({ action, ...payload });
  return res.data as T;
}

export async function analyzeWithGemini(
  roomId: string,
  playerId: string
): Promise<AnalyzeResponse> {
  return callApi<AnalyzeResponse>("analyzeWithGemini", { roomId, playerId });
}

export async function buildValueSheet(
  roomId: string,
  playerId: string,
  stepData: AnalysisStepData
): Promise<BuildSheetResponse> {
  return callApi<BuildSheetResponse>("buildValueSheet", { roomId, playerId, stepData });
}

export async function getValueSheetDownloadUrl(
  imagePath: string,
  filename?: string
): Promise<DownloadUrlResponse> {
  return callApi<DownloadUrlResponse>("getValueSheetDownloadUrl", { imagePath, filename });
}

export async function warmupBackend(): Promise<void> {
  try {
    await callApi("warmup");
  } catch (e) {
    console.warn("[Warmup] failed to ping backend:", e);
  }
}
