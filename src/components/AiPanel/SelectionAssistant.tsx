import type {LibrarySession} from '../../services/library/store';
import type {ReaderContext} from '../../types/reader';
import type { Ref } from 'react';
import type { ChatActionHandle } from './ChatPanel';
import type { OwnerScope } from '../../services/ownerScope';
import { useState } from "react";
import type { PdfSelection } from "../../types/selection";
import ChatPanel from './ChatPanel';

export default function SelectionAssistant({ librarySession, readerContext, actionRef, ownerScope, selection, aiSelection = null, onClearAiSelection }: {
  librarySession?:LibrarySession;
  readerContext?:ReaderContext;
  actionRef?: Ref<ChatActionHandle>;
  ownerScope: OwnerScope; selection: PdfSelection | null;
  aiSelection?: PdfSelection | null; onClearAiSelection?: () => void;
}) {
  const [captured, setCaptured] = useState<PdfSelection|null>(()=>{const last=librarySession?.turns.at(-1)?.selection;return selection??(last?.cleanedText.trim()?{...last,source:'pdf',text:last.cleanedText,rawText:last.cleanedText,rect:new DOMRect(),rects:[]}:null);});
  const [removed, setRemoved] = useState<{ pdf: PdfSelection | null; ai: PdfSelection | null } | null>(null);
  if (selection && selection !== captured) {
    setCaptured(selection);
  }
  // Selection is a draft; an AI request captures it only on an explicit click.
  const candidate = aiSelection ?? selection ?? captured;
  const active = candidate && (candidate === removed?.pdf || candidate === removed?.ai) ? null : candidate;
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
    <ChatPanel librarySession={librarySession} readerContext={readerContext} actionRef={actionRef} ownerScope={ownerScope} selection={active} onClearSelection={clearSelection} />
  </div>;
}
