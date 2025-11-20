// src/pages/GameBoardPage/GameBoardPage.tsx
import type { CardId, Player, Room } from "../../types";
import "./GameBoardPage.css";
// パスはあなたのプロジェクトに合わせて変えてね
import { cardDict, getCardImageUrl } from "../../utils/cardImage";

type GameBoardPageProps = {
  room: Room;
  players: Player[];
  myPlayerId: string;
  onDrawFromDeck: () => void;
  onDrawFromDiscard: (fromPlayerId: string, cardIndex: number) => void;
  onDiscard: (cardId: CardId) => void;
  onSkipPlayer: () => void;
};

function getCardTexts(cardId: CardId) {
  const info = (cardDict as any)[cardId];
  if (!info) return { jp: `カード ${cardId}`, en: "" };
  return { jp: info.japanese, en: info.english };
}

export function GameBoardPage({
  room,
  players,
  myPlayerId,
  onDrawFromDeck,
  onDrawFromDiscard,
  onDiscard,
  onSkipPlayer,
}: GameBoardPageProps) {
  const myHand = room.hands?.[myPlayerId] ?? [];
  const discards = room.discards ?? {};
  const deckCount = room.deck?.length ?? 0;

  const activePlayerId = room.activePlayerId;
  const activePlayer = players.find((p) => p.id === activePlayerId);
  const isMyTurn = activePlayerId === myPlayerId;
  const phase = room.turnPhase ?? "draw";
  const isHost = room.hostId === myPlayerId;

  const canDraw = isMyTurn && phase === "draw";
  const canDiscard = isMyTurn && phase === "discard";

  // インストラクションテキスト
  let instruction: string | null = null;
  if (isMyTurn) {
    if (phase === "draw") {
      instruction = "山札または捨て札からカードを1枚引こう！";
    } else if (phase === "discard") {
      instruction = "手札から1枚カードを捨てよう！";
    }
  }

  const handleSkipPlayer = () => {
    if (!activePlayerId) return;
    onSkipPlayer();
  };

  return (
    <div className="game-board-root">
      {/* ヘッダーゾーン（高さ10%想定） */}
      <div className="gb-header">
        <div className="gb-header-inner">
        {isHost && (
          <button
            type="button"
            className="gb-skip-button gb-skip-button--ghost"
            aria-hidden="true"
            tabIndex={-1}
          >
            <span className="gb-skip-icon">⏩️</span>
            <span className="gb-skip-label">プレイヤーをスキップ</span>
          </button>
        )}
          <div className="gb-header-title">
            {activePlayer ? (
              <>
                <span className="gb-header-player-name">
                  {activePlayerId === myPlayerId ? "あなた" : activePlayer.name}
                </span>
                <span className="gb-header-label">のターン</span>
              </>
            ) : (
              <span className="gb-header-label">
                プレイヤーのターンを待機中…
              </span>
            )}
          </div>

          {isHost && (
            <button
              type="button"
              className="gb-skip-button"
              onClick={handleSkipPlayer}
            >
              <span className="gb-skip-icon">⏩️</span>
              <span className="gb-skip-label">プレイヤーをスキップ</span>
            </button>
          )}
        </div>
      </div>

      {/* インストラクションゾーン（高さ3%想定） */}
      <div className="gb-instruction-zone">
        {instruction ? (
          <div className="gb-instruction-text">{instruction}</div>
        ) : (
          <div className="gb-instruction-placeholder" />
        )}
      </div>

      {/* 山札 + 捨て札ゾーン（PC: 横並び / モバイル: 縦並び） */}
      <div className="gb-top-zone">
        <div className="gb-top-inner">
          {/* 山札パネル */}
            <section className="gb-deck-panel">
            <div className="gb-deck-labels">
              <div className="gb-deck-title">山札</div>
              <div className="gb-deck-count">残り {deckCount} 枚</div>
            </div>

              {/* ★ 画像ボタン版の山札 */}
              <button
                type="button"
                className={
                  "gb-deck-image-wrapper" +
                  (canDraw && deckCount > 0 ? " gb-deck-image-wrapper--active" : "")
                }
                onClick={onDrawFromDeck}
                disabled={!canDraw || deckCount === 0}
              >
                <img
                  src="/images/deck.png"          // ★ 山札画像（好きなパスに変えてOK）
                  alt="山札"
                  className="gb-deck-image"
                />
                {/* ホバー時に出る白エフェクト＋手アイコン */}
                <div className="gb-deck-image-overlay">
                  <div className="gb-deck-overlay-label">一枚引く</div>
                  <img
                    src="/images/hand-pick-yellow.png"   // ★ 手のアイコン画像
                    alt=""
                    className="gb-deck-hand-icon"
                  />
                </div>
              </button>
            </section>

          {/* 捨て札ゾーン */}
          <section className="gb-discards-panel">
            <div className="gb-discards-header">捨て札</div>
            <div className="gb-discards-row">
              {players.map((p) => {
                const playerDiscards = discards[p.id] ?? [];
                const isActive = p.id === activePlayerId;

                return (
                  <div
                    key={p.id}
                    className={
                      "gb-discard-column" +
                      (isActive ? " gb-discard-column--active" : "")
                    }
                  >
                    <div className="gb-discard-player-name">
                      {p.name}
                      {isActive && (
                        <span className="gb-discard-badge">手番</span>
                      )}
                    </div>

                    <div className="gb-discard-list">
                      {playerDiscards.length === 0 && (
                        <div className="gb-discard-empty">
                          まだ捨て札はありません
                        </div>
                      )}

                      {[...playerDiscards]
                          .map((cardId, index) => ({ cardId, originalIndex: index }))
                          .reverse()
                          .map(({ cardId, originalIndex }) => {
                        const { jp, en } = getCardTexts(cardId);
                        const canPick = canDraw && playerDiscards.length > 0;

                        return (
                          <button
                            key={`${cardId}-${originalIndex}`}
                            type="button"
                            className="gb-discard-card"
                            onClick={() =>
                              onDrawFromDiscard(p.id, originalIndex)
                            }
                            disabled={!canPick}
                          >
                            <div className="gb-discard-card-jp">{jp}</div>
                            {en && (
                              <div className="gb-discard-card-en">{en}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* 手札ゾーン（高さ25%上限イメージ） */}
      <div className="gb-hand-zone">
        <div className="gb-hand-header">
          あなたの手札（{myHand.length} 枚）
          {isMyTurn && (
            <span className="gb-hand-turn-indicator">あなたのターン</span>
          )}
        </div>
        <div className="gb-hand-cards-row">
        <div className="gb-hand-cards-row">
        {Array.from({ length: 6 }).map((_, slotIndex) => {
          const cardId = myHand[slotIndex];

          // スロット用の key は slotIndex で固定
          const slotKey = `slot-${slotIndex}`;

          if (cardId == null) {
            // ★ 中身なし：枠だけのスロット
            return (
              <div
                key={slotKey}
                className="gb-hand-card-slot gb-hand-card-slot--empty"
              />
            );
          }

          // ★ 中身あり：スロットの中にボタン
          return (
            <div key={slotKey} className="gb-hand-card-slot">
              <button
                type="button"
                className={
                  "gb-hand-card-button" +
                  (canDiscard ? " gb-hand-card-button--discardable" : "")
                }
                onClick={() => onDiscard(cardId)}
                disabled={!canDiscard}
              >
                <img
                  src={getCardImageUrl(cardId)}
                  alt={`カード ${cardId}`}
                  className="gb-hand-card-image"
                />
                {/* 捨てフェーズのときだけ赤エフェクト＋ゴミ箱を重ねる */}
                {canDiscard && (
                  <div className="gb-hand-card-overlay">
                    <img
                      src="/images/trash.png"
                      alt=""
                      className="gb-hand-card-trash-icon"
                    />
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
        </div>

      </div>
    </div>
  );
}
