import { ComposeSpec } from "../imageComposer";

// タイプ名の枠(ピル)は幅が固定なので、文字数が多いほどフォントを小さくして収める
function typeNameFontSize(text: string): number {
  const len = [...text].length;
  if (len <= 3) return 32;
  if (len === 4) return 30;
  if (len === 5) return 28;
  if (len === 6) return 26;
  if (len === 7) return 24;
  return 22; // 8文字（今のところの最長）
}

export function makeValueSheetSpec(params: {
  templatePath: string;
  playerName: string;
  dateText: string;      // "2025.11.27"
  finalHandCardIds: Array<number>;
  finalHandCardNames: Array<string>;
  analysisText: string;  // すでに \n 入り
  valueType: Array<string>;
  valueTypeScores: Array<number>;
  canvasWidth: number,
  canvasHeight: number,
}): ComposeSpec {
  const W = params.canvasWidth;
  const H = params.canvasHeight;

  // テンプレート画像上のカード枠(角丸スロット)の実測値に合わせている
  const CARD_WIDTH = 240;
  const CARD_HEIGHT = 320;
  const CARD_TOP = 600;
  const CARD_LEFT_START = 40;
  const CARD_RADIUS = 20;
  const CARD_GAP = (W - (CARD_LEFT_START * 2 + CARD_WIDTH * 5)) / 4;
  const lines = params.analysisText.split(/\r?\n/).filter(line => line.trim() !== "");
  const lineCount = lines.length;

  const cardLayers = params.finalHandCardIds.slice(0, 5).map((cardId, index) => {
    const paddedId = cardId.toString().padStart(2, "0");
    return {
      type: "image" as const,
      gsPath: `assets/cards/ryugaku_ver/card_${paddedId}.png`,
      left: Math.round(CARD_LEFT_START + index * (CARD_WIDTH + CARD_GAP)),
      top: CARD_TOP,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      // 枠(240x320)とカード画像本体(1080x1350=4:5)のアスペクト比が違うため、
      // contain だと余白ができる。cover で枠いっぱいに敷き詰めて角丸でトリムする。
      fit: "cover" as const,
      borderRadius: CARD_RADIUS,
    };
  });

  const KNOB_LEFT_START = 315;
  const KNOB_WIDTH = 60;
  const KNOB_HEIGHT = KNOB_WIDTH;
  const KNOB_UNIT = (W - (KNOB_LEFT_START * 2) - KNOB_WIDTH) / 100;
  const KNOB_TOP = 1724;
  const KNOB_GAP = 125;

  const labels = [["目的軸", "C", "L"], ["スタンス軸", "A", "S"], ["環境軸", "U", "N"], ["行動軸", "I", "T"]];
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
      gsPath: `assets/template/silider_knobs/knob_${colors[index]}.png`,
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
        top: 1595,
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

      // 価値観タイプ：グループ+具体名の2行を、テンプレート側のピル帯の
      // 縦センター付近に来るよう2行分の高さから逆算して配置
      // (実測センターは約1634pxだが、見た目のバランスを見て少し上に寄せている)
      ...(() => {
        const PILL_CENTER_Y = 1626;
        const GROUP_FONT_SIZE = 18;
        const LINE_GAP = 8;
        const nameFontSize = typeNameFontSize(params.valueType[2]);
        const blockHeight = GROUP_FONT_SIZE + LINE_GAP + nameFontSize;
        const groupTop = Math.round(PILL_CENTER_Y - blockHeight / 2);
        const nameTop = groupTop + GROUP_FONT_SIZE + LINE_GAP;

        return [
          // グループ（開拓/堅実/変革/満喫タイプ、小さく上段）
          {
            type: "text" as const,
            text: params.valueType[1],
            left: 725,
            top: groupTop,
            width: 320,
            height: GROUP_FONT_SIZE + 10,
            fontSize: GROUP_FONT_SIZE,
            align: "center" as const,
            fill: "#38b6ff",
            stroke: "#ffffff",
            strokeWidth: 3,
            fontWeight: 600,
          },
          // 具体的なタイプ名（大きく強調して下段）
          // 枠(ピル)からはみ出さないよう、文字数が多いほどフォントサイズを落とす
          {
            type: "text" as const,
            text: params.valueType[2],
            left: 725,
            top: nameTop,
            width: 320,
            height: nameFontSize + 10,
            fontSize: nameFontSize,
            align: "center" as const,
            fill: "#38b6ff",
            stroke: "#ffffff",
            strokeWidth: 5,
            fontWeight: 800,
          },
        ];
      })(),

      ...sliderLabelLayers,

      ...knobsLayers,
    ],
  };
}
