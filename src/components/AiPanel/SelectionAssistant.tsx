import { useState } from "react";
import type { PdfSelection } from "../../types/selection";
import type { AiAction } from "../../types/ai";
import SelectionToolbar from "../SelectionToolbar/SelectionToolbar";
import AiPanel from "./AiPanel";

export default function SelectionAssistant({ selection }: { selection: PdfSelection | null }) {
  const [request, setRequest] = useState<{ selection: PdfSelection; action: AiAction } | null>(null);
  if (selection && request && selection !== request.selection) {
    setRequest({ ...request, selection });
  }
  // Keep the chosen excerpt when focus moves into the panel. A new PDF selection
  // immediately replaces it; geometry-only updates do not restart the response.
  const active = selection ?? request?.selection;
  return <aside className="assistant-sidebar" aria-label="Dịch và trợ lý AI" data-selection-controls>
    <header className="assistant-header">
      <h1>Dịch & trợ lý AI</h1>
      <p>Chọn đoạn văn bên trái để bắt đầu.</p>
    </header>
    <SelectionToolbar disabled={!active} activeAction={request?.action}
      onAction={(action) => { if (active) setRequest({ selection: active, action }); }} />
    {!request && <section className="selection-summary" aria-label="PDF selection" data-testid="pdf-selection">
      {active ? <>
        <strong>Đoạn đã chọn · Trang {active.pageNumber}</strong>
        <small>{active.cleanedText.length} ký tự</small>
        <p className="selection-text" data-testid="selected-text">{active.cleanedText}</p>
        <details>
          <summary>Ngữ cảnh và văn bản gốc</summary>
          <p><strong>Trước: </strong>{active.context.before || "Đầu trang / cột"}</p>
          <p><strong>Sau: </strong>{active.context.after || "Cuối trang / cột"}</p>
          <p className="selection-text">{active.rawText}</p>
        </details>
      </> : <div className="assistant-empty">
        <span className="assistant-empty-icon" aria-hidden="true">Aa</span>
        <h2>Đọc và hiểu, cùng một chỗ</h2>
        <p>Mở PDF, bôi đen một đoạn rồi chọn Dịch, Giải thích hoặc Hỏi AI. Kết quả sẽ hiển thị tại đây.</p>
      </div>}
    </section>}
    {request && active && <AiPanel key={JSON.stringify([active.pageNumber, active.rawText, active.context, request.action])}
      selection={active} action={request.action} onClose={() => setRequest(null)} />}
  </aside>;
}
