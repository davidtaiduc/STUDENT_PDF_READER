import { useState } from "react";
import type { PdfSelection } from "../../types/selection";
import type { AiAction } from "../../types/ai";
import AiPanel from "./AiPanel";
import { CopyButton } from "../Study/SaveEntryForm";
import type { ChatArchive } from '../../services/storage/chatStore';
import ChatPanel from './ChatPanel';

export default function SelectionAssistant({ selection, documentHash, aiSelection = null, onClearAiSelection, onConversationChange, showChat, onShowChat }: {
  selection: PdfSelection | null; documentHash: string | null;
  aiSelection?: PdfSelection | null; onClearAiSelection?: () => void;
  onConversationChange?: (archives: ChatArchive[], error?: string) => void;
  showChat: boolean; onShowChat: () => void;
}) {
  const [request, setRequest] = useState<{ id: number; selection: PdfSelection; action: Exclude<AiAction, 'ask'> } | null>(null);
  const [captured, setCaptured] = useState(selection);
  const [removed, setRemoved] = useState<{ pdf: PdfSelection | null; ai: PdfSelection | null } | null>(null);
  if (selection && selection !== captured) {
    setCaptured(selection);
  }
  // Selection is a draft; an AI request captures it only on an explicit click.
  const candidate = aiSelection ?? selection ?? captured;
  const active = candidate && (candidate === removed?.pdf || candidate === removed?.ai) ? null : candidate;
  const selectionKey = active ? JSON.stringify([active.pageNumber, active.cleanedText, active.context, active.source]) : '';
  const [previousSelectionKey, setPreviousSelectionKey] = useState(selectionKey);
  if (selectionKey !== previousSelectionKey) {
    setPreviousSelectionKey(selectionKey);
    if (request) setRequest(null);
  }
  const clearSelection = () => {
    setRemoved({ pdf: selection ?? captured, ai: aiSelection });
    onClearAiSelection?.();
    // Prevent selection observers from restoring the removed native highlight.
    window.getSelection()?.removeAllRanges();
  };
  return <div className="assistant-content" data-selection-controls>
    {aiSelection && <div className="ai-selection-hint" role="status">
      <span>Đã chọn từ kết quả AI · {aiSelection.cleanedText.length} ký tự</span>
      <q>{aiSelection.cleanedText.slice(0, 160)}{aiSelection.cleanedText.length > 160 ? '…' : ''}</q>
      <button onClick={onClearAiSelection}>Bỏ chọn đoạn AI</button>
    </div>}
    {(documentHash || active || showChat) && <div className="assistant-view" hidden={!showChat}>
      <ChatPanel key={documentHash ?? 'temporary-chat'} documentHash={documentHash} selection={active} onClearSelection={clearSelection} onConversationChange={onConversationChange} />
    </div>}
    <div className="assistant-view excerpt-task-view" hidden={showChat}>
    <section className="selection-summary" aria-label="PDF selection" data-testid="pdf-selection">
      {active ? <>
        <strong>Đoạn đã chọn · Trang {active.pageNumber}</strong>
        <small>{active.cleanedText.length} ký tự</small>
        <div data-testid="ai-selected-text"><p className="selection-text" data-testid="selected-text">{active.cleanedText}</p></div>
        <div className="excerpt-actions" role="group" aria-label="Xử lý đoạn đã chọn">
          <button onClick={() => setRequest(previous => ({ id: (previous?.id ?? 0) + 1, selection: active, action: 'translate' }))}>Dịch</button>
          <button onClick={() => setRequest(previous => ({ id: (previous?.id ?? 0) + 1, selection: active, action: 'explain' }))}>Giải thích</button>
          <button onClick={onShowChat}>Hỏi AI</button>
        </div>
        <CopyButton text={active.cleanedText} />
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
        {documentHash && <button onClick={onShowChat}>Mở Hỏi AI</button>}
      </div>}
    </section>
    {request && <div className="excerpt-result">
      <AiPanel key={request.id} selection={request.selection} action={request.action} onClose={() => setRequest(null)} />
    </div>}
    </div>
  </div>;
}
