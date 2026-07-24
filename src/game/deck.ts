import type { CardId } from "../types";
import { cardDict } from "../utils/cardInfo";

export function createShuffledDeck(cardCount: number): CardId[] {
  const deck: CardId[] = Object.keys(cardDict).map(Number);
  return shuffle(deck).slice(0, cardCount);
}

export function shuffle<T>(array: T[]): T[] {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

export function dealInitialHands(
  playerIds: string[],
  deck: CardId[],
  cardsPerPlayer: number
): {
  hands: Record<string, CardId[]>;
  remainingDeck: CardId[];
} {
  const hands: Record<string, CardId[]> = {};
  const workingDeck = deck.slice();

  if (workingDeck.length < playerIds.length * cardsPerPlayer) {
    throw new Error("カード枚数が足りません。cardCount を増やしてください。");
  }

  for (const playerId of playerIds) {
    hands[playerId] = workingDeck.splice(0, cardsPerPlayer);
  }

  return {
    hands,
    remainingDeck: workingDeck,
  };
}