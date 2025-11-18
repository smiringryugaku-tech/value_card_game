export function getCardImageUrl(cardId: number): string {
  return `/cards/card_${cardId.toString().padStart(2, "0")}.png`;
}