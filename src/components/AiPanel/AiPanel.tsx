import { useEffect, useRef, useState } from "react";
import { actionLabels } from "../../types/ai";
import type { AiAction } from "../../types/ai";
import type { PdfSelection } from "../../types/selection";
import { streamGemini } from "../../services/ai/gemini";
import { AiRequestError, aiErrorTitle, formatWait } from "../../../shared/ai/errors.ts";
import type { SaveStudyEntry } from "../../types/study";
import SaveEntryForm, { CopyButton } from "../Study/SaveEntryForm";

function AiResult({ action, text, before, after, question, pageNumber, onSave, onRetry }: {
  action: AiAction; text: string; before: string; after: string; question: string;
  pageNumber: number; onSave: SaveStudyEntry | null; onRetry: () => void;
}) {
  const [model, setModel] = useState("Gemini");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"loading" | "streaming" | "ready" | "stopped" | "error">("loading");
  const [error, setError] = useState<AiRequestError | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    let active = true;
    void streamGemini({ action, excerpt: { cleanedText: text, context: { before, after } }, question,
      baseUrl: import.meta.env.VITE_AI_API_URL || "", signal: controller.signal, onModel: setModel,
      onText: (part) => {
        if (!active || controller.signal.aborted) return;
        setAnswer((value) => value + part); setStatus("streaming");
      },
    }).then(() => { if (active && !controller.signal.aborted) setStatus("ready"); })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        const failure = err instanceof AiRequestError ? err : new AiRequestError(err instanceof Error ? err.message : "Không thể nhận phản hồi AI.");
        const timestamp = Date.now();
        setError(failure); setNow(timestamp); setRetryAt(timestamp + failure.retryAfterSeconds * 1000); setStatus("error");
      });
    return () => { active = false; controller.abort(); };
  }, [action, text, before, after, question]);
  useEffect(() => {
    if (!retryAt || retryAt <= Date.now()) return;
    const timer = setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const busy = status === "loading" || status === "streaming";
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return <div aria-busy={busy}>
    <p role="status" aria-live="polite">{status === "loading" ? "Đang kết nối Gemini…"
      : status === "streaming" ? "Đang nhận phản hồi…" : status === "stopped" ? "Đã dừng. Giữ lại phần đã nhận."
      : status === "ready" ? "Đã hoàn tất." : "Yêu cầu không hoàn tất."}</p>
    <small>{model}</small>
    {answer && <div className="ai-answer" data-testid="ai-answer">{answer}</div>}
    {answer && <CopyButton text={answer} />}
    {status === "ready" && <SaveEntryForm draft={{ pageNumber, selectedText: text, action, result: answer, question, model }} onSave={onSave} />}
    {error && <div className="ai-error" role="alert">
      <strong>{aiErrorTitle(error.code)}</strong>
      <p>{error.message}</p>
      {answer && <p>Phần phản hồi phía trên chưa hoàn tất. Bạn có thể sao chép phần đã nhận.</p>}
    </div>}
    {remaining > 0 && <p className="ai-wait-hint">Bạn có thể tiếp tục đọc PDF và ghi chú trong lúc chờ.</p>}
    {busy && <button onClick={() => { controllerRef.current?.abort(); setStatus("stopped"); }}>Dừng</button>}
    {(!error || error.retryable) && <button disabled={busy || remaining > 0} onClick={() => {
      if (!busy && Date.now() >= retryAt) onRetry();
    }}>{busy ? "Đang xử lý…" : remaining > 0 ? `Thử lại sau ${formatWait(remaining)}` : "Thử lại"}</button>}
  </div>;
}

export default function AiPanel({ selection, action, onClose, onSave }: {
  selection: PdfSelection; action: AiAction; onClose: () => void; onSave: SaveStudyEntry | null;
}) {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    try { sessionStorage.removeItem("ai-access-token"); } catch { /* Storage may be disabled. */ }
  }, []);
  return <section className="ai-panel" aria-label="Trợ lý AI" data-selection-controls>
    <div className="ai-panel-heading">
      <strong>{actionLabels[action]} · Trang {selection.pageNumber}</strong>
      <button onClick={onClose} aria-label="Đóng panel AI">Đóng</button>
    </div>
    <small>Gemini · Đoạn chọn, ngữ cảnh lân cận và câu hỏi sẽ được gửi qua backend tới Google khi chạy tác vụ AI.</small>
    <blockquote data-testid="ai-selected-text">{selection.cleanedText}</blockquote>
    {action === "ask" && <form onSubmit={(event) => {
      event.preventDefault();
      if (question.trim()) { setSubmitted(question.trim()); setAttempt((n) => n + 1); }
    }}>
      <label htmlFor="ai-question">Câu hỏi về đoạn đã chọn</label>
      <div className="ai-question-row">
        <input id="ai-question" value={question} maxLength={2000} onChange={(event) => setQuestion(event.target.value)} placeholder="Bạn muốn tìm hiểu điều gì?" />
        <button disabled={!question.trim()}>Gửi</button>
      </div>
    </form>}
    {(action !== "ask" || submitted) && <>
      <AiResult key={attempt} action={action} text={selection.cleanedText}
        before={selection.context.before} after={selection.context.after} question={submitted}
        pageNumber={selection.pageNumber} onSave={onSave} onRetry={() => setAttempt((n) => n + 1)} />
    </>}
  </section>;
}
