// src/pages/GameBoardPage.tsx
import type { CardId, Player, Room } from "../types";

type GameBoardPageProps = {
  room: Room;
  players: Player[];
  myPlayerId: string;
  onDrawFromDeck: () => void;
  onDrawFromDiscard: (fromPlayerId: string) => void;
  onDiscard: (cardId: CardId) => void;
};

export function GameBoardPage({
  room,
  players,
  myPlayerId,
  onDrawFromDeck,
  onDrawFromDiscard,
  onDiscard,
}: GameBoardPageProps) {
  const myHand = room.hands?.[myPlayerId] ?? [];
  const discards = room.discards ?? {};
  const deckCount = room.deck?.length ?? 0;

  const activePlayerId = room.activePlayerId;
  const activePlayer = players.find((p) => p.id === activePlayerId);
  const isMyTurn = activePlayerId === myPlayerId;
  const phase = room.turnPhase ?? "draw";

  // ★ フェーズと自分のターンかどうかでボタン制御
  const canDraw = isMyTurn && phase === "draw";
  const canDiscard = isMyTurn && phase === "discard";

  return (
    <div style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
      {/* 上部：現在のターン表示 */}
      <header style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginBottom: "0.25rem" }}>ゲームボード</h2>
        <p style={{ margin: 0 }}>
          今は{" "}
          <strong>{activePlayer?.name ?? "（プレイヤー未決定）"}</strong>
          {" "}のターンです！
          {typeof room.turnIndex === "number" && (
            <span style={{ marginLeft: "0.75rem", fontSize: "0.9rem" }}>
              （ターン {room.turnIndex + 1}）
            </span>
          )}
        </p>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>
          山札の残り枚数：{deckCount} 枚
        </p>
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>
          フェーズ：{phase === "draw" ? "カードを引く" : "カードを捨てる"}
        </p>
      </header>

      {/* プレイヤー一覧＋捨て札 */}
      <section style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            overflowX: "auto",
            paddingBottom: "0.5rem",
          }}
        >
          {players.map((p) => {
            const playerDiscards = discards[p.id] ?? [];
            const topCard =
              playerDiscards.length > 0
                ? playerDiscards[playerDiscards.length - 1]
                : null;
            const isActive = p.id === activePlayerId;

            return (
              <div
                key={p.id}
                style={{
                  minWidth: 140,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  padding: "0.5rem 0.75rem",
                  backgroundColor: isActive ? "#ffe" : "#fafafa",
                  flexShrink: 0,
                }}
              >
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>{p.name}</strong>
                  {isActive && (
                    <span
                      style={{
                        marginLeft: "0.5rem",
                        fontSize: "0.8rem",
                        color: "#c60",
                      }}
                    >
                      （手番）
                    </span>
                  )}
                </div>

                <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                  捨て札：
                  {playerDiscards.length === 0 && (
                    <span style={{ color: "#888" }}>まだありません</span>
                  )}
                </div>

                <div
                  style={{
                    maxHeight: 120,
                    overflowY: "auto",
                    border: "1px solid #eee",
                    borderRadius: 4,
                    padding: "0.25rem",
                    fontSize: "0.8rem",
                    backgroundColor: "#fff",
                  }}
                >
                  {playerDiscards.map((cardId, idx) => (
                    <div key={idx}>カード {cardId}</div>
                  ))}
                </div>

                {topCard !== null && (
                  <button
                    style={{
                      marginTop: "0.5rem",
                      width: "100%",
                      fontSize: "0.8rem",
                    }}
                    onClick={() => onDrawFromDiscard(p.id)}
                    // ★ 自分のターン & draw フェーズのときだけ押せる
                    disabled={!canDraw}
                  >
                    この山の一番上を引く（カード {topCard}）
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 下部：自分の手札＋山札から引くボタン */}
      <section>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          {/* 山札エリア */}
          <div
            style={{
              minWidth: 180,
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: "0.75rem",
              backgroundColor: "#f8f8f8",
            }}
          >
            <p style={{ marginTop: 0, marginBottom: "0.5rem" }}>
              山札（残り {deckCount} 枚）
            </p>
            <button
              onClick={onDrawFromDeck}
              // ★ draw フェーズ & 自分のターン & 山札が残っているときだけ
              disabled={!canDraw || deckCount === 0}
              style={{ width: "100%" }}
            >
              山札から 1 枚引く
            </button>
            {!isMyTurn && (
              <p
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.8rem",
                  color: "#888",
                }}
              >
                自分のターンになるまで待ってください。
              </p>
            )}
          </div>

          {/* 自分の手札エリア */}
          <div style={{ flexGrow: 1, minWidth: 260 }}>
            <p style={{ marginTop: 0, marginBottom: "0.5rem" }}>
              あなたの手札（{myHand.length} 枚）
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {myHand.map((cardId) => (
                <button
                  key={cardId}
                  onClick={() => onDiscard(cardId)}
                  // ★ discard フェーズ & 自分のターンだけ捨てられる
                  disabled={!canDiscard}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    backgroundColor: canDiscard ? "#fff" : "#eee",
                    cursor: canDiscard ? "pointer" : "default",
                  }}
                >
                  {cardId}
                </button>
              ))}
              {myHand.length === 0 && (
                <span style={{ color: "#888", fontSize: "0.9rem" }}>
                  手札がありません。
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
