import { ComposeSpec } from "../imageComposer";

export function makeValueSheetSpec(params: {
  playerName: string;
  dateText: string;
  analysisText: string; // すでに \n 入り想定
}): ComposeSpec {
  return {
    templateGsPath: "assets/templates/value_sheet_base.png",
    output: { format: "png" },
    layers: [
      {
        type: "text",
        text: params.playerName,
        left: 80, top: 90,
        width: 900, height: 120,
        fontSize: 64,
        align: "left",
        fill: "#111",
        stroke: "#ffffff",
        strokeWidth: 6,
      },
      {
        type: "text",
        text: params.dateText,
        left: 80, top: 175,
        width: 900, height: 60,
        fontSize: 32,
        fill: "#333",
      },
      {
        type: "text",
        text: params.analysisText,
        left: 80, top: 280,
        width: 920, height: 520,
        fontSize: 34,
        lineHeight: 1.35,
        fill: "#111",
      },

      // 例: バッジ画像
      // { type: "image", gsPath: "assets/badges/star.png", left: 930, top: 70, width: 120, height: 120, fit: "contain" },
    ],
  };
}
