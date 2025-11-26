export type Mode = "create" | "join";

export type Player = {
  id: string;
  name: string;
};

export type Screen = "title" | "roomSetup" | "lobby" | "game" | "result";

export type CardId = number;

export type DiscardLogEntry = {
  cardId: CardId;
  delaySec: number;
  turnIndex: number;
};

export type RoomPlayer = {
    name: string;
    joinedAt: any;
}

export type RoomStatus = "waiting" | "playing" | "finished";

export type TurnPhase = "draw" | "discard";

export type Room = {
    code: string;
    hostId: string;
    status: RoomStatus;
    cardCount: number;
    players: Record<string, RoomPlayer>;
    
    deck?: CardId[];
    hands?: Record<string, CardId[]>;
    discards?: Record<string, CardId[]>;
    discardLogs?: Record<string, DiscardLogEntry[]>;
    
    turnOrder?: string[];
    activePlayerId?: string;
    turnIndex?: number;
    turnPhase?: TurnPhase;
    turnTimerSeconds?: number | null;

    startedAt?: any;
    updatedAt?: any;
  };