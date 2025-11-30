import { ComposeSpec } from "../imageComposer";

export function makeValueSheetSpec(params: {
  templatePath: string;
  playerName: string;
  dateText: string;      // "2025.11.27"
  finalHandCardIds: Array<number>;
  analysisText: string;  // すでに \n 入り
  valueType: Array<string>;
  valueTypeScores: Array<number>;
  canvasWidth: number,
  canvasHeight: number,
}): ComposeSpec {
  const W = params.canvasWidth;
  const H = params.canvasHeight;

  const CARD_WIDTH = 228;
  const CARD_HEIGHT = 320;
  const CARD_TOP = 604;
  const CARD_LEFT_START = 47;
  const CARD_GAP = (W - (CARD_LEFT_START * 2 + CARD_WIDTH * 5)) / 4;
  const CARD_BORDER_RAD = 30;

  const lines = params.analysisText.split(/\r?\n/).filter(line => line.trim() !== "");
  const lineCount = lines.length;

  const cardLayers = params.finalHandCardIds.slice(0, 5).map((cardId, index) => {
    return {
      type: "image" as const,
      gsPath: `assets/cards/temporary/card_${String(cardId).padStart(2, "0")}.png`,
      left: Math.round(CARD_LEFT_START + index * (CARD_WIDTH + CARD_GAP)),
      top: CARD_TOP,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fit: "cover" as const,
      borderRadius: CARD_BORDER_RAD,
    };
  });

  const KNOB_LEFT_START = 315;
  const KNOB_WIDTH = 60;
  const KNOB_HEIGHT = KNOB_WIDTH;
  const KNOB_UNIT = (W - (KNOB_LEFT_START * 2) - KNOB_WIDTH) / 100;
  const KNOB_TOP = 1724;
  const KNOB_GAP = 125;

  const labels = [["リスク姿勢", "E", "S"], ["関係志向", "A", "C"], ["幸福観", "D", "W"], ["意思決定", "L", "I"]];
  const sliderLabelLayers = params.valueTypeScores.slice(0, 4).map((score, index) => {
    return {
      type: "text" as const,
      text: `${labels[index][0]}　${score > 50 ? labels[index][2] : labels[index][1]}:${score > 50 ? score : 100-score}`,
      left: 0,
      top: KNOB_TOP + index * (KNOB_GAP) - 45,
      width: W,
      height: 50,
      fontSize: 25,
      align: "center" as const,
      fill: "#000000",
      fontWeight: 700,
    };
  });

  const colors = ["red", "yellow", "green", "blue"];
  const knobsLayers = params.valueTypeScores.slice(0, 4).map((score, index) => {
    return {
      type: "image" as const,
      gsPath: `assets/templates/slider_knobs/knob_${colors[index]}.png`,
      left: Math.round(KNOB_LEFT_START + score * KNOB_UNIT),
      top: KNOB_TOP + index * (KNOB_GAP),
      fit: "cover" as const,
      width: KNOB_WIDTH,
      height: KNOB_HEIGHT,
    }
  });

  return {
    templateGsPath: params.templatePath,
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

      // 5枚のカード
      ...cardLayers,

      // 雲の中の分析文（中央寄せが見た目良い）
      {
        type: "text",
        text: params.analysisText,
        left: 0,
        top: 1050 + (10 - lineCount) * 20,
        width: W,
        height: 600,
        fontSize: 33,
        lineHeight: 1.5,
        align: "center",
        fill: "#3a2a1a",
        stroke: "#ffffff",
        strokeWidth: 5,
        fontWeight: 600,
      },

      // 4文字のアルファベット
      {
        type: "text",
        text: params.valueType[0],
        left: 0,
        top: 1597,
        width: W,
        height: 90,
        fontSize: 50,
        letterSpacing: 10,
        align: "center",
        fill: "#38b6ff",
        stroke: "#ffffff",
        strokeWidth: 5,
        fontWeight: 800,
      },

      // 価値観タイプ
      {
        type: "text",
        text: params.valueType[1],
        left: 750,
        top: 1600,
        width: 320,
        height: 90,
        fontSize: 25,
        align: "center",
        fill: "#38b6ff",
        stroke: "#ffffff",
        strokeWidth: 3,
        fontWeight: 600,
      },

      ...sliderLabelLayers,

      ...knobsLayers,
    ],
  };
}
