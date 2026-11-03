import { useCallback, useState } from 'react';
import type { PdfSelection } from '../../types/selection';
import type { ChatArchive } from '../../services/storage/chatStore';
import { renameChatArchive } from '../../services/storage/chatStore';
import SelectionAssistant from '../AiPanel/SelectionAssistant';
import HistoryPanel from './HistoryPanel';
import { readAiSelection } from '../../utils/readAiSelection';

export default function StudySidebar({ documentHash, selection, fileName, onNavigate }: {
  documentHash: string | null; selection: PdfSelection | null;
  fileName: string; onNavigate: (page: number) => void;
}) {
  const [view, setView] = useState<'assistant' | 'ai'>('assistant');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiSelection, setAiSelection] = useState<PdfSelection | null>(null);
  const [lastPdfSelection, setLastPdfSelection] = useState(selection);
  const [snapshot, setSnapshot] = useState<{ hash: string | null; archives: ChatArchive[]; error: string } | null>(null);
  const onConversationChange = useCallback((archives: ChatArchive[], error = '') => {
    setSnapshot({ hash: documentHash, archives, error });
  }, [documentHash]);
  if (selection && selection !== lastPdfSelection) {
    setLastPdfSelection(selection);
    if (aiSelection) setAiSelection(null);
  }
  const captureAnswer = (root: HTMLElement) => {
    const value = readAiSelection(root);
    if (value) setAiSelection(value);
  };
  const current = snapshot?.hash === documentHash ? snapshot : null;
  const archives = current?.archives ?? [];
  return <aside className="assistant-sidebar" aria-label="Dịch và trợ lý AI" data-selection-controls
    onPointerUp={event => captureAnswer(event.currentTarget)} onKeyUp={event => captureAnswer(event.currentTarget)}>
    <header className="assistant-header">
      <div className="assistant-heading-row">
        <h1>Dịch & trợ lý AI</h1>
        <button className="history-toggle" aria-expanded={historyOpen} aria-controls="chat-history-view"
          onClick={() => setHistoryOpen(value => !value)}>Lịch sử ({archives.length})</button>
      </div>
      <p title={fileName}>{fileName || 'Chọn đoạn văn bên trái để bắt đầu.'}</p>
    </header>
    <nav className="study-tabs" aria-label="Không gian học tập">
      <button aria-pressed={!historyOpen && view === 'assistant'} onClick={() => { setView('assistant'); setHistoryOpen(false); }}>Trợ lý</button>
      <button aria-pressed={!historyOpen && view === 'ai'} onClick={() => { setView('ai'); setHistoryOpen(false); }}>AI</button>
    </nav>
    <div className="assistant-view" hidden={historyOpen}>
      <SelectionAssistant selection={selection} aiSelection={aiSelection} onClearAiSelection={() => setAiSelection(null)}
        documentHash={documentHash} onConversationChange={onConversationChange} showChat={view === 'ai'}
        onShowChat={() => { setView('ai'); setHistoryOpen(false); }} />
    </div>
    {historyOpen && <div className="assistant-view" id="chat-history-view">
      <div className="history-heading"><strong>Lịch sử hội thoại</strong><button onClick={() => setHistoryOpen(false)}>Đóng lịch sử</button></div>
      <HistoryPanel documentHash={documentHash} archives={archives}
      loading={!!documentHash && !current} error={current?.error ?? ''} onNavigate={onNavigate}
      onRename={async (id, title) => {
        if (!documentHash) throw new Error('Tài liệu chưa sẵn sàng.');
        onConversationChange(await renameChatArchive(documentHash, id, title));
      }} />
    </div>}
  </aside>;
}
