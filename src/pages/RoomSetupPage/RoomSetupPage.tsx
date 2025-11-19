// src/pages/RoomSetupPage.tsx
import { type FormEvent } from "react";
import type { Mode } from "../../types";

type RoomSetupPageProps = {
  mode: Mode;
  playerName: string;
  roomCode: string;
  onRoomCodeChange: (code: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export function RoomSetupPage({
  mode,
  playerName,
  roomCode,
  onRoomCodeChange,
  onSubmit,
  onBack,
}: RoomSetupPageProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    onSubmit();
  };

  const title =
    mode === "create" ? "ルームを作成" : "ルームに入る";

  const description =
    mode === "create"
      ? "使用したいルームコードを決めてください。（他の人にも共有します）"
      : "参加したいルームコードを入力してください。";

  return (
    <div style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
      <button onClick={onBack} style={{ marginBottom: "1rem" }}>
        ← 戻る
      </button>

      <h2>{title}</h2>
      <p>プレイヤー名：{playerName}</p>
      <p>{description}</p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label>
            ルームコード：
            <input
              type="text"
              value={roomCode}
              onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
              style={{ marginLeft: "0.5rem" }}
              placeholder="例: ABCD"
            />
          </label>
        </div>

        <button type="submit" disabled={!roomCode.trim()}>
          ルームに進む
        </button>
      </form>
    </div>
  );
}
