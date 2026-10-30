import { useEffect, useRef, useState } from "react";
import { actionLabels } from "../../types/ai";
import type { AiAction } from "../../types/ai";
import type { PdfSelection } from "../../types/selection";
import { streamOllama } from "../../services/ai/ollama";

function AiResult({ action, text, before, after, question, model }: {
  action: AiAction; text: string; before: string; after: string; question: string; model: string;
}) {
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"loading" | "streaming" | "ready" | "stopped" | "error">("loading");
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    let active = true;
    void streamOllama({ action, excerpt: { cleanedText: text, context: { before, after } }, question, model,
      baseUrl: import.meta.env.VITE_OLLAMA_BASE_URL || "/ollama", signal: controller.signal,
      onText: (part) => {
        if (!active || controller.signal.aborted) return;
        setAnswer((value) => value + part); setStatus("streaming");
      },
    }).then(() => { if (active && !controller.signal.aborted) setStatus("ready"); })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Không thể nhận phản hồi AI."); setStatus("error");
      });
    return () => { active = false; controller.abort(); };
  }, [action, text, before, after, question, model]);
  const busy = status === "loading" || status === "streaming";
  return <div aria-busy={busy}>
    <p role="status" aria-live="polite">{status === "loading" ? "Đang kết nối / nạp model Ollama…"
      : status === "streaming" ? "Đang nhận phản hồi…" : status === "stopped" ? "Đã dừng. Giữ lại phần đã nhận."
      : status === "ready" ? "Đã hoàn tất." : "Yêu cầu không hoàn tất."}</p>
    {answer && <div className="ai-answer" data-testid="ai-answer">{answer}</div>}
    {error && <p role="alert">{error}</p>}
    {busy && <button onClick={() => { controllerRef.current?.abort(); setStatus("stopped"); }}>Dừng</button>}
  </div>;
}

export default function AiPanel({ selection, action, onClose }: {
  selection: PdfSelection; action: AiAction; onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [model, setModel] = useState(import.meta.env.VITE_OLLAMA_MODEL || "qwen3:8b");
  const [requestedModel, setRequestedModel] = useState(model);
  return <section className="ai-panel" aria-label="Trợ lý AI" data-selection-controls>
    <div className="ai-panel-heading">
      <strong>{actionLabels[action]} · Trang {selection.pageNumber}</strong>
      <button onClick={onClose} aria-label="Đóng panel AI">Đóng</button>
    </div>
    <small>Ollama trên máy của bạn · {requestedModel}</small>
    <blockquote data-testid="ai-selected-text">{selection.cleanedText}</blockquote>
    <details>
      <summary>Model Ollama</summary>
      <label htmlFor="ollama-model">Tên model đã cài</label>
      <div className="ai-question-row">
        <input id="ollama-model" value={model} maxLength={100} onChange={(event) => setModel(event.target.value)} />
        <button disabled={!model.trim()} onClick={() => { setRequestedModel(model.trim()); setAttempt((n) => n + 1); }}>Áp dụng</button>
      </div>
    </details>
    {action === "ask" && <form onSubmit={(event) => {
      event.preventDefault();
      if (question.trim()) { setSubmitted(question.trim()); setRequestedModel(model.trim()); setAttempt((n) => n + 1); }
    }}>
      <label htmlFor="ai-question">Câu hỏi về đoạn đã chọn</label>
      <div className="ai-question-row">
        <input id="ai-question" value={question} maxLength={2000} onChange={(event) => setQuestion(event.target.value)} placeholder="Bạn muốn tìm hiểu điều gì?" />
        <button disabled={!question.trim() || !model.trim()}>Gửi</button>
      </div>
    </form>}
    {(action !== "ask" || submitted) && <>
      <AiResult key={`${attempt}-${requestedModel}`} action={action} text={selection.cleanedText}
        before={selection.context.before} after={selection.context.after} question={submitted} model={requestedModel} />
      <button onClick={() => setAttempt((n) => n + 1)}>Thử lại</button>
    </>}
  </section>;
}
