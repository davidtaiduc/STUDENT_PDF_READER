import { useEffect, useState } from "react";
import { actionLabels } from "../../types/ai";
import type { AiAction } from "../../types/ai";
import type { PdfSelection } from "../../types/selection";

function MockResult({ action, question, fail }: { action: AiAction; question: string; fail: boolean }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const timer = window.setTimeout(() => setStatus(fail ? "error" : "ready"), 650);
    return () => window.clearTimeout(timer);
  }, [fail]);
  if (status === "loading") return <p role="status">Đang chuẩn bị phản hồi mô phỏng…</p>;
  if (status === "error") return <p role="alert">Không tạo được phản hồi mô phỏng. Hãy chọn “Thử lại”.</p>;
  return <p role="status">{action === "explain"
    ? "Phản hồi mẫu: phần giải thích ý chính của đoạn văn sẽ xuất hiện tại đây khi kết nối AI."
    : action === "translate"
      ? "Phản hồi mẫu: bản dịch tiếng Việt sẽ xuất hiện tại đây khi kết nối AI."
      : `Câu hỏi đã nhận: “${question}”. Câu trả lời sẽ xuất hiện tại đây khi kết nối AI.`}</p>;
}

export default function AiPanel({ selection, action, onClose }: {
  selection: PdfSelection; action: AiAction; onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [fail, setFail] = useState(false);
  return <section className="ai-panel" aria-label="Trợ lý AI" data-selection-controls>
    <div className="ai-panel-heading">
      <strong>{actionLabels[action]} · Trang {selection.pageNumber}</strong>
      <button onClick={onClose} aria-label="Đóng panel AI">Đóng</button>
    </div>
    <small>Bản mô phỏng · Chưa kết nối AI</small>
    <blockquote data-testid="ai-selected-text">{selection.cleanedText}</blockquote>
    {action === "ask" && <form onSubmit={(event) => {
      event.preventDefault();
      if (question.trim()) { setSubmitted(question.trim()); setAttempt((n) => n + 1); }
    }}>
      <label htmlFor="ai-question">Câu hỏi về đoạn đã chọn</label>
      <div className="ai-question-row">
        <input id="ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Bạn muốn tìm hiểu điều gì?" />
        <button disabled={!question.trim()}>Gửi</button>
      </div>
    </form>}
    {(action !== "ask" || submitted) && <MockResult key={`${attempt}-${fail}`} action={action} question={submitted} fail={fail} />}
    <details className="mock-controls">
      <summary>Kiểm thử phản hồi mô phỏng</summary>
      <label><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} /> Mô phỏng lỗi</label>
    </details>
    <button onClick={() => { setFail(false); setAttempt((n) => n + 1); }}>Thử lại</button>
  </section>;
}
