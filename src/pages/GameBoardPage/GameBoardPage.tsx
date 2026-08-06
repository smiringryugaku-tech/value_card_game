// src/pages/GameBoardPage/GameBoardPage.tsx
import type { CardId, Player, Room } from "../../types";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import "./GameBoardPage.css";
// パスはあなたのプロジェクトに合わせて変えてね
import { cardDict, getCardImageUrl } from "../../utils/cardInfo";

type GameBoardPageProps = {
  room: Room;
  players: Player[];
  myPlayerId: string;
  onDrawFromDeck: () => void;
  onDrawFromDiscard: (fromPlayerId: string, cardIndex: number) => void;
  onDiscard: (cardId: CardId) => void;
  onSkipPlayer: () => void;
  onTimerSetting: (seconds: number | null)=> void;
};

function getCardName(cardId: CardId): string {
  const info = (cardDict as any)[cardId];
  return info ? info.japanese : `カード ${cardId}`;
}

type FlightRect = { left: number; top: number; width: number; height: number };

type FlyingCard = {
  cardId: CardId;
  from: FlightRect;
  to: FlightRect;
  moving: boolean;
};

function rectOf(el: Element): FlightRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

// ★ 引いたカードが飛んでいく演出のタイミング（ミリ秒）
const FLIGHT_MS = 460;
const POP_MS = 550;

