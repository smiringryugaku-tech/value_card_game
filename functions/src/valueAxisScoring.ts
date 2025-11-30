import { cardDict } from "./utils/cardInfo";

export type Axis = "ES" | "AC" | "DW" | "LI";
export type Pole = "E" | "S" | "A" | "C" | "D" | "W" | "L" | "I";

export type CardAxisScore = { axis: Axis; pole: Pole; score: number };
export type CardInfo = {
  japanese: string;
  english: string;
  axisScores: CardAxisScore[];
};

export type DiscardScore = { cardId: number; score: number };

export type AxisResult = {
  axis: Axis;
  /** 0..100. 100 = left pole (E/A/D/L) side, 0 = right pole (S/C/W/I) side */
  score100: number;
  /** -1..+1 (signed leaning). + means left pole, - means right pole */
  ratio: number;
  /** 0..1 confidence proxy based on how much evidence exists on this axis */
  confidence: number;
  /** Debug info */
  debug: {
    baseAxis: number;
    baseAbs: number;
    auxAxis: number;
    auxAbs: number;
    totalAxis: number;
    totalAbs: number;
  };
};

export type AxisScoresOutput = Record<Axis, AxisResult>;

export type ComputeAxisScoresOptions = {
  /** How much to trust discard evidence relative to final hand (0..1). Default 0.35 */
  alpha?: number;
  /** compress discard scores. Default "log1p" */
  compress?: "log1p" | "sqrt" | ((x: number) => number);
  /** Scale factor for auxiliary component. Default "baseAbs" (per axis) */
  K?: "baseAbs" | number | ((ctx: { axis: Axis; baseAbs: number }) => number);
  /** Used for confidence normalization. Bigger => lower confidence. Default 60 */
  confidenceTargetAbs?: number;
  /** If true, ignore discard cards that are also in final hand (to avoid double count). Default false */
  excludeFinalFromDiscard?: boolean;
  /** Small epsilon to avoid division by zero */
  eps?: number;
};

const AXES: Axis[] = ["ES", "AC", "DW", "LI"];
const LEFT_POLE: Record<Axis, Pole> = { ES: "E", AC: "A", DW: "D", LI: "L" };

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function getSignedContribution(card: CardInfo, axis: Axis): number {
  let v = 0;
  const left = LEFT_POLE[axis];
  for (const a of card.axisScores ?? []) {
    if (a.axis !== axis) continue;
    const s = Number(a.score) || 0;
    if (!Number.isFinite(s) || s === 0) continue;
    v += a.pole === left ? s : -s;
  }
  return v;
}

function getAbsContribution(card: CardInfo, axis: Axis): number {
  let v = 0;
  const left = LEFT_POLE[axis];
  for (const a of card.axisScores ?? []) {
    if (a.axis !== axis) continue;
    const s = Number(a.score) || 0;
    if (!Number.isFinite(s) || s === 0) continue;
    v += Math.abs(a.pole === left ? s : -s);
  }
  return v;
}

function resolveCompress(
  compress: ComputeAxisScoresOptions["compress"],
): (x: number) => number {
  if (typeof compress === "function") return compress;
  if (compress === "sqrt") return (x) => Math.sqrt(Math.max(0, x));
  // default log1p
  return (x) => Math.log1p(Math.max(0, x));
}

function resolveK(
  K: ComputeAxisScoresOptions["K"],
): (ctx: { axis: Axis; baseAbs: number }) => number {
  if (typeof K === "function") return K;
  if (typeof K === "number") return () => K;
  // default "baseAbs"
  return ({ baseAbs }) => baseAbs;
}

/**
 * Compute 4-axis scores (0..100) from final-hand cards + discard evidence.
 *
 * - Final hand dominates the result.
 * - Discard evidence is compressed + normalized, then blended in.
 */
export function computeAxisScores(
  params: {
    finalHandCardIds: number[]; // expected length 5, but any length ok
    discardScores: DiscardScore[]; // may be empty
  },
  options: ComputeAxisScoresOptions = {},
): AxisScoresOutput {
  const {
    alpha = 0.35,
    compress = "log1p",
    K = "baseAbs",
    confidenceTargetAbs = 60,
    excludeFinalFromDiscard = false,
    eps = 1e-9,
  } = options;

  const compressFn = resolveCompress(compress);
  const kFn = resolveK(K);

  const finalSet = new Set<number>(
    (params.finalHandCardIds ?? []).map((x) => Number(x)).filter(Number.isFinite),
  );

  // Preprocess discard weights (global normalization across all discard cards)
  const discard = (params.discardScores ?? [])
    .map((d) => ({ cardId: Number(d.cardId), score: Number(d.score) }))
    .filter((d) => Number.isFinite(d.cardId) && Number.isFinite(d.score) && d.score > 0);

  const filteredDiscard = excludeFinalFromDiscard
    ? discard.filter((d) => !finalSet.has(d.cardId))
    : discard;

  const wRaw = filteredDiscard.map((d) => compressFn(d.score));
  const wSum = wRaw.reduce((a, b) => a + b, 0) || 0;

  // map cardId => normalized weight
  const wNormById = new Map<number, number>();
  if (wSum > 0) {
    for (let i = 0; i < filteredDiscard.length; i++) {
      const id = filteredDiscard[i].cardId;
      const w = wRaw[i] / wSum;
      wNormById.set(id, (wNormById.get(id) ?? 0) + w);
    }
  }

  const out = {} as AxisScoresOutput;

  for (const axis of AXES) {
    // Base: final hand
    let baseAxis = 0;
    let baseAbs = 0;

    for (const id of finalSet) {
      const card = cardDict[Number(id)];
      if (!card) continue;
      const v = getSignedContribution(card, axis);
      baseAxis += v;
      baseAbs += Math.abs(v); // use signed sum abs (keeps multi entries sensible)
    }

    // Aux: discard evidence (normalized weights)
    let auxAxis = 0;
    let auxAbs = 0;

    for (const [id, w] of wNormById.entries()) {
      const card = cardDict[Number(id)];
      if (!card) continue;
      const v = getSignedContribution(card, axis);
      auxAxis += w * v;
      auxAbs += w * Math.abs(v);
    }

    const k = kFn({ axis, baseAbs });
    const a = clamp(alpha, 0, 1);

    const totalAxis = baseAxis + a * k * auxAxis;
    const totalAbs = baseAbs + a * k * auxAbs;

    // -1..+1 leaning
    const ratio = clamp(totalAxis / (totalAbs + eps), -1, 1);
    // 0..100, 100 => left pole
    const score100 = Math.round(((ratio + 1) / 2) * 100);

    const confidence = clamp(totalAbs / confidenceTargetAbs, 0, 1);

    out[axis] = {
      axis,
      score100,
      ratio,
      confidence,
      debug: { baseAxis, baseAbs, auxAxis, auxAbs, totalAxis, totalAbs },
    };
  }

  return out;
}
