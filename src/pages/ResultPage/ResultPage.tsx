// src/pages/ResultPage/ResultPage.tsx
import { useEffect, useRef, useState } from "react";
import "./ResultPage.css";
import type { Room, Player, CardId } from "../../types";
import { cardDict } from "../../utils/cardInfo";
import { analyzeWithGemini, buildValueSheet } from "../../api/analyze";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";

const getDownloadUrlFn = httpsCallable(functions, "getValueSheetDownloadUrl");

type ResultPageProps = {
  room: Room;
  players: Player[];
  myPlayerId: string;
  onPlayAgain: () => void;
};

function getCardName(cardId: CardId): string {
  const info = (cardDict as any)[cardId];
  return info ? info.japanese : `カード ${cardId}`;
}

type AnalyzePhase = "idle" | "phase1" | "phase2" | "done" | "error";

const PHASE1_MESSAGES = [
  "AIがカードを読み取っています...",
  "あなたの思考パターンを読み取っています…",
  "留学価値観を分析しています…",
];
const PHASE2_MESSAGES = [
  "分析結果をまとめています…",
  "画像を生成しています…",
  "留学タイプを分類しています…",
];

export function ResultPage({ room, players, myPlayerId, onPlayAgain }: ResultPageProps) {
  const [isNarrow, setIsNarrow] = useState(false);
  const [analyzePhase, setAnalyzePhase] = useState<AnalyzePhase>("idle");
  const [analyzeErrorMsg, setAnalyzeErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analysisImageUrl, setAnalysisImageUrl] = useState<string | null>(null);
  const [analysisImagePath, setAnalysisImagePath] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);

  const roomId = (room as any).id ?? (room as any).code;

  // progress bar fake increment
  useEffect(() => {
    if (analyzePhase !== "phase1" && analyzePhase !== "phase2") return;
    const cap = analyzePhase === "phase1" ? 48 : 96;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= cap) return p;
        return Math.min(cap, p + Math.max(0.4, (cap - p) * 0.05));
      });
    }, 400);
    return () => clearInterval(id);
  }, [analyzePhase]);

  // message rotation
  const msgIndexRef = useRef(0);
  useEffect(() => {
    if (analyzePhase !== "phase1" && analyzePhase !== "phase2") return;
    msgIndexRef.current = 0;
    setMsgIndex(0);
    const id = setInterval(() => {
      msgIndexRef.current = (msgIndexRef.current + 1) % 3;
      setMsgIndex(msgIndexRef.current);
    }, 2000);
    return () => clearInterval(id);
  }, [analyzePhase]);

  useEffect(() => {
    if (analyzePhase === "phase2") setProgress(50);
    if (analyzePhase === "done") setProgress(100);
  }, [analyzePhase]);

  useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < 720);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const myHand = (room.hands?.[myPlayerId] ?? []).slice(0, 5);
  const myPlayer = players.find((p) => p.id === myPlayerId);
  const myName = myPlayer?.name ?? "あなた";
  const otherPlayers = players.filter((p) => p.id !== myPlayerId);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleAnalyze = async () => {
    if (analyzePhase === "done" && analysisImageUrl) {
      setIsModalOpen(true);
      return;
    }

    try {
      setAnalyzeErrorMsg(null);
      setProgress(0);
      setAnalyzePhase("phase1");

      // ステップ1: AI分析
      const step1 = await analyzeWithGemini(roomId, myPlayerId);

      if (step1.fromCache) {
        setAnalysisImageUrl(step1.imageUrl);
        setAnalysisImagePath(step1.imagePath);
        setAnalyzePhase("done");
        setIsModalOpen(true);
        return;
      }

      // ステップ2: 画像生成
      setAnalyzePhase("phase2");
      const step2 = await buildValueSheet(roomId, myPlayerId, step1.stepData);

      setAnalysisImageUrl(step2.imageUrl);
      setAnalysisImagePath(step2.imagePath);
      setAnalysisText(step2.result?.analysis ?? null);
      setAnalyzePhase("done");
      setIsModalOpen(true);
    } catch (e: any) {
      console.error(e);
      setAnalyzePhase("error");
      setAnalyzeErrorMsg(
        "分析に失敗しました。もう一度お試しください。\n解決しない場合はカスタマーサポートにお問い合わせください。"
      );
    }
  };

  const isRunning = analyzePhase === "phase1" || analyzePhase === "phase2";
  const analyzeButtonLabel =
    isRunning ? "分析中..." :
    analyzePhase === "done" ? "分析結果を見る" :
    analyzePhase === "error" ? "再試行" :
    "AI分析";

  const currentMessage =
    analyzePhase === "phase1" ? PHASE1_MESSAGES[msgIndex] :
    analyzePhase === "phase2" ? PHASE2_MESSAGES[msgIndex] :
    null;

  const handleDownload = async () => {
    try {
      if (!analysisImagePath) return;
      const filename = `value_sheet_${roomId}_${myPlayerId}.png`;
      const res = await getDownloadUrlFn({ imagePath: analysisImagePath, filename });
      const url = (res.data as any)?.url as string | undefined;
      if (!url) throw new Error("download url missing");
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) window.location.assign(url);
    } catch (e) {
      console.error("[DL] failed", e);
      alert(String(e));
    }
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
    ].filter(Boolean).join(" ");

    if (cardId == null) return <div key={key} className={baseClass} />;
    return (
      <div key={key} className={baseClass}>
        <div className="result-my-card-text">{getCardName(cardId)}</div>
      </div>
    );
  };

  const renderOtherSlot = (cardId: CardId | null, key: string, variant: SlotVariant) => {
    const baseClass = [
      "result-other-card-slot",
      variant === "single" ? "result-other-card-slot--single" : "",
      cardId == null ? "result-other-card-slot--empty" : "",
    ].filter(Boolean).join(" ");

    if (cardId == null) return <div key={key} className={baseClass} />;
    return (
      <div key={key} className={baseClass}>
        <div className="result-other-card-text">{getCardName(cardId)}</div>
      </div>
    );
  };

  return (
    <div className="result-root">
      <div className="result-actions-row">
        <button type="button" className="result-btn result-btn-primary" onClick={onPlayAgain}>
          もう一度遊ぶ
        </button>
        <button
          type="button"
          className="result-btn result-btn-secondary"
          onClick={handleAnalyze}
          disabled={isRunning}
        >
          {isRunning && <span className="mini-spinner" />}
          {analyzeButtonLabel}
        </button>
      </div>

      {/* プログレスバー + メッセージ */}
      {(isRunning || analyzePhase === "done") && (
        <div className="analyze-progress-container">
          <div className="analyze-progress-bar-track">
            <div
              className="analyze-progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          {currentMessage && (
            <div className="analyze-progress-message">{currentMessage}</div>
          )}
        </div>
      )}

      {analyzePhase === "error" && analyzeErrorMsg && (
        <div className="analyze-msg analyze-msg--error">{analyzeErrorMsg}</div>
      )}

      <section className="result-header">
        <div className="result-header-main">🎉 結果発表 ✨</div>
        <div className="result-header-sub">
          あなたの留学における大切な5つの価値観
        </div>
      </section>

      <section className="result-my-values">
        <div className="result-my-panel">
          <div className="result-my-title">
            <strong>{myName}</strong> の価値観
          </div>

          {isNarrow ? (
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
            <div className="result-my-card-row result-my-card-row--single">
              {mySlots.map((cardId, idx) =>
                renderSlot(cardId, `single-${idx}`, "single")
              )}
            </div>
          )}
        </div>
      </section>

      <section className="result-others">
        <div className="result-section-title">他のプレイヤーの価値観</div>
        <div className="result-others-scroll">
          {otherPlayers.map((p) => {
            const hand = (room.hands?.[p.id] ?? []).slice(0, 5);
            const slots: Array<CardId | null> = Array.from(
              { length: 5 },
              (_, i) => hand[i] ?? null
            );
            return (
              <div key={p.id} className="result-other-column">
                <div className="result-other-header">
                  <strong className="result-other-name">{p.name}</strong>
                  <span className="result-other-header-suffix">の価値観</span>
                </div>
                <div className="result-other-cards">
                  {isNarrow ? (
                    <>
                      <div className="result-other-card-row">
                        {slots.slice(0, 3).map((cardId, idx) =>
                          renderOtherSlot(cardId, `${p.id}-row1-${idx}`, "multi")
                        )}
                      </div>
                      <div className="result-other-card-row">
                        {slots.slice(3).map((cardId, idx) =>
                          renderOtherSlot(cardId, `${p.id}-row2-${idx}`, "multi")
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="result-other-card-row result-other-card-row--single">
                      {slots.map((cardId, idx) =>
                        renderOtherSlot(cardId, `${p.id}-single-${idx}`, "single")
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="bottom-spacer" />

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">AI分析結果</div>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            {analysisImageUrl ? (
              <img className="modal-image" src={analysisImageUrl} alt="AI分析結果" />
            ) : (
              <div className="modal-empty">画像がまだありません</div>
            )}

            <div className="modal-actions">
              <button
                className="result-btn result-btn-primary"
                onClick={handleDownload}
                disabled={!analysisImagePath}
              >
                ダウンロード
              </button>
              <button
                className="result-btn result-btn-secondary"
                onClick={() => setIsModalOpen(false)}
              >
                閉じる
              </button>
            </div>

            {analysisText && (
              <pre className="modal-text">{analysisText}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
