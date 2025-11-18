const STORAGE_KEY = "cardgame_player_id";

function generateRandomId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `player_${random}`;
}

export function getOrCreatePlayerId(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = generateRandomId();
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}