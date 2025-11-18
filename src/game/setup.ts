import type {
  CardId,
  DiscardLogEntry,
  Room,
} from "../types";
import { createShuffledDeck, dealInitialHands } from "./deck";

export function createInitialGameState(
  room: Room
): Pick<
  Room,
  | "deck"
  | "hands"
  | "discards"
  | "discardLogs"
  | "turnOrder"
  | "activePlayerId"
  | "turnIndex"
  | "turnPhase"
> {
  const playerIds = Object.keys(room.players).sort((a, b) => a.localeCompare(b));
  if (playerIds.length === 0) {
    throw new Error("プレイヤーがいません。");
  }

  const cardsPerPlayer = 5;
  const deck: CardId[] = createShuffledDeck(room.cardCount);

  const { hands, remainingDeck } = dealInitialHands(
    playerIds,
    deck,
    cardsPerPlayer
  );

  // 捨て札とログは空で初期化
  const discards: Record<string, CardId[]> = {};
  const discardLogs: Record<string, DiscardLogEntry[]> = {};
  for (const playerId of playerIds) {
    discards[playerId] = [];
    discardLogs[playerId] = [];
  }

  // 今はシンプルに「players の順番」をそのままターン順にする
  // （あとでホストが順番を決められるようにしてもOK）
  const turnOrder = playerIds;
  const activePlayerId = turnOrder[0];
  const turnIndex = 0;

  return {
    deck: remainingDeck,
    hands,
    discards,
    discardLogs,
    turnOrder,
    activePlayerId,
    turnIndex,
    turnPhase: "draw",
  };
}