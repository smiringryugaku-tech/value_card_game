// src/pages/ResultPage/ResultPage.tsx
import { useEffect, useState } from "react";
import "./ResultPage.css";
import type { Room, Player, CardId } from "../../types";
import { cardDict } from "../../utils/cardInfo";
import { analyzeWithGemini } from "../../api/analyze";
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

export function ResultPage({ room, players, myPlayerId, onPlayAgain }: ResultPageProps) {
  const [isNarrow, setIsNarrow] = useState(false);
  type AnalyzeStatus = "idle" | "running" | "done" | "error";

  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>("idle");
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analysisImageUrl, setAnalysisImageUrl] = useState<string | null>(null);
  const [analysisImagePath, setAnalysisImagePath] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const roomId = (room as any).id ?? (room as any).code;

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

  const handleAnalyze = async () => {
    // すでに完了してたら、モーダルを開くだけ
    if (analyzeStatus === "done" && analysisImageUrl) {
      setIsModalOpen(true);
      return;
    }
  
    try {
      setAnalyzeStatus("running");
      setAnalyzeMsg("分析しています...（30〜60秒くらいかかることがあります）");
  
      // ここで callable 呼ぶ（例）
      const data = await analyzeWithGemini(roomId, myPlayerId);
  
      setAnalysisImageUrl(data.imageUrl ?? null);
      setAnalysisImagePath(data.imagePath ?? null);
      setAnalysisText(data.result?.analysis ?? null);
  
      setAnalyzeStatus("done");
      setAnalyzeMsg("分析が完了しました！「分析結果を見る」から確認できます。");
      setIsModalOpen(true); // 完了したら自動で開くのも気持ちいい
    } catch (e: any) {
      console.error(e);
      setAnalyzeStatus("error");
      setAnalyzeMsg("分析に失敗しました。もう一度お試しください。\n解決しない場合はカスタマーサポートにお問い合わせください。");
    }
  };

  const analyzeButtonLabel =
  analyzeStatus === "running" ? "分析中..." :
  analyzeStatus === "done" ? "分析結果を見る" :
  analyzeStatus === "error" ? "再試行" :
  "AI分析";

  const analyzeButtonDisabled = analyzeStatus === "running";

  const handleDownload = async () => {
    try {
      console.log("[DL] start", { analysisImagePath, roomId, myPlayerId });
  
      if (!analysisImagePath) {
        console.warn("[DL] no analysisImagePath");
        return;
      }
  
      const filename = `value_sheet_${roomId}_${myPlayerId}.png`;
      console.log("[DL] calling getValueSheetDownloadUrl", { imagePath: analysisImagePath, filename });
  
      const res = await getDownloadUrlFn({ imagePath: analysisImagePath, filename });
  
      console.log("[DL] callable raw res", res);
      console.log("[DL] callable res.data", res.data);
  
      const url = (res.data as any)?.url as string | undefined;
      if (!url) throw new Error("download url missing");
  
      console.log("[DL] url", url);
  
      // ブロックされると null が返ることが多い
      const w = window.open(url, "_blank", "noopener,noreferrer");
      console.log("[DL] window.open result", w);
  
      if (!w) {
        console.warn("[DL] window.open blocked; fallback to same-tab redirect");
        window.location.assign(url);
      }
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
    ]
      .filter(Boolean)
      .join(" ");
  
    if (cardId == null) {
      return <div key={key} className={baseClass} />;
    }
  
    return (
      <div key={key} className={baseClass}>
        <div className="result-my-card-text">{getCardName(cardId)}</div>
      </div>
    );
  };

  // ★ 他プレイヤー用のカードスロット描画（少し小さめ）
  const renderOtherSlot = (cardId: CardId | null, key: string, variant: SlotVariant) => {
    const baseClass = [
      "result-other-card-slot",
      variant === "single" ? "result-other-card-slot--single": "",
      cardId == null ? "result-other-card-slot--empty" : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (cardId == null) {
      return <div key={key} className={baseClass} />;
    }

    return (
      <div key={key} className={baseClass}>
        <div className="result-other-card-text">{getCardName(cardId)}</div>
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
          disabled={analyzeButtonDisabled}
        >
          {analyzeStatus === "running" && <span className="mini-spinner" />}
          {analyzeButtonLabel}
        </button>
      </div>

      <div className="analyze-msg-container">
        {analyzeMsg && (
          <div className={`analyze-msg analyze-msg--${analyzeStatus}`}>
            {analyzeMsg}
          </div>
        )}
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

      {/* ★ 他プレイヤーもカードで表示 */}
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
                  <span className="result-other-header-suffix">
                    の価値観
                  </span>
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
      <div className="bottom-spacer"/>
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
