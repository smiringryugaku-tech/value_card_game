// src/pages/ResultPage/ResultPage.tsx
import { useEffect, useState } from "react";
import "./ResultPage.css";
import type { Room, Player, CardId } from "../../types";
import { cardDict, getCardImageUrl } from "../../utils/cardImage";

type ResultPageProps = {
  room: Room;
  players: Player[];
  myPlayerId: string;
  onPlayAgain: () => void; 
};

function getCardTexts(cardId: CardId) {
  const info = (cardDict as any)[cardId];
  if (!info) return { jp: `カード ${cardId}`, en: "" };
  return { jp: info.japanese, en: info.english };
}

export function ResultPage({ room, players, myPlayerId, onPlayAgain }: ResultPageProps) {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsNarrow(window.innerWidth < 720);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const myHand = (room.hands?.[myPlayerId] ?? []).slice(0, 5);
  const myPlayer = players.find((p) => p.id === myPlayerId);
  const myName = myPlayer?.name ?? "あなた";

  const otherPlayers = players.filter((p) => p.id !== myPlayerId);

  const handleAnalyze = () => {
    alert("AI分析（あとで実装するよ！）");
  };

  const mySlots: Array<CardId | null> = Array.from(
    { length: 5 },
    (_, i) => myHand[i] ?? null
  );

  type SlotVariant = "single" | "multi";
  const renderSlot = (cardId: CardId | null, key: string, variant: SlotVariant) => {
    const baseClass = [
      "result-my-card-slot",
      variant === "single" ? "result-my-card-slot--single" : "",
      cardId == null ? "result-my-card-slot--empty" : "",
    ]
      .filter(Boolean)
      .join(" ");
  
    if (cardId == null) {
      return <div key={key} className={baseClass} />;
    }
  
    const { jp } = getCardTexts(cardId);
  
    return (
      <div key={key} className={baseClass}>
        <img
          src={getCardImageUrl(cardId)}
          alt={jp || `カード ${cardId}`}
          className="result-my-card-image"
        />
      </div>
    );
  };

  return (
    <div className="result-root">
      {/* 上部のボタン＋ヘッダー */}
      <div className="result-actions-row">
        <button
          type="button"
          className="result-btn result-btn-primary"
          onClick={onPlayAgain}
        >
          もう一度遊ぶ
        </button>
        <button
          type="button"
          className="result-btn result-btn-secondary"
          onClick={handleAnalyze}
        >
          AI分析
        </button>
      </div>

      <section className="result-header">
        <div className="result-header-main">🎉 結果発表 ✨</div>
        <div className="result-header-sub">
          人生において大切な5つの価値観
        </div>
      </section>

      {/* ★ 自分の価値観（2 段固定レイアウト） */}
      <section className="result-my-values">
        <div className="result-my-panel">
          <div className="result-my-title">
            <strong>{myName}</strong> の価値観
          </div>

          {isNarrow ? (
            // 2列（3 + 2）
            <div className="result-my-card-rows">
              <div className="result-my-card-row">
                {mySlots.slice(0, 3).map((cardId, idx) =>
                  renderSlot(cardId, `row1-${idx}`, "multi")
                )}
              </div>
              <div className="result-my-card-row">
                {mySlots.slice(3).map((cardId, idx) =>
                  renderSlot(cardId, `row2-${idx}`, "multi")
                )}
              </div>
            </div>
          ) : (
            // 1列5枚
            <div className="result-my-card-row result-my-card-row--single">
              {mySlots.map((cardId, idx) =>
                renderSlot(cardId, `single-${idx}`, "single")
              )}
            </div>
          )}
        </div>
      </section>

      {/* 他プレイヤーのセクションは今のままでOK */}
      <section className="result-others">
        <div className="result-section-title">他のプレイヤーの価値観</div>
        <div className="result-others-scroll">
          {otherPlayers.map((p) => {
            const hand = (room.hands?.[p.id] ?? []).slice(0, 5);

            return (
              <div key={p.id} className="result-other-column">
                <div className="result-other-header">
                  <strong className="result-other-name">{p.name}</strong>
                  <span className="result-other-header-suffix">
                    の価値観
                  </span>
                </div>
                <div className="result-other-values">
                  {hand.length === 0 && (
                    <div className="result-other-empty">
                      まだカードがありません
                    </div>
                  )}
                  {hand.map((cardId) => {
                    const { jp, en } = getCardTexts(cardId);
                    return (
                      <div
                        key={`${p.id}-${cardId}`}
                        className="result-other-value"
                      >
                        <div className="result-other-jp">{jp}</div>
                        {en && <div className="result-other-en">{en}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
