import sharp from "sharp";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const FONT_FILE = "MPLUSRounded1c-Medium.ttf";
const FONT_SRC_PATH = path.join(__dirname, "../assets/fonts", FONT_FILE);
const FONT_FAMILY = "M PLUS Rounded 1c";
const TMP_FONT_DIR = "/tmp/custom-fonts";

// フォントを /tmp にコピーして fontconfig に登録する（プロセス起動時に1回だけ実行）
function setupFont(): void {
  try {
    const dest = path.join(TMP_FONT_DIR, FONT_FILE);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(TMP_FONT_DIR, { recursive: true });
      fs.copyFileSync(FONT_SRC_PATH, dest);
      fs.writeFileSync(
        path.join(TMP_FONT_DIR, "fonts.conf"),
        `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/custom-fonts</dir>
</fontconfig>`
      );
      execSync("fc-cache -f /tmp/custom-fonts", { stdio: "pipe" });
    }
    process.env.FONTCONFIG_PATH = TMP_FONT_DIR;
  } catch (e) {
    console.warn("[imageComposer] font setup failed:", e);
  }
}

setupFont();

type Align = "left" | "center" | "right";

export type TextLayer = {
  type: "text";
  text: string;              // "\n" 含んでOK
  left: number;
  top: number;
  width: number;             // テキストの描画ボックス（SVGの幅）
  height: number;            // テキストの描画ボックス（SVGの高さ）
  fontSize: number;
  lineHeight?: number;       // 1.2 など
  letterSpacing?: number;
  fontFamily?: string;       // 日本語なら Noto Sans JP などを優先に並べる
  fontWeight?: number | string;
  fill?: string;             // "#111" 等
  align?: Align;
  stroke?: string;           // 文字の縁取り（可読性UP）
  strokeWidth?: number;
};

export type ImageLayer = {
  type: "image";
  gsPath: string;            // Storage path: "assets/badges/star.png" など
  left: number;
  top: number;
  width?: number;            // 指定するならリサイズして貼る
  height?: number;
  fit?: "cover" | "contain" | "fill";
  borderRadius?: number;
};

export type ComposeSpec = {
  templateGsPath: string;    // "assets/templates/value_sheet.png" 等
  layers: Array<TextLayer | ImageLayer>;
  output: { format: "png" | "jpeg"; quality?: number };
};

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildTextSvg(layer: TextLayer): Buffer {
  const {
    text,
    width,
    height,
    fontSize,
    lineHeight = 1.25,
    letterSpacing,
    fontFamily = `"${FONT_FAMILY}", sans-serif`,
    fontWeight = 600,
    fill = "#111",
    align = "left",
    stroke,
    strokeWidth = 0,
  } = layer;

  const lines = (text ?? "").split("\n").map((l) => escapeXml(l));
  const lhPx = fontSize * lineHeight;


  const x =
    align === "center" ? width / 2 :
    align === "right" ? width :
    0;

  const anchor =
    align === "center" ? "middle" :
    align === "right" ? "end" :
    "start";

  // y は “ベースライン” なので最初は fontSize くらいが扱いやすい
  const tspans = lines.map((line, i) => {
    const dy = i === 0 ? 0 : lhPx;
    return `<tspan x="${x}" dy="${dy}">${line}</tspan>`;
  }).join("");

  const strokeAttrs = stroke
    ? `stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke fill"`
    : "";

  const letterSpacingStyle =
    letterSpacing != null ? `letter-spacing: ${letterSpacing}px;` : "";

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <style>
      .t {
        font-family: ${fontFamily};
        font-size: ${fontSize}px;
        font-weight: ${fontWeight};
        fill: ${fill};
        ${letterSpacingStyle}
      }
    </style>
    <text class="t" x="${x}" y="${fontSize}" text-anchor="${anchor}" ${strokeAttrs}>
      ${tspans}
    </text>
  </svg>`.trim();

  return Buffer.from(svg);
}

async function downloadGsFile(gsPath: string): Promise<Buffer> {
  const bucket = getStorage().bucket();
  const [buf] = await bucket.file(gsPath).download();
  return buf;
}

async function applyRoundedCorners(
  img: sharp.Sharp,
  width: number,
  height: number,
  radius: number
): Promise<sharp.Sharp> {
  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" />
    </svg>
  `);
  
  return img.composite([
    {
      input: svg,
      blend: "dest-in",
    },
  ]);
}


export async function composeImage(spec: ComposeSpec): Promise<Buffer> {
  const base = await downloadGsFile(spec.templateGsPath);

  const meta = await sharp(base).metadata();
  const templateWidth = meta.width ?? 0;
  const templateHeight = meta.height ?? 0;

  let pipeline = sharp(base);

  const composites: sharp.OverlayOptions[] = [];

  for (const layer of spec.layers) {
    if (layer.type === "text") {
      const svg = buildTextSvg(layer);
      composites.push({ input: svg, left: layer.left, top: layer.top });
      continue;
    }

    // image layer
    const imgBuf = await downloadGsFile(layer.gsPath);
    let img = sharp(imgBuf);

    // ここで最終サイズを決める
    const targetWidth = layer.width;
    const targetHeight = layer.height;

    if (targetWidth || targetHeight) {
      img = img.resize(targetWidth, targetHeight, {
        fit: layer.fit ?? "contain",
      });
    }

    if (layer.borderRadius && layer.borderRadius > 0) {
      const w = targetWidth ?? (await img.metadata()).width ?? 0;
      const h = targetHeight ?? (await img.metadata()).height ?? 0;

      img = await applyRoundedCorners(img, w, h, layer.borderRadius);
    }

    const input = await img.png().toBuffer();
    composites.push({
      input,
      left: Math.round(layer.left),
      top: Math.round(layer.top),
    });
  }

  pipeline = pipeline.composite(composites);

  if (spec.output.format === "jpeg") {
    return pipeline.jpeg({ quality: spec.output.quality ?? 90 }).toBuffer();
  }
  return pipeline.png().toBuffer();
}
