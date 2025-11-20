// src/pages/TitlePage/TitlePage.tsx
import { useState, useRef } from "react";
import type { Mode } from "../../types";
import "./TitlePage.css";

type TitlePageProps = {
  onSubmit: (playerName: string, mode: Mode) => void;
};

export function TitlePage({ onSubmit }: TitlePageProps) {
  const [playerName, setPlayerName] = useState("");

  const handleChooseMode = (mode: Mode) => {
    const trimmed = playerName.trim();
    if (!trimmed) return;
    onSubmit(trimmed, mode);
  };

  const disabled = playerName.trim().length === 0;
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
    <div className="title-root">
      <div className="title-inner">
        {/* ロゴ */}
        <div className="title-logo-wrapper">
          <img
            src="/images/smiring_logo.png"
            alt="SmiRing ロゴ"
            className="title-logo-img"
          />
        </div>

        {/* タイトル & サブタイトル */}
        <div className="title-text-block">
          <h1 className="title-main">❤️‍🔥 価値観カードゲーム 🌈✨</h1>
          <p className="title-sub">あなたの人生における大切な要素を見つけよう！</p>
        </div>

        {/* 中央付近：プレイヤー名入力 + モード選択ボタン */}
        <div className="title-form-block">
          <label className="title-name-label">
            <span className="title-name-caption">プレイヤー名を入力（10文字以下）</span>
            <input
              type="text"
              className="title-name-input"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onFocus={handleFocus}
              placeholder="例: たろう / Taro"
              maxLength={10}
            />
          </label>

          <div className="title-mode-buttons">
            <button
              type="button"
              className="title-mode-button title-mode-button--primary"
              disabled={disabled}
              onClick={() => handleChooseMode("create")}
            >
              🏠 ルームを作る
            </button>
            <button
              type="button"
              className="title-mode-button title-mode-button--secondary"
              disabled={disabled}
              onClick={() => handleChooseMode("join")}
            >
              🚪 ルームに入る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
