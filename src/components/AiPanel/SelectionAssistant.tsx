import { useState } from "react";
import type { PdfSelection } from "../../types/selection";
import type { AiAction } from "../../types/ai";
import SelectionToolbar from "../SelectionToolbar/SelectionToolbar";
import AiPanel from "./AiPanel";
import type { SaveStudyEntry } from "../../types/study";
import SaveEntryForm, { CopyButton } from "../Study/SaveEntryForm";

export default function SelectionAssistant({ selection, onSave }: { selection: PdfSelection | null; onSave: SaveStudyEntry | null }) {
  const [request, setRequest] = useState<{ selection: PdfSelection; action: AiAction } | null>(null);
  const [captured, setCaptured] = useState(selection);
  if (selection && selection !== captured) setCaptured(selection);
  if (selection && request && selection !== request.selection) {
    setRequest({ ...request, selection });
  }
  // Keep the chosen excerpt when focus moves into the panel. A new PDF selection
  // immediately replaces it; geometry-only updates do not restart the response.
  const active = selection ?? captured;
  return <div className="assistant-content" data-selection-controls>
    <SelectionToolbar disabled={!active} activeAction={request?.action}
      onAction={(action) => { if (active) setRequest({ selection: active, action }); }} />
    {!request && <section className="selection-summary" aria-label="PDF selection" data-testid="pdf-selection">
      {active ? <>
        <strong>Đoạn đã chọn · Trang {active.pageNumber}</strong>
        <small>{active.cleanedText.length} ký tự</small>
        <p className="selection-text" data-testid="selected-text">{active.cleanedText}</p>
        <CopyButton text={active.cleanedText} />
        <SaveEntryForm key={JSON.stringify([active.pageNumber, active.rawText, active.context])}
          draft={{ pageNumber: active.pageNumber, selectedText: active.cleanedText, action: "note", result: "" }} onSave={onSave} />
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
      selection={active} action={request.action} onSave={onSave} onClose={() => setRequest(null)} />}
  </div>;
}
