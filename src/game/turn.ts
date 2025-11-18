// src/game/turn.ts
import type { CardId, DiscardLogEntry, Room } from "../types";

function ensureArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value.slice() : [];
}

function cloneHands(hands: Room["hands"]): Record<string, CardId[]> {
  const src = hands ?? {};
  const result: Record<string, CardId[]> = {};
  for (const [pid, cards] of Object.entries(src)) {
    result[pid] = ensureArray(cards);
  }
  return result;
}

function cloneDiscards(
  discards: Room["discards"]
): Record<string, CardId[]> {
  const src = discards ?? {};
  const result: Record<string, CardId[]> = {};
  for (const [pid, cards] of Object.entries(src)) {
    result[pid] = ensureArray(cards);
  }
  return result;
}

function cloneDiscardLogs(
  logs: Room["discardLogs"]
): Record<string, DiscardLogEntry[]> {
  const src = logs ?? {};
  const result: Record<string, DiscardLogEntry[]> = {};
  for (const [pid, entries] of Object.entries(src)) {
    result[pid] = Array.isArray(entries) ? entries.slice() : [];
  }
  return result;
}

/**
 * 山札から 1 枚引く。
 */
export function applyDrawFromDeck(room: Room, playerId: string): Partial<Room> {
  if (room.activePlayerId !== playerId) {
    throw new Error("あなたのターンではありません。");
  }
  if (room.turnPhase !== "draw") {
    throw new Error("今はカードを捨てるフェーズです。");
  }

  const deck = ensureArray(room.deck);
  if (deck.length === 0) {
    throw new Error("山札が空です。");
  }

  // 先頭を「山の上」とする
  const [card, ...rest] = deck;
  const hands = cloneHands(room.hands);

  const currentHand = hands[playerId] ?? [];
  hands[playerId] = [...currentHand, card];

  return {
    deck: rest,
    hands,
    turnPhase: "discard",
  };
}

/**
 * 捨て札の山の一番上から 1 枚引く。
 */
export function applyDrawFromDiscard(
  room: Room,
  playerId: string,
  fromPlayerId: string
): Partial<Room> {
  if (room.activePlayerId !== playerId) {
    throw new Error("あなたのターンではありません。");
  }
  if (room.turnPhase !== "draw") {
    throw new Error("今はカードを捨てるフェーズです。");
  }

  const discards = cloneDiscards(room.discards);
  const pile = discards[fromPlayerId] ?? [];
  if (pile.length === 0) {
    throw new Error("このプレイヤーの捨て札は空です。");
  }

  const card = pile[pile.length - 1];
  const restPile = pile.slice(0, pile.length - 1);
  discards[fromPlayerId] = restPile;

  const hands = cloneHands(room.hands);
  const currentHand = hands[playerId] ?? [];
  hands[playerId] = [...currentHand, card];

  return {
    discards,
    hands,
    turnPhase: "discard",
  };
}

/**
 * 1 枚捨てて、次のプレイヤーの「引きフェーズ」に進める。
 * deck の残りが 0 なら status を finished にする。
 */
export function applyDiscardAndAdvance(
  room: Room,
  playerId: string,
  cardId: CardId,
  delaySec: number | null
): Partial<Room> {
  if (room.activePlayerId !== playerId) {
    throw new Error("あなたのターンではありません。");
  }
  if (room.turnPhase !== "discard") {
    throw new Error("まず 1 枚引いてください。");
  }

  const hands = cloneHands(room.hands);
  const discards = cloneDiscards(room.discards);
  const logs = cloneDiscardLogs(room.discardLogs);
  const deck = ensureArray(room.deck);

  const hand = hands[playerId] ?? [];
  const idx = hand.indexOf(cardId);
  if (idx === -1) {
    throw new Error("このカードはあなたの手札にありません。");
  }

  // 手札から 1 枚除く
  const newHand = hand.slice();
  newHand.splice(idx, 1);
  hands[playerId] = newHand;

  // 捨て札に追加
  const playerDiscards = discards[playerId] ?? [];
  discards[playerId] = [...playerDiscards, cardId];

  // ログに追加
  const turnIndex = room.turnIndex ?? 0;
  const entry: DiscardLogEntry = {
    cardId,
    delaySec: delaySec ?? 0,
    turnIndex,
  };
  const playerLogs = logs[playerId] ?? [];
  logs[playerId] = [...playerLogs, entry];

  // 次のプレイヤーとターン数
  const order = room.turnOrder ?? [];
  const currentIndex = order.indexOf(playerId);
  const nextIndex = order.length > 0 ? (currentIndex + 1) % order.length : 0;
  const nextPlayerId = order[nextIndex];

  const nextTurnIndex = turnIndex + 1;

  // 山札がすでに 0 なら、ここでゲーム終了とみなす
  const status = deck.length === 0 ? "finished" : room.status ?? "playing";

  return {
    hands,
    discards,
    discardLogs: logs,
    activePlayerId: nextPlayerId,
    turnIndex: nextTurnIndex,
    turnPhase: "draw",
    status,
  };
}
