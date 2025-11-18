// src/pages/TitlePage.tsx
import { type FormEvent, useState } from "react";
import type { Mode } from "../types";

type TitlePageProps = {
  onSubmit: (name: string, mode: Mode) => void;
};

export function TitlePage({ onSubmit }: TitlePageProps) {
  const [name, setName] = useState("");
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedMode) return;
    onSubmit(name.trim(), selectedMode);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>価値観カードゲーム！</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label>
            名前：
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ marginLeft: "0.5rem" }}
              placeholder="プレイヤー名を入力"
            />
          </label>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <p>モードを選んでください：</p>
          <label style={{ marginRight: "1rem" }}>
            <input
              type="radio"
              name="mode"
              value="create"
              checked={selectedMode === "create"}
              onChange={() => setSelectedMode("create")}
            />
            ルームを作成
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="join"
              checked={selectedMode === "join"}
              onChange={() => setSelectedMode("join")}
            />
            ルームに入る
          </label>
        </div>

        <button type="submit" disabled={!name.trim() || !selectedMode}>
          つぎへ
        </button>
      </form>
    </div>
  );
}
