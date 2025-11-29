import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { cardDict } from "../utils/cardInfo";
import { geminiPrompt } from "../utils/prompts";

// 返してほしいJSONの“形”をここで固定（あなたのプロンプトもこの形に合わせる）
export const analysisResultSchema = z.object({
  analysis: z.string().describe("ユーザーの価値観を分析した説明文（3-5文）")
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export async function runGeminiAnalysis(apiKey, playerName, finalCardsId: number[], scoreDiscardLogs: Array<{ cardId: number; score: number }>): Promise<AnalysisResult> {

  const ai = new GoogleGenAI({});

  const finalHandCards = finalCardsId.map(
    (id) => `${cardDict[id].japanese} (${cardDict[id].english})`
  );

  const discardScores = scoreDiscardLogs.map(
    ({cardId, score}) => {
      const c = cardDict[cardId];
      return {card: `${c.japanese} (${c.english})`, score};
    }
  );

  const userData = {
    playerName: playerName,
    finalHandCards: finalHandCards,
    discardScores: discardScores,
  };

  const contents = [
    geminiPrompt,
    "\n\n# INPUT_DATA(JSON)\n" + JSON.stringify(userData),
  ].join("\n");

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(analysisResultSchema),
      // ここはお好み：温度低めの方がJSON崩れにくい
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  });

  const text = resp.text;
  if (!text) throw new Error("Gemini response.text is empty");
  const raw = JSON.parse(text);
  return analysisResultSchema.parse(raw);
}
