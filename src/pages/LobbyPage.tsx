// src/pages/LobbyPage.tsx
import type { Player } from "../types";
import type { ChangeEvent } from "react";

type LobbyPageProps = {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  cardCount: number;
  onCardCountChange: (count: number) => void;
  onStartGame: () => void;
};

export function LobbyPage({
  roomCode,
  players,
  isHost,
  cardCount,
  onCardCountChange,
  onStartGame,
}: LobbyPageProps) {
  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
  onCardCountChange(Number(e.target.value));
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h2>待機室</h2>
      <p>
        ルームコード：<strong>{roomCode}</strong>
      </p>

      <section style={{ marginTop: "1.5rem" }}>
        <h3>プレイヤー</h3>
        <ul>
          {players.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      </section>

      {isHost && (
        <section style={{ marginTop: "1.5rem" }}>
          <h3>ホスト設定</h3>
          <div style={{ marginBottom: "1rem" }}>
            <label>
              カード枚数：{cardCount}
              <input
                type="range"
                min={20}
                max={94}
                step={1}
                value={cardCount}
                onChange={handleSliderChange}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          </div>

          <button onClick={onStartGame}>
            ゲーム開始
          </button>
        </section>
      )}

      {!isHost && (
        <p style={{ marginTop: "1.5rem" }}>
          ホストがゲームをスタートするまでお待ちください。
        </p>
      )}
    </div>
  );
}
