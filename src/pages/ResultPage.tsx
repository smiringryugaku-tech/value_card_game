// src/pages/ResultPage.tsx
import type { Player, Room } from "../types";

type ResultPageProps = {
  room: Room;
  players: Player[];
};

export function ResultPage({ room, players }: ResultPageProps) {
  const hands = room.hands ?? {};

  return (
    <div style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
      <h2 style={{ marginBottom: "0.5rem" }}>ゲーム結果</h2>
      <p style={{ marginTop: 0, marginBottom: "1.5rem" }}>
        最後に各プレイヤーが持っていたカードです。
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        {players.map((p) => {
          const playerHand = hands[p.id] ?? [];
          return (
            <div
              key={p.id}
              style={{
                flex: "1 1 200px",
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: "0.75rem",
                backgroundColor: "#fafafa",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
                {p.name}
              </h3>
              {playerHand.length === 0 ? (
                <p style={{ margin: 0, color: "#888" }}>カードなし</p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  {playerHand.map((cardId) => (
                    <span
                      key={cardId}
                      style={{
                        padding: "0.4rem 0.6rem",
                        borderRadius: 6,
                        border: "1px solid #ccc",
                        backgroundColor: "#fff",
                        fontSize: "0.9rem",
                      }}
                    >
                      {cardId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
