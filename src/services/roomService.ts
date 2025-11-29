import {
    doc,
    getDoc,
    updateDoc,
    runTransaction,
    serverTimestamp,
  } from "firebase/firestore";
  import { db } from "../firebase";
  import type { CardFrom, Room } from "../types";
  import { createInitialGameState } from "../game/setup";
  import {
    applyDrawFromDeck,
    applyDrawFromDiscard,
    applyDiscardAndAdvance,
  } from "../game/turn";

  const ONE_HOUR_MS = 60 * 60 * 1000;

  function isRoomStale(room: Room): boolean {
    const updated = room.updatedAt;
    if (!updated || typeof (updated as any).toMillis !== "function") {
      return true;
    }
    const updatedMs = (updated as any).toMillis() as number;
    const nowMs = Date.now();
    return nowMs - updatedMs > ONE_HOUR_MS;
  }
  
  export async function createRoom(
    roomCode: string,
    playerId: string,
    playerName: string,
    cardCount: number
  ): Promise<Room> {
    const trimmedCode = roomCode.trim().toUpperCase();
    const roomRef = doc(db, "rooms", trimmedCode);
    const now = serverTimestamp();

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
  
      if (!snap.exists()) {
        const newRoom: Room = {
          code: trimmedCode,
          hostId: playerId,
          status: "waiting" as const,
          cardCount,
          players: {
            [playerId]: { name: playerName, joinedAt: now },
          },
          deck: [],
          hands: {},
          discards: {},
          discardLogs: {},
          turnOrder: [playerId],
          activePlayerId: playerId,
          turnIndex: 0,
          turnPhase: "draw",
          startedAt: now,
          updatedAt: now,
        };
  
        tx.set(roomRef, newRoom);
        return;
      }
  
      const existing = snap.data() as Room;
  
      if (!isRoomStale(existing)) {
        throw new Error(
          "このルームコードは現在使用中です。別のコードを選んでください。"
        );
      }
  
      const resetRoom: Room = {
        code: trimmedCode,
        hostId: playerId,
        status: "waiting",
        cardCount,
        players: {
          [playerId]: { name: playerName, joinedAt: now },
        },
        deck: [],
        hands: {},
        discards: {},
        discardLogs: {},
        turnOrder: [playerId],
        activePlayerId: playerId,
        turnIndex: 0,
        turnPhase: "draw",
        startedAt: now,
        updatedAt: now,
      };
  
      tx.set(roomRef, resetRoom);
    });
  
    const finalSnap = await getDoc(roomRef);
    return finalSnap.data() as Room;
  }
  
  export async function joinRoom(
    roomCode: string,
    playerId: string,
    playerName: string
  ): Promise<Room> {
    const trimmedCode = roomCode.trim().toUpperCase();
    const roomRef = doc(db, "rooms", trimmedCode);
    const snap = await getDoc(roomRef);
  
    if (!snap.exists()) {
      throw new Error("そのルームコードは存在しません。");
    }
  
    const data = snap.data() as Room;
  
    const now = serverTimestamp();
  
    await updateDoc(roomRef, {
      [`players.${playerId}`]: {
        name: playerName,
        joinedAt: now,
      },
      updatedAt: now,
    });
  
    // ローカルの Room オブジェクトも更新して返す
    const updatedRoom: Room = {
      ...data,
      players: {
        ...data.players,
        [playerId]: {
          name: playerName,
          joinedAt: now,
        },
      },
    };
  
    return updatedRoom;
  }
  

export async function startGameInRoom(roomCode: string): Promise<Room> {
  const trimmedCode = roomCode.trim().toUpperCase();
  const roomRef = doc(db, "rooms", trimmedCode);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    throw new Error("ルームが存在しません。");
  }

  const room = snap.data() as Room;

  if (room.status === "playing") {
    throw new Error("すでにゲームが開始されています。");
  }
  if (room.status === "finished") {
    throw new Error("このゲームはすでに終了しています。");
  }

  // プレイヤーがいない場合はエラー
  if (!room.players || Object.keys(room.players).length === 0) {
    throw new Error("プレイヤーがいません。");
  }

  // ゲーム初期状態を生成（山札・手札・捨て札・ターン情報など）
  const initialState = createInitialGameState(room);

  const now = serverTimestamp();

  await updateDoc(roomRef, {
    ...initialState,
    status: "playing",
    startedAt: now,
    updatedAt: now,
  });

  // フロント側でも使えるようにマージした Room を返す
  return {
    ...room,
    ...initialState,
    status: "playing",
  };
}

export async function drawFromDeck(roomCode: string, playerId: string) {
  const trimmedCode = roomCode.trim().toUpperCase();
  const roomRef = doc(db, "rooms", trimmedCode);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("ルームが存在しません。");

    const room = snap.data() as Room;
    const update = applyDrawFromDeck(room, playerId);

    tx.update(roomRef, {
      ...update,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function drawFromDiscardPile(
  roomCode: string,
  playerId: string,
  fromPlayerId: string,
  cardIndex: number,
) {
  const trimmedCode = roomCode.trim().toUpperCase();
  const roomRef = doc(db, "rooms", trimmedCode);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("ルームが存在しません。");

    const room = snap.data() as Room;
    const update = applyDrawFromDiscard(room, playerId, fromPlayerId, cardIndex);

    tx.update(roomRef, {
      ...update,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function discardCardAndAdvanceTurn(
  roomCode: string,
  playerId: string,
  cardFrom: CardFrom,
  cardId: number,
  delaySec: number | null
) {
  const trimmedCode = roomCode.trim().toUpperCase();
  const roomRef = doc(db, "rooms", trimmedCode);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("ルームが存在しません。");

    const room = snap.data() as Room;
    const update = applyDiscardAndAdvance(room, playerId, cardFrom, cardId, delaySec);

    tx.update(roomRef, {
      ...update,
      updatedAt: serverTimestamp(),
    });
  });
}
