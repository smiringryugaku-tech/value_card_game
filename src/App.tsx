import { useEffect, useState, useRef } from "react";
import "./App.css";
import { TitlePage } from "./pages/TitlePage/TitlePage";
import { RoomSetupPage } from "./pages/RoomSetupPage/RoomSetupPage";
import { LobbyPage } from "./pages/LobbyPage/LobbyPage";
import { GameBoardPage } from "./pages/GameBoardPage/GameBoardPage";
import { ResultPage } from "./pages/ResultPage/ResultPage";
import type { CardFrom, CardId, Mode, Player, Room, Screen } from "./types";
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
  const cardFromRef = useRef<CardFrom>("deck");

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
      cardFromRef.current = "deck";
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    }
  };
  
  const handleDrawFromDiscard = async (fromPlayerId: string, cardIndex: number) => {
    if (!room || !playerId) return;
    try {
      await drawFromDiscardPile(room.code, playerId, fromPlayerId, cardIndex);
      cardFromRef.current = "discard";
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    }
  };
  
  const handleDiscardCard = async (cardId: CardId) => {
    if (!room || !playerId) return;
  
    const now = Date.now();
    const delaySec =
      turnStartTime != null ? Math.round(((now - turnStartTime) / 1000) * 100) / 100 : null;
  
    try {
      await discardCardAndAdvanceTurn(room.code, playerId, cardFromRef.current, cardId, delaySec);
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    }
  };

  const handleTimerSetting = async (seconds: number | null) => {
    if (!room) return;
    if (!room.activePlayerId) return;
    if (!isHost) return;                   // 念のためホストだけ
    if (playerId && room.hostId !== playerId) return;

    try {
      const ref = doc(db, "rooms", room.code);
      await updateDoc(ref, {
        turnTimerSeconds: seconds,
      });
    } catch (err) {
      console.error("タイマー設定の更新に失敗:", err);
      alert("タイマー設定の保存に失敗しました。もう一度試してください。");
    }
  }

  const handleSkipPlayer = async () => {
    // 基本的なガード
    if (!room) return;
    if (!room.activePlayerId) return;
    if (!isHost) return;                   // 念のためホストだけ
    if (playerId && room.hostId !== playerId) return;
  
    // プレイヤー順序は players の並びを前提
    const order = players.map((p) => p.id);
    const currentIndex = order.indexOf(room.activePlayerId);
    if (currentIndex === -1) return;
  
    const nextIndex = (currentIndex + 1) % order.length;
    const nextPlayerId = order[nextIndex];
  
    try {
      const ref = doc(db, "rooms", room.code);
      await updateDoc(ref, {
        activePlayerId: nextPlayerId,
        turnPhase: "draw",                 // 次の人は draw からスタート
        turnIndex: (room.turnIndex ?? 0) + 1, // もし turnIndex があればインクリメント
      });
    } catch (err) {
      console.error("プレイヤースキップの更新に失敗:", err);
      alert("プレイヤーのスキップに失敗しました。もう一度試してください。");
    }
  };

  const handlePlayAgainFromResult = () => {
    // ルームから一旦抜けた扱いにする
    setIsInRoom(false);
    setRoom(null);
    setPlayers([]);
  
    // ルームコードはリセット（同じコードを使いたいなら残してもOK）
    setRoomCode("");
  
    // エラーもリセットしておく
    setErrorMessage(null);
  
    // ルームセットアップ画面へ
    setScreen("title");
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

  let content;
  const isFixedLayout = screen === "game";

  if (screen === "title") {
    content = <TitlePage onSubmit={handleTitleSubmit} />;
  }

  else if (screen === "roomSetup" && mode) {
    content = (
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

  else if (screen === "lobby" && room) {
    content = (
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
        />
      </div>
    );
  }

  else if (screen === "game" && room && playerId) {
    content = (
      <GameBoardPage
        room={room}
        players={players}
        myPlayerId={playerId}
        onDrawFromDeck={handleDrawFromDeck}
        onDrawFromDiscard={handleDrawFromDiscard}
        onDiscard={handleDiscardCard}
        onSkipPlayer={handleSkipPlayer}
        onTimerSetting={handleTimerSetting}
      />
    );
  }

  else if (screen === "result" && room && playerId) {
    content = (
      <ResultPage
        room={room}
        players={players}
        myPlayerId={playerId}
        onPlayAgain={handlePlayAgainFromResult}
      />
    );
  }

  // 万が一おかしな状態になったとき
  else { content = <div>エラー: 無効な画面状態です。</div>; }

  return (
    <div className="app-root">
      <header className="app-bar">
        <div style={{ fontSize: "min(32px, 4vh, 5vw)", fontWeight: "bold" }}>❤️‍🔥 留学価値観カードゲーム</div>
        {playerName && (
          <div style={{ fontSize: "1rem", fontWeight: "bold", opacity: 0.8}}>
            👤 {playerName}
          </div>
        )}
      </header>
      <main className="app-main"
        style={{
          overflowY: isFixedLayout ? "hidden" : "auto",
        }}
      >
        {content}
      </main>
    </div>
  );
}

export default App;
