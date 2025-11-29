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
        text: `${params.playerName}　${params.dateText}`,
        left: 0,
        top: 330,
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
        left: 150,
        top: 1000,
        width: 1100,
        height: 600,
        fontSize: 35,
        lineHeight: 1.5,
        align: "center",
        fill: "#3a2a1a",
        stroke: "#ffffff",
        strokeWidth: 5,
        fontWeight: 700,
      },
    ],
  };
}
