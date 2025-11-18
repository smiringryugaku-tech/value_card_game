import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    runTransaction,
    serverTimestamp,
  } from "firebase/firestore";
  import { db } from "../firebase";
  import type { Room } from "../types";
  import { createInitialGameState } from "../game/setup";
  import {
    applyDrawFromDeck,
    applyDrawFromDiscard,
    applyDiscardAndAdvance,
  } from "../game/turn";
  
  export async function createRoom(
    roomCode: string,
    playerId: string,
    playerName: string,
    cardCount: number
  ): Promise<Room> {
    const trimmedCode = roomCode.trim().toUpperCase();
    const roomRef = doc(db, "rooms", trimmedCode);
    const snap = await getDoc(roomRef);
  
    if (snap.exists()) {
      throw new Error("このルームコードはすでに使われています。");
    }
  
    const now = serverTimestamp();
  
    const roomData = {
      code: trimmedCode,
      hostId: playerId,
      status: "waiting" as const,
      cardCount,
      players: {
        [playerId]: {
          name: playerName,
          joinedAt: now,
        },
      },
      createdAt: now,
      updatedAt: now,
    };
  
    await setDoc(roomRef, roomData);
  
    // TypeScript 的には snap.data() の型を Room に合わせたいけど、
    // ここでは素直にキャストして返す
    return roomData as unknown as Room;
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
  fromPlayerId: string
) {
  const trimmedCode = roomCode.trim().toUpperCase();
  const roomRef = doc(db, "rooms", trimmedCode);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("ルームが存在しません。");

    const room = snap.data() as Room;
    const update = applyDrawFromDiscard(room, playerId, fromPlayerId);

    tx.update(roomRef, {
      ...update,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function discardCardAndAdvanceTurn(
  roomCode: string,
  playerId: string,
  cardId: number,
  delaySec: number | null
) {
  const trimmedCode = roomCode.trim().toUpperCase();
  const roomRef = doc(db, "rooms", trimmedCode);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("ルームが存在しません。");

    const room = snap.data() as Room;
    const update = applyDiscardAndAdvance(room, playerId, cardId, delaySec);

    tx.update(roomRef, {
      ...update,
      updatedAt: serverTimestamp(),
    });
  });
}
