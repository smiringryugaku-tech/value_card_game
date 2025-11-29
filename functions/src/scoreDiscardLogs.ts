type CardFrom = "deck" | "discard";

export type DiscardLogEntry = {
  cardFrom: CardFrom;
  cardId: number;
  delaySec: number;
  turnIndex: number; // あなたの説明だと基本ある前提
};

function delayFunction(delayRate: number): number {
  if (!Number.isFinite(delayRate) || delayRate <= 0) return 0;
  return (5 * delayRate) / (4 * delayRate + 1);
}

export function scoreDiscardLogsSorted(
  discardLogs: DiscardLogEntry[],
  opts?: {
    combine?: "sum" | "max" | "last";
    // turnIndexが無い/壊れてるデータをどうするか
    allowMissingTurnIndex?: boolean;
  }
) {
  const combine = opts?.combine ?? "last";
  const allowMissingTurnIndex = opts?.allowMissingTurnIndex ?? false;

  if (discardLogs.length === 0) return new Map<number, number>();

  // 1) turnIndexを信じてソート（昇順）
  const sorted = [...discardLogs].sort((a, b) => {
    const ta = Number(a.turnIndex);
    const tb = Number(b.turnIndex);

    if (!Number.isFinite(ta) || !Number.isFinite(tb)) {
      if (!allowMissingTurnIndex) {
        throw new Error("Invalid turnIndex found in discardLogs");
      }
      // 壊れてるのは後ろへ
      if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
      if (!Number.isFinite(ta)) return 1;
      return -1;
    }
    return ta - tb;
  });

  // 2) maxDelay（deck計算用）
  let maxDelay = 0;
  for (const e of sorted) {
    const d = Number(e.delaySec);
    if (Number.isFinite(d) && d > maxDelay) maxDelay = d;
  }

  const maxIndex = sorted.length;
  const byCardId = new Map<number, number>();

  // 3) ソート後の配列indexで採点
  for (let index = 0; index < sorted.length; index++) {
    const e = sorted[index];
    const k = index + 1;

    let score = 0;

    if (e.cardFrom === "deck") {
      const d = Math.max(0, Number(e.delaySec) || 0);
      const delayRate = maxDelay > 0 ? d / maxDelay : 0;
      score = k * delayFunction(delayRate);
    } else {
      score = (k * k) / maxIndex;
    }

    const cardId = Number(e.cardId);
    if (!Number.isFinite(cardId)) continue;

    if (!byCardId.has(cardId)) {
      byCardId.set(cardId, score);
      continue;
    }

    if (combine === "sum") byCardId.set(cardId, (byCardId.get(cardId) ?? 0) + score);
    if (combine === "max") byCardId.set(cardId, Math.max(byCardId.get(cardId) ?? 0, score));
    if (combine === "last") byCardId.set(cardId, score); // ← これが「最後で上書き」
  }

  return byCardId;
}
