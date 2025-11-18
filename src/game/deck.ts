import type { CardId } from "../types";

export function createShuffledDeck(cardCount: number): CardId[] {
  const deck: CardId[] = [];
  for (let i = 0; i < cardCount; i++) {
    deck.push(i);
  }
  return shuffle(deck);
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