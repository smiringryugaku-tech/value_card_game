// src/pages/LobbyPage/LobbyPage.tsx
import { useEffect, useState } from "react";
import { IoCopyOutline } from "react-icons/io5";
import "./LobbyPage.css";
import type { Player } from "../../types";

type LobbyPageProps = {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  cardCount: number;
  onCardCountChange: (next: number) => void;
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
  const [isNarrow, setIsNarrow] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setIsNarrow(window.innerWidth < 720);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const population = players.length;

  const handleCopyInvite = async () => {
    if (!roomCode) return;
  
    // 招待リンクをここで定義（パラメータ名は好きなので OK）
    const inviteUrl = `「❤️‍🔥価値観カードゲーム」であなたの人生にとって大切な5つの価値観を一緒に見つけましょう！🌈✨\n\nゲームリンク：${window.location.origin}\nルームコード：${roomCode}`;
  
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyToast("招待リンクをコピーしました！");
      setTimeout(() => setCopyToast(null), 2000); // 2秒で消す
    } catch (err) {
      console.error("クリップボードコピーに失敗:", err);
      setCopyToast("コピーに失敗しました。手動でコピーしてください。");
      setTimeout(() => setCopyToast(null), 3000);
    }
  };

  // 2列用に分割（最大10人まで想定：左に5人、右に5人）
  const maxPerColumn = 5;
  const leftColumn = players.slice(0, maxPerColumn);
  const rightColumn = players.slice(maxPerColumn, maxPerColumn * 2);
  const isTwoColumn = !isNarrow && players.length > maxPerColumn;


  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    onCardCountChange(value);
  };

  return (
    <div className="lobby-root">
      {/* ===== 上部：アイコン＋メッセージ ===== */}
      <section className="lobby-header">
        <div className="lobby-icon">⏳</div>
        <div className="lobby-wait-text">
          <span className="lobby-wait-main">プレイヤー待機中...</span>
          <span className="lobby-wait-count">
            （現在 {population} 人）
          </span>
          <div className="lobby-room-code-row">
            <span className="lobby-room-code">
              ルームコード：{roomCode}
            </span>
            <button
              type="button"
              className="invitation-copy-button"
              onClick={handleCopyInvite}
            >
              <IoCopyOutline size={15}/>
            </button>
          </div>
        </div>

        <div className="lobby-host-message">
          {isHost ? (
            <>あなたはこのルームのホストです。</>
          ) : (
            <>ホストがゲームを開始するまでお待ちください。</>
          )}
        </div>
        {copyToast && (
          <div className="lobby-copy-toast">
            {copyToast}
          </div>
        )}
      </section>

      {/* ===== プレイヤーリスト（高さは画面依存、中身の表示だけ変える） ===== */}
      <section className="lobby-players-section">
        <div className={"lobby-players-panel " + (isTwoColumn ? "lobby-players-panel--wide" : "lobby-players-panel--normal")}>
          <div className="lobby-players-title">参加プレイヤー</div>

                    {/* 横幅広い & 6人以上なら 2 列、それ以外は 1 列 */}
                    {isTwoColumn ? (
            // ===== ケース A: 2列モード =====
            <div className="lobby-players-columns">
              {/* 左列（最大5人） */}
              <div className="lobby-player-column">
                {Array.from({ length: maxPerColumn }).map((_, i) => {
                  const p = leftColumn[i];
                  return (
                    <div key={`left-${i}`} className="lobby-player-slot">
                      <span className="lobby-player-name">
                        {p ? p.name : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 右列（6人目以降、最大5人） */}
              <div className="lobby-player-column">
                {Array.from({ length: maxPerColumn }).map((_, i) => {
                  const p = rightColumn[i];
                  return (
                    <div key={`right-${i}`} className="lobby-player-slot">
                      <span className="lobby-player-name">
                        {p ? p.name : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : players.length <= maxPerColumn ? (
            // ===== ケース B: 1〜5人 → 1列固定5スロット（きっちり 1/5 ずつ） =====
            <div className="lobby-players-single-wrapper">
              <div className="lobby-players-single-fixed">
                {Array.from({ length: maxPerColumn }).map((_, i) => {
                  const p = players[i];
                  return (
                    <div key={`single-fixed-${i}`} className="lobby-player-slot">
                      <span className="lobby-player-name">
                        {p ? p.name : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // ===== ケース C: 6人以上 & 1列（狭い画面など） → 縦スクロール =====
            <div className="lobby-players-single-wrapper">
              <div className="lobby-players-single-scroll-list">
                {players.map((p, i) => (
                  <div key={`single-scroll-${i}`} className="lobby-player-slot">
                    <span className="lobby-player-name">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== ホスト設定（ホストのみ） ===== */}
      {isHost && (
        <section className="lobby-host-section">
          <div className="lobby-host-title">ホスト設定</div>

          <div className="lobby-cardcount-row">
            <div className="lobby-cardcount-label">
              配るカードの枚数
            </div>
            <div className="lobby-cardcount-value">{cardCount} 枚</div>
          </div>

          <input
            type="range"
            min={20}
            max={70}
            step={1}
            value={cardCount}
            onChange={handleSliderChange}
            className="lobby-card-slider"
          />

          <div className="lobby-card-slider-scale">
            <span>20</span>
            <span>70</span>
          </div>

          <button
            type="button"
            className="lobby-start-button"
            onClick={onStartGame}
          >
            ▶ ゲーム開始
          </button>
        </section>
      )}
    </div>
  );
}
