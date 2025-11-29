import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { cardDict } from "./utils/cardInfo";
import { geminiPrompt } from "./utils/prompts";

// 返してほしいJSONの“形”をここで固定（あなたのプロンプトもこの形に合わせる）
export const analysisResultSchema = z.object({
  analysis: z.string().describe("ユーザーの価値観を分析した説明文（3-5文）"),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export async function runGeminiAnalysis(
  apiKey: string,
  playerName: string,
  finalCardsId: number[],
  scoreDiscardLogs: Array<{ cardId: number; score: number }>
): Promise<AnalysisResult> {

  const ai = new GoogleGenAI({ apiKey });

  const finalHandCards = finalCardsId.map(
    (id) => {
      const c = cardDict[id];
      return c ? `${cardDict[id].japanese} (${cardDict[id].english})` : `カード ${id}`;
    }
  );

  const discardScores = scoreDiscardLogs.map(
    ({cardId, score}) => {
      const c = cardDict[cardId];
      return {card: c ? `${c.japanese} (${c.english})` : `カード ${cardId}`, score};
    }
  );

  const userData = {
    playerName: playerName,
    finalHandCards: finalHandCards,
    discardScores: discardScores,
  };

  const prompt = [
    geminiPrompt,
    "",
    "# INPUT_DATA(JSON)",
    JSON.stringify(userData, null, 2),
  ].join("\n");

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: zodToJsonSchema(analysisResultSchema),
      temperature: 0.2,
    },
  });
  
  const text = resp.text;
  if (!text) {
    console.error("Gemini empty response. candidates:", (resp as any).candidates);
    console.error("Gemini empty response. raw:", JSON.stringify(resp, null, 2));
    throw new Error("Gemini response.text is empty (no candidates or auth/config issue).");
  }

  const raw = JSON.parse(text);
  return analysisResultSchema.parse(raw);
}
