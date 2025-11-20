// src/pages/RoomSetupPage/RoomSetupPage.tsx
import { type FormEvent, useRef } from "react";
import type { Mode } from "../../types";
import "./RoomSetupPage.css";

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

  const mainTitle = mode === "create" ? "ルームを作る" : "ルームに入る";
  const actionLabel = mode === "create" ? "作成" : "入室";

  const description =
    mode === "create"
      ? "使用したいルームコードを決めてください。（10文字以下）"
      : "参加したいルームコードを入力してください。";

  const inputRef = useRef<HTMLInputElement | null>(null);
  const handleFocus = () => {
    // キーボードが出たあとにスクロールさせたいので、少しだけ遅らせる
    setTimeout(() => {
      inputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 200);
  };

  return (
    <div className="room-setup-root">
      {/* 左上の戻るボタン */}
      <div className="room-setup-back-row">
        <button
          type="button"
          className="room-setup-back-button"
          onClick={onBack}
        >
          ◀ 戻る
        </button>
      </div>

      {/* 中央揃えゾーン */}
      <div className="room-setup-main">
        <div className="room-setup-panel">
          <div className="room-setup-emoji">{mode === "create" ? "🏠" : "🚪"}</div>

          <h1 className="room-setup-title">{mainTitle}</h1>

          <p className="room-setup-player">
            プレイヤー名：<strong>{playerName}</strong>
          </p>

          <p className="room-setup-description">{description}</p>

          <form className="room-setup-form" onSubmit={handleSubmit}>
            <label className="room-setup-label">
              <span className="room-setup-label-text">ルームコード</span>
              <input
                type="text"
                value={roomCode}
                onChange={(e) =>
                  onRoomCodeChange(e.target.value.toUpperCase())
                }
                className="room-setup-input"
                placeholder="例: ABCD"
                maxLength={10}
                onFocus={handleFocus}
              />
            </label>

            <button
              type="submit"
              className="room-setup-submit"
              disabled={!roomCode.trim()}
            >
              {actionLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
