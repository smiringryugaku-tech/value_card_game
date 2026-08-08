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
  getSavedPlayerName,
  savePlayerName,
  getSavedRoomCode,
  saveRoomCode,
  clearSavedRoomCode,
} from "./utils/session";
import {
  createRoom,
  joinRoom,
  startGameInRoom,
  drawFromDeck,
  drawFromDiscardPile,
  discardCardAndAdvanceTurn,
  skipPlayerTurn,
} from "./services/roomService";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { warmupBackend } from "./api/analyze";

function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [roomCode, setRoomCode] = useState("");

  const [previousRoomCode, setPreviousRoomCode] = useState<string | null>(null);
  const [invitedRoomCode, setInvitedRoomCode] = useState<string | null>(null);

  const [isInRoom, setIsInRoom] = useState(false);

  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [cardCount, setCardCount] = useState(62);
  const [room, setRoom] = useState<Room | null>(null);
  const cardFromRef = useRef<CardFrom>("deck");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [turnStartTime, setTurnStartTime] = useState<number | null>(null);

  // ゲーム中の操作のたびにバックエンドを起こしておき、結果画面でのAI分析の
  // コールドスタートを避ける。呼びすぎ防止のため一定間隔でしか実際には叩かない。
  const lastWarmupAtRef = useRef<number>(0);
  const WARMUP_INTERVAL_MS = 4 * 60 * 1000;
  const checkAndWarmupBackend = () => {
    const now = Date.now();
    if (now - lastWarmupAtRef.current < WARMUP_INTERVAL_MS) return;
    lastWarmupAtRef.current = now;
    void warmupBackend();
  };

  useEffect(() => {
    const id = getOrCreatePlayerId();
    setPlayerId(id);

    // 1. URLパラメータから ?room=... を取得
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room")?.trim().toUpperCase();
    if (roomParam) {
      setInvitedRoomCode(roomParam);
    }

    // 2. 保存された名前を復元
    const savedName = getSavedPlayerName();
    if (savedName) {
      setPlayerName(savedName);
    }

    // 3. 保存されたルームコードを検証
    const savedRoom = getSavedRoomCode();
    if (savedRoom && id) {
      const roomRef = doc(db, "rooms", savedRoom);
      getDoc(roomRef)
        .then((snap) => {
          if (snap.exists()) {
            const roomData = snap.data() as Room;
            const updated = roomData.updatedAt;
            const updatedMs =
              updated && typeof (updated as any).toMillis === "function"
                ? (updated as any).toMillis()
                : 0;
            const isNotStale = Date.now() - updatedMs < 60 * 60 * 1000;
            const isJoined = !!roomData.players?.[id];

            if (isNotStale && isJoined) {
              setPreviousRoomCode(savedRoom);
              return;
            }
          }
          clearSavedRoomCode();
        })
        .catch((err) => {
          console.warn("前回のルーム情報の取得に失敗:", err);
          clearSavedRoomCode();
        });
    }
  }, []);

  const executeJoinRoom = async (codeToJoin: string, nameToUse: string) => {
    if (!playerId) return;
    setErrorMessage(null);
    checkAndWarmupBackend();

    const trimmedCode = codeToJoin.trim().toUpperCase();
    try {
      const joinedRoom = await joinRoom(trimmedCode, playerId, nameToUse);
      setRoom(joinedRoom);
      setCardCount(joinedRoom.cardCount);
      setRoomCode(trimmedCode);
      setIsInRoom(true);

      savePlayerName(nameToUse);
      saveRoomCode(trimmedCode);

      setIsHost(joinedRoom.hostId === playerId);
      setScreen("lobby");

      // クエリパラメータをブラウザ履歴から削除
      if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("不明なエラーが発生しました。");
      }
      setScreen("roomSetup");
    }
  };

  const handleTitleSubmit = async (name: string, selectedMode: Mode) => {
    setPlayerName(name);
    savePlayerName(name);
    setMode(selectedMode);
    setIsHost(selectedMode === "create");
    setErrorMessage(null);

    // 招待URL経由で入室する場合、コード入力画面をスキップ
    if (selectedMode === "join" && invitedRoomCode) {
      await executeJoinRoom(invitedRoomCode, name);
      return;
    }

    setRoomCode("");
    setScreen("roomSetup");
  };

  const handleRejoinPreviousRoom = async (name: string) => {
    if (!previousRoomCode) return;
    setPlayerName(name);
    savePlayerName(name);
    await executeJoinRoom(previousRoomCode, name);
  };

  const handleRoomSubmit = async () => {
    if (!mode || !playerId) return;
    setErrorMessage(null);
    checkAndWarmupBackend();

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

      savePlayerName(playerName);
      saveRoomCode(trimmedCode);

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
    clearSavedRoomCode();
    setPreviousRoomCode(null);
    setScreen("title");
    setRoomCode("");
    setRoom(null);
    setPlayers([]);
    setIsInRoom(false);
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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
    checkAndWarmupBackend();
  
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
    checkAndWarmupBackend();
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
    checkAndWarmupBackend();
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
    checkAndWarmupBackend();
  
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
    if (!room || !playerId || !isHost) return;

    try {
      await skipPlayerTurn(room.code, playerId);
    } catch (err) {
      console.error("プレイヤースキップの更新に失敗:", err);
      alert("プレイヤーのスキップに失敗しました。もう一度試してください。");
    }
  };

  const handlePlayAgainFromResult = () => {
    clearSavedRoomCode();
    setPreviousRoomCode(null);
    setIsInRoom(false);
    setRoom(null);
    setPlayers([]);
    setRoomCode("");
    setErrorMessage(null);
    setScreen("title");
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };
  
  useEffect(() => {
    if (!roomCode || !isInRoom) return;

    const ref = doc(db, "rooms", roomCode.trim().toUpperCase());

    const processRoomSnapData = (data: Room) => {
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
    };

    // 1. リアルタイムリスナー (onSnapshot)
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      processRoomSnapData(snap.data() as Room);
    });

    // 2. 5秒間隔のスマートポーリング（画面が表示されている場合のみ補正）
    const pollingId = setInterval(async () => {
      if (document.visibilityState === "visible") {
        try {
          const snap = await getDoc(ref);
          if (snap.exists()) {
            processRoomSnapData(snap.data() as Room);
          }
        } catch (err) {
          console.warn("[Polling] 補正データの取得に失敗:", err);
        }
      }
    }, 5000);

    // 3. 画面復帰時・フォーカス時の即時同期
    const handleSyncOnActive = async () => {
      if (document.visibilityState === "visible") {
        try {
          const snap = await getDoc(ref);
          if (snap.exists()) {
            processRoomSnapData(snap.data() as Room);
          }
        } catch (err) {
          console.warn("[Sync] 復帰時データの同期に失敗:", err);
        }
      }
    };

    window.addEventListener("visibilitychange", handleSyncOnActive);
    window.addEventListener("focus", handleSyncOnActive);

    return () => {
      unsubscribe();
      clearInterval(pollingId);
      window.removeEventListener("visibilitychange", handleSyncOnActive);
      window.removeEventListener("focus", handleSyncOnActive);
    };
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
    content = (
      <TitlePage
        onSubmit={handleTitleSubmit}
        initialPlayerName={playerName}
        previousRoomCode={previousRoomCode}
        invitedRoomCode={invitedRoomCode}
        onRejoinPreviousRoom={handleRejoinPreviousRoom}
      />
    );
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
    <div className={"app-root" + (isFixedLayout ? " app-root--game" : "")}>
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
