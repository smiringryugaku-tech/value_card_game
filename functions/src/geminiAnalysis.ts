import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { cardDict } from "./utils/cardInfo";
import { geminiPrompt } from "./utils/prompts";
import kuromoji from "kuromoji";

// 返してほしいJSONの“形”をここで固定（あなたのプロンプトもこの形に合わせる）
export const analysisResultSchema = z.object({
  analysis: z.string().describe("ユーザーの価値観を分析した説明文（3-5文）"),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

const MAX_WIDTH = 33; // 1行の最大文字数（全角換算イメージ）
const MIN_WIDTH = 25; // なるべくここまでは埋めたい
let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;

function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji
        .builder({
          // Cloud Functions でも動くように node_modules 内の辞書を指定
          dicPath: "node_modules/kuromoji/dict",
        })
        .build((err, tokenizer) => {
          if (err) return reject(err);
          resolve(tokenizer);
        });
    });
  }
  return tokenizerPromise;
}

export async function formatJapaneseAnalysis(text: string): Promise<string> {
  const tokenizer = await getTokenizer();

  const tokens = tokenizer.tokenize(text); // 日本語を単語・記号に分割
  const lines: string[] = [];

  let currentLine = "";

  for (const token of tokens) {
    const part = token.surface_form;

    // 次のトークンを足したら MAX を超えるかチェック
    if (currentLine.length + part.length > MAX_WIDTH) {
      if (currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = part; // 新しい行をこのトークンで開始
      } else {
        // 1語だけで25文字を超えるような極端なケース
        lines.push(part);
        currentLine = "";
      }
      continue;
    }

    // まだ MAX 以内なら普通に足す
    currentLine += part;

    const isPunctuation = /[。、！!？?]/.test(part);

    // 「ある程度の長さ」かつ「句読点」で行を切る
    if (currentLine.length >= MIN_WIDTH && isPunctuation) {
      lines.push(currentLine);
      currentLine = "";
    }
  }

  // 残りがあれば最後の行として追加
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // 行ごとに改行を入れて返す
  return lines.join("\n");
}

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

  const raw = analysisResultSchema.parse(JSON.parse(text));
  const formattedAnalysis = await formatJapaneseAnalysis(raw.analysis);

  return {
    ...raw,
    analysis: formattedAnalysis,
  };
}