export function GameBoardPage({
  room,
  players,
  myPlayerId,
  onDrawFromDeck,
  onDrawFromDiscard,
  onDiscard,
  onSkipPlayer,
  onTimerSetting,
}: GameBoardPageProps) {
  const myHand = room.hands?.[myPlayerId] ?? [];
  const discards = room.discards ?? {};
  const deckCount = room.deck?.length ?? 0;

  const activePlayerId = room.activePlayerId;
  const activePlayer = players.find((p) => p.id === activePlayerId);
  const isMyTurn = activePlayerId === myPlayerId;
  const phase = room.turnPhase ?? "draw";
  const isHost = room.hostId === myPlayerId;
  const turnTimerSeconds = room.turnTimerSeconds ?? null;

  const canDraw = isMyTurn && phase === "draw";
  const canDiscard = isMyTurn && phase === "discard";

  const [isTimerDialogOpen, setIsTimerDialogOpen] = useState(false);
  const [timerOn, setTimerOn] = useState<boolean>(!!room.turnTimerSeconds);
  const [timerSecondsInput, setTimerSecondsInput] = useState<string>(
    room.turnTimerSeconds != null ? String(room.turnTimerSeconds) : "30"
  );

  useEffect(() => {
    setTimerOn(!!room.turnTimerSeconds);
    setTimerSecondsInput(
      room.turnTimerSeconds != null ? String(room.turnTimerSeconds) : "30"
    );
  }, [room.turnTimerSeconds]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // ここが true の時だけ警告したい（例: ゲーム中だけ）
      const shouldWarn = true;
      if (!shouldWarn) return;

      e.preventDefault();
      // Chrome系では returnValue の文字は無視されることが多い
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

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

  const openTimerDialog = () => {
    if (!isHost) return;
    setIsTimerDialogOpen(true);
  };

  const closeTimerDialog = () => {
    setIsTimerDialogOpen(false);
  };

  const handleTimerSave = () => {
    if (!timerOn) {
      onTimerSetting(null); // タイマー無し
    } else {
      const sec = Number(timerSecondsInput);
      const safeSec = Number.isFinite(sec) && sec > 0 ? Math.round(sec) : 30;
      onTimerSetting(safeSec);
    }
    setIsTimerDialogOpen(false);
  };

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (turnTimerSeconds == null || !activePlayerId) {
      setRemainingSeconds(null);
      return;
    }

    // 新しい手番ごとにタイマーをリセット
    const full = turnTimerSeconds;
    setRemainingSeconds(full);

    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const next = Math.max(full - elapsed, -60);
      setRemainingSeconds(next);
    }, 300);

    return () => window.clearInterval(id);
  }, [activePlayerId, room.turnIndex, turnTimerSeconds]);

  // ★ スマホ用：手札ボトムシート
  const [isHandSheetOpen, setIsHandSheetOpen] = useState(canDiscard);

  const handleSheetDiscard = (cardId: CardId) => {
    setIsHandSheetOpen(false);
    onDiscard(cardId);
  };

  // ★ 「引いたカードが手札ボタンへ飛んでいく」演出
  const handFabRef = useRef<HTMLButtonElement | null>(null);
  const handSlotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flightTimeoutRef = useRef<number | null>(null);
  const popTimeoutRef = useRef<number | null>(null);

  const [flyingCard, setFlyingCard] = useState<FlyingCard | null>(null);
  const [justLandedCardId, setJustLandedCardId] = useState<CardId | null>(null);

  useEffect(() => {
    return () => {
      if (flightTimeoutRef.current != null) window.clearTimeout(flightTimeoutRef.current);
      if (popTimeoutRef.current != null) window.clearTimeout(popTimeoutRef.current);
    };
  }, []);

  // スマホ：右下の FAB／PC：手札の該当スロット、どちらに飛ばすか
  const getFlightTargetRect = (slotIndex: number): FlightRect | null => {
    const fabEl = handFabRef.current;
    if (fabEl && window.getComputedStyle(fabEl).display !== "none") {
      return rectOf(fabEl);
    }
    const slotEl = handSlotRefs.current[slotIndex];
    return slotEl ? rectOf(slotEl) : null;
  };

  const startFlight = (
    cardId: CardId,
    originEl: HTMLElement,
    slotIndex: number
  ) => {
    const toRect = getFlightTargetRect(slotIndex);
    if (!toRect) return; // 位置が取れない場合はアニメーションだけスキップ（動作自体は通常通り）

    const fromRect = rectOf(originEl);

    if (flightTimeoutRef.current != null) window.clearTimeout(flightTimeoutRef.current);
    if (popTimeoutRef.current != null) window.clearTimeout(popTimeoutRef.current);

    setJustLandedCardId(null);
    setFlyingCard({ cardId, from: fromRect, to: toRect, moving: false });

    // 1フレーム待ってから移動先の座標に切り替えることで、CSS transition が発火する
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlyingCard((prev) => (prev ? { ...prev, moving: true } : prev));
      });
    });

    flightTimeoutRef.current = window.setTimeout(() => {
      setFlyingCard(null);
      setJustLandedCardId(cardId);
      setIsHandSheetOpen(true);

      popTimeoutRef.current = window.setTimeout(() => {
        setJustLandedCardId(null);
      }, POP_MS);
    }, FLIGHT_MS);
  };

  const handleDeckDrawClick = (e: MouseEvent<HTMLButtonElement>) => {
    const topCardId = room.deck?.[0];
    if (topCardId != null) {
      startFlight(topCardId, e.currentTarget, myHand.length);
    }
    onDrawFromDeck();
  };

  const handleDiscardDrawClick = (
    e: MouseEvent<HTMLButtonElement>,
    fromPlayerId: string,
    cardIndex: number,
    cardId: CardId
  ) => {
    startFlight(cardId, e.currentTarget, myHand.length);
    onDrawFromDiscard(fromPlayerId, cardIndex);
  };

  // 捨てフェーズに入った瞬間だけ自動で開く（その後は手動で開閉できる）
  // ただし、カードが手札ボタンへ飛んでいる最中はその演出が終わるまで開かない
  const [prevCanDiscard, setPrevCanDiscard] = useState(canDiscard);
  if (prevCanDiscard !== canDiscard) {
    setPrevCanDiscard(canDiscard);
    if (canDiscard && flyingCard === null) setIsHandSheetOpen(true);
  }

  return (
    <div className="game-board-root">
      {/* ヘッダーゾーン（高さ10%想定） */}
      <div className="gb-header">
        <div className="gb-header-inner">
          <div className="gb-header-timer-container">
            {isHost && (
              <button
                type="button"
                className="gb-timer-button"
                onClick={openTimerDialog}
              >
                <span className="gb-timer-icon">⏰</span>
                <span className="gb-timer-label">タイマーを設定</span>
              </button>
            )}
          </div>

          {/* ★ 真ん中：誰のターン + 残り時間 */}
          <div className="gb-header-title">
            {activePlayer ? (
              <>
                <span className="gb-header-player-name">
                  {activePlayerId === myPlayerId ? "あなた" : activePlayer.name}
                </span>
                <span className="gb-header-label">のターン</span>
                {turnTimerSeconds != null && remainingSeconds != null && (
                  <span
                    className={
                      "gb-header-time" +
                      (remainingSeconds <= 0 ? " gb-header-time--over" : remainingSeconds <= 5 ? " gb-header-time--danger" : "")
                    }
                  >
                    残り {remainingSeconds} 秒
                  </span>
                )}
              </>
            ) : (
              <span className="gb-header-label">
                プレイヤーのターンを待機中…
              </span>
            )}
          </div>

          <div className="gb-header-skip-button-container">
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
                onClick={handleDeckDrawClick}
                disabled={!canDraw || deckCount === 0}
              >
                <img
                  src="/images/deck_ryugakusai.png"          // ★ 山札画像（好きなパスに変えてOK）
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
                        const cardName = getCardName(cardId);
                        const canPick = canDraw && playerDiscards.length > 0;

                        return (
                          <button
                            key={`${cardId}-${originalIndex}`}
                            type="button"
                            className="gb-discard-card"
                            onClick={(e) =>
                              handleDiscardDrawClick(e, p.id, originalIndex, cardId)
                            }
                            disabled={!canPick}
                          >
                            <div className="gb-discard-card-jp">{cardName}</div>
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

          const setSlotRef = (el: HTMLDivElement | null) => {
            handSlotRefs.current[slotIndex] = el;
          };

          if (cardId == null) {
            // ★ 中身なし：枠だけのスロット
            return (
              <div
                key={slotKey}
                ref={setSlotRef}
                className="gb-hand-card-slot gb-hand-card-slot--empty"
              />
            );
          }

          // 飛んでいる最中のカードは、着地演出と入れ替わるまで実体を隠す
          const isIncoming = flyingCard?.cardId === cardId;
          const isJustLanded = justLandedCardId === cardId;

          // ★ 中身あり：スロットの中にボタン
          return (
            <div key={slotKey} ref={setSlotRef} className="gb-hand-card-slot">
              {!isIncoming && (
                <button
                  type="button"
                  className={
                    "gb-hand-card-button" +
                    (canDiscard ? " gb-hand-card-button--discardable" : "") +
                    (isJustLanded ? " gb-hand-card-button--pop" : "")
                  }
                  onClick={() => onDiscard(cardId)}
                  disabled={!canDiscard}
                >
                  <img
                    src={getCardImageUrl(cardId)}
                    alt={getCardName(cardId)}
                    className="gb-hand-card-image"
                    draggable={false}
                  />
                  {/* 捨てフェーズのときだけ赤エフェクト */}
                  {canDiscard && (
                    <div className="gb-hand-card-overlay" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
        </div>

      </div>

      {/* ★ スマホ用：手札を開く FAB */}
      <button
        type="button"
        ref={handFabRef}
        className={
          "gb-hand-fab" + (canDiscard ? " gb-hand-fab--discard" : "")
        }
        onClick={() => setIsHandSheetOpen(true)}
      >
        <span className="gb-hand-fab-icon">🃏</span>
        <span className="gb-hand-fab-label">
          {canDiscard ? "カードを捨てる" : "手札を見る"}
        </span>
        <span className="gb-hand-fab-count">{myHand.length}</span>
      </button>

      {/* ★ 引いたカードが飛んでいく演出用のゴースト */}
      {flyingCard && (
        <img
          src={getCardImageUrl(flyingCard.cardId)}
          alt=""
          aria-hidden="true"
          className="gb-flying-card"
          style={{
            left: (flyingCard.moving ? flyingCard.to.left : flyingCard.from.left) + "px",
            top: (flyingCard.moving ? flyingCard.to.top : flyingCard.from.top) + "px",
            width: (flyingCard.moving ? flyingCard.to.width : flyingCard.from.width) + "px",
            height: (flyingCard.moving ? flyingCard.to.height : flyingCard.from.height) + "px",
            opacity: flyingCard.moving ? 0.1 : 1,
          }}
        />
      )}

      {/* ★ スマホ用：手札ボトムシート */}
      {isHandSheetOpen && (
        <div
          className="gb-hand-sheet-backdrop"
          onClick={() => setIsHandSheetOpen(false)}
        >
          <div
            className="gb-hand-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gb-hand-sheet-handle" />

            <div className="gb-hand-sheet-head">
              <span className="gb-hand-sheet-title">あなたの手札</span>
              <span className="gb-hand-sheet-count">{myHand.length} 枚</span>
              <button
                type="button"
                className="gb-hand-sheet-close"
                onClick={() => setIsHandSheetOpen(false)}
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <div
              className={
                "gb-hand-sheet-note" +
                (canDiscard ? " gb-hand-sheet-note--discard" : "")
              }
            >
              {canDiscard
                ? "捨てるカードをタップ"
                : canDraw
                ? "先に山札か捨て札から1枚引こう"
                : "いまは他のプレイヤーの手番です"}
            </div>

            <div className="gb-hand-sheet-grid">
              {Array.from({ length: 6 }).map((_, slotIndex) => {
                const cardId = myHand[slotIndex];
                const slotKey = `sheet-slot-${slotIndex}`;

                if (cardId == null) {
                  return (
                    <div
                      key={slotKey}
                      className="gb-sheet-card gb-sheet-card--empty"
                    />
                  );
                }

                const isJustLanded = justLandedCardId === cardId;

                return (
                  <button
                    key={slotKey}
                    type="button"
                    className={
                      "gb-sheet-card" +
                      (canDiscard ? " gb-sheet-card--discardable" : "") +
                      (isJustLanded ? " gb-sheet-card--pop" : "")
                    }
                    onClick={() => handleSheetDiscard(cardId)}
                    disabled={!canDiscard}
                  >
                    <img
                      src={getCardImageUrl(cardId)}
                      alt={getCardName(cardId)}
                      className="gb-sheet-card-image"
                      draggable={false}
                    />
                    {canDiscard && (
                      <span className="gb-sheet-card-action">捨てる</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ★ タイマー設定ダイアログ */}
    {isTimerDialogOpen && (
      <div className="gb-timer-dialog-backdrop" onClick={closeTimerDialog}>
        <div
          className="gb-timer-dialog"
          onClick={(e) => e.stopPropagation()} // 中身クリックで閉じないように
        >
          <div className="gb-timer-dialog-title">⏰ タイマー設定</div>

          <label className="gb-timer-toggle">
            <input
              type="checkbox"
              checked={timerOn}
              onChange={(e) => setTimerOn(e.target.checked)}
            />
            <span>タイマーを使う</span>
          </label>

          <label className="gb-timer-seconds-label">
            <span>制限時間（秒）</span>
            <input
              type="number"
              min={5}
              max={600}
              step={5}
              value={timerSecondsInput}
              onChange={(e) => setTimerSecondsInput(e.target.value)}
              disabled={!timerOn}
              className="gb-timer-seconds-input"
            />
          </label>

          <div className="gb-timer-dialog-actions">
            <button type="button" onClick={closeTimerDialog}>
              キャンセル
            </button>
            <button type="button" onClick={handleTimerSave}>
              保存
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
