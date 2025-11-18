import { useEffect, useState } from "react";
import "./App.css";
import { TitlePage } from "./pages/TitlePage";
import { RoomSetupPage } from "./pages/RoomSetupPage";
import { LobbyPage } from "./pages/LobbyPage";
import { GameBoardPage } from "./pages/GameBoardPage";
import { ResultPage } from "./pages/ResultPage";
import type { CardId, Mode, Player, Room, Screen } from "./types";
import { getOrCreatePlayerId } from "./utils/playerId";
import {
  createRoom,
  joinRoom,
  startGameInRoom,
  drawFromDeck,
  drawFromDiscardPile,
  discardCardAndAdvanceTurn,
} from "./services/roomService";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [roomCode, setRoomCode] = useState("");

  const [isInRoom, setIsInRoom] = useState(false);

  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [cardCount, setCardCount] = useState(70);
  const [room, setRoom] = useState<Room | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [turnStartTime, setTurnStartTime] = useState<number | null>(null);

  useEffect(() => {
    const id = getOrCreatePlayerId();
    setPlayerId(id);
  }, []);

  const handleTitleSubmit = (name: string, selectedMode: Mode) => {
    setPlayerName(name);
    setMode(selectedMode);
    setIsHost(selectedMode === "create");
    setRoomCode("");
    setScreen("roomSetup");
    setErrorMessage(null);
  };

  const handleRoomSubmit = async () => {
    if (!mode || !playerId) return;
    setErrorMessage(null);

    const trimmedCode = roomCode.trim().toUpperCase();
    if (!trimmedCode) return;

    try {
      if (mode === "create") {
        const newRoom = await createRoom(
          trimmedCode,
          playerId,
          playerName,
          cardCount
        );
        setRoom(newRoom);
      } else {
        const joinedRoom = await joinRoom(roomCode, playerId, playerName);
        setRoom(joinedRoom);
        setCardCount(joinedRoom.cardCount);
      }

      setRoomCode(trimmedCode);
      setIsInRoom(true);

      setScreen("lobby");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("不明なエラーが発生しました。");
      }
    }
  };

  const handleBackFromRoom = () => {
    setScreen("title");
    setRoomCode("");
    setRoom(null);
    setPlayers([]);
    setIsInRoom(false);
  };

  const handleCardCountChange = async (nextCount: number) => {
    setCardCount(nextCount);
  
    // ルームが存在していて、ホストで、ゲーム開始前だけ更新可能
    if (!room || !isHost || room.status !== "waiting") return;
  
    const ref = doc(db, "rooms", room.code);
    try {
      await updateDoc(ref, { cardCount: nextCount });
    } catch (err) {
      console.error("カード枚数の更新に失敗:", err);
    }
  };

  const handleStartGame = async () => {
    if (!room) return;
  
    setErrorMessage(null);
  
    try {
      if (playerId && room.hostId !== playerId) {
        throw new Error("ホストのみゲームを開始できます。");
      }
  
      await startGameInRoom(room.code);
  
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("ゲーム開始に失敗しました。");
      }
    }
  };

  const handleDrawFromDeck = async () => {
    if (!room || !playerId) return;
    try {
      await drawFromDeck(room.code, playerId);
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    }
  };
  
  const handleDrawFromDiscard = async (fromPlayerId: string, cardIndex: number) => {
    if (!room || !playerId) return;
    try {
      await drawFromDiscardPile(room.code, playerId, fromPlayerId, cardIndex);
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    }
  };
  
  const handleDiscardCard = async (cardId: CardId) => {
    if (!room || !playerId) return;
  
    const now = Date.now();
    const delaySec =
      turnStartTime != null ? Math.round((now - turnStartTime) / 1000) : null;
  
    try {
      await discardCardAndAdvanceTurn(room.code, playerId, cardId, delaySec);
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    }
  };
  

  useEffect(() => {
    if (!roomCode || !isInRoom) return;
  
    const ref = doc(db, "rooms", roomCode.trim().toUpperCase());
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Room;
      setRoom(data);

      const playersMap = data.players ?? {};
      const order: string[] = Object.keys(playersMap).sort((a, b) => a.localeCompare(b));

      const list: Player[] = order
        .filter((id) => playersMap[id])
        .map((id) => ({
          id,
          name: playersMap[id].name,
        }));

      setPlayers(list);
      setCardCount(data.cardCount);
  
      // ★ Room の status に応じて画面を切り替える
      if (data.status === "playing") {
        setScreen("game");
      } else if (data.status === "finished") {
        setScreen("result");
      } else {
        setScreen("lobby");
      }
    });
  
    return () => unsubscribe();
  }, [roomCode, isInRoom]);

  useEffect(() => {
    if (!room || !playerId) {
      setTurnStartTime(null);
      return;
    }
  
    if (room.activePlayerId === playerId && room.turnPhase === "discard") {
      setTurnStartTime(Date.now());
    } else {
      // 自分のターンじゃない or 引きフェーズ のときはリセット
      setTurnStartTime(null);
    }
  }, [room?.activePlayerId, room?.turnPhase, room?.turnIndex, playerId]);

  if (screen === "title") {
    return <TitlePage onSubmit={handleTitleSubmit} />;
  }

  if (screen === "roomSetup" && mode) {
    return (
      <div>
        {errorMessage && (
          <div
            style={{
              backgroundColor: "#fee",
              color: "#900",
              padding: "0.5rem 1rem",
            }}
          >
            {errorMessage}
          </div>
        )}
        <RoomSetupPage
          mode={mode}
          playerName={playerName}
          roomCode={roomCode}
          onRoomCodeChange={setRoomCode}
          onSubmit={handleRoomSubmit}
          onBack={handleBackFromRoom}
        />
      </div>
    );
  }

  if (screen === "lobby" && room) {
    return (
      <div>
        {errorMessage && (
          <div
            style={{
              backgroundColor: "#fee",
              color: "#900",
              padding: "0.5rem 1rem",
            }}
          >
            {errorMessage}
          </div>
        )}
        <LobbyPage
          roomCode={room.code}
          players={players}
          isHost={isHost}
          cardCount={cardCount}
          onCardCountChange={handleCardCountChange}
          onStartGame={handleStartGame}
          // isStartingGame を渡したい場合は props に足す
        />
      </div>
    );
  }

  if (screen === "game" && room && playerId) {
    return (
      <GameBoardPage
        room={room}
        players={players}
        myPlayerId={playerId}
        onDrawFromDeck={handleDrawFromDeck}
        onDrawFromDiscard={handleDrawFromDiscard}
        onDiscard={handleDiscardCard}
      />
    );
  }

  if (screen === "result" && room) {
    return <ResultPage room={room} players={players} />;
  }

  // 万が一おかしな状態になったとき
  return <div>エラー: 無効な画面状態です。</div>;
}

export default App;
