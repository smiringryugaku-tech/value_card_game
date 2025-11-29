import { ComposeSpec } from "../imageComposer";

export function makeValueSheetSpec(params: {
  playerName: string;
  dateText: string;      // "2025.11.27"
  analysisText: string;  // すでに \n 入り
}): ComposeSpec {
  const W = 1352;
  const H = 2402;

  return {
    templateGsPath: "assets/templates/value_sheet_base.png",
    output: { format: "png" },
    layers: [
      // 名前 + 日付（1行で中央寄せが一番崩れにくい）
      {
        type: "text",
        text: `${params.playerName}    ${params.dateText}`,
        left: 0,
        top: 351,
        width: W,
        height: 90,
        fontSize: 56,
        align: "center",
        fill: "#4a2f16",
        stroke: "#ffffff",
        strokeWidth: 10,
        fontWeight: 800,
      },

      // 雲の中の分析文（中央寄せが見た目良い）
      {
        type: "text",
        text: params.analysisText,
        left: 320,
        top: 877,
        width: 710,
        height: 581,
        fontSize: 40,
        lineHeight: 1.35,
        align: "center",
        fill: "#3a2a1a",
        stroke: "#ffffff",
        strokeWidth: 8,
        fontWeight: 700,
      },
    ],
  };
}
