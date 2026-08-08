const NAME_STORAGE_KEY = "cardgame_player_name";
const ROOM_STORAGE_KEY = "cardgame_room_code";

export function getSavedPlayerName(): string {
  return window.localStorage.getItem(NAME_STORAGE_KEY) || "";
}

export function savePlayerName(name: string): void {
  window.localStorage.setItem(NAME_STORAGE_KEY, name.trim());
}

export function getSavedRoomCode(): string {
  return window.localStorage.getItem(ROOM_STORAGE_KEY) || "";
}

export function saveRoomCode(code: string): void {
  window.localStorage.setItem(ROOM_STORAGE_KEY, code.trim().toUpperCase());
}

export function clearSavedRoomCode(): void {
  window.localStorage.removeItem(ROOM_STORAGE_KEY);
}
