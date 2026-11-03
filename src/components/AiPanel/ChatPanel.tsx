import { useEffect, useRef, useState } from 'react';
import type { PdfSelection } from '../../types/selection';
import { loadChat, loadChatArchives, archiveChat, saveChat, type ChatTurn, type ChatExcerpt, type ChatArchive } from '../../services/storage/chatStore';
import { recentChatContext } from '../../../shared/ai/chat.ts';
import { AiRequestError, aiErrorTitle, formatWait } from '../../../shared/ai/errors.ts';
import { streamGemini } from '../../services/ai/gemini';
import AiResponse from './AiResponse';
import ChatExcerptPreview from './ChatExcerptPreview';
import { CopyButton } from '../Study/SaveEntryForm';

export default function ChatPanel({ documentHash, selection, onClearSelection, onConversationChange }: {
  documentHash: string | null; selection: PdfSelection | null;
  onClearSelection: () => void;
  onConversationChange?: (archives: ChatArchive[], error?: string) => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState('');
  const [loaded, setLoaded] = useState(!documentHash);
  const [storageError, setStorageError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState('');
  const archiveLock = useRef(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(turns);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const messages = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const conversationListener = useRef(onConversationChange);
  useEffect(() => { conversationListener.current = onConversationChange; }, [onConversationChange]);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    if (documentHash) void Promise.all([loadChat(documentHash), loadChatArchives(documentHash)]).then(([rows, archives]) => {
      if (!active) return;
      latest.current = rows; setTurns(rows); setLoaded(true); setStorageError('');
      conversationListener.current?.(archives);
    }).catch(() => {
      if (active) {
        const message = 'Không đọc được hội thoại đã lưu. Hãy kiểm tra quyền lưu trữ rồi thử tải lại.';
        setStorageError(message); conversationListener.current?.([], message);
      }
    });
    return () => { active = false; mounted.current = false; controller.current?.abort(); };
  }, [documentHash, revision]);

  // Throttle snapshots during streaming and flush the latest snapshot on exit.
  useEffect(() => {
    if (!loaded || !documentHash || archiveLock.current) return;
    if (!pendingSave.current) pendingSave.current = setTimeout(() => {
      pendingSave.current = null;
      void saveChat(documentHash, latest.current).then(() => {
        if (mounted.current) setStorageError('');
      }).catch(() => {
        if (mounted.current) setStorageError('Hội thoại chưa lưu được trên máy. Nội dung vẫn ở đây; hãy thử lưu lại.');
      });
    }, 500);
  }, [turns, loaded, documentHash, archiving]);
  useEffect(() => () => {
    if (pendingSave.current && documentHash) {
      clearTimeout(pendingSave.current);
      void saveChat(documentHash, latest.current).catch(() => {});
    }
  }, [documentHash]);

  const change = (update: (rows: ChatTurn[]) => ChatTurn[]) => {
    latest.current = update(latest.current);
    setTurns(latest.current);
  };
  const busy = turns.some(turn => turn.status === 'loading' || turn.status === 'streaming');
  const last = turns.at(-1);
  const remaining = Math.max(0, Math.ceil(((last?.error?.retryAt ?? 0) - now) / 1000));
  useEffect(() => {
    if (!remaining) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [remaining]);
  useEffect(() => {
    if (follow.current && messages.current) messages.current.scrollTop = messages.current.scrollHeight;
  }, [turns]);

  const send = (value: string, excerpt: ChatExcerpt | null) => {
    if (!loaded || controller.current || archiveLock.current || !excerpt || !value.trim() || remaining > 0) return;
    setArchiveStatus('');
    const id = crypto.randomUUID();
    const history = recentChatContext(latest.current.filter(turn => turn.status === 'ready')
      .map(turn => ({ question: turn.question, answer: turn.answer })));
    const abort = new AbortController();
    controller.current = abort;
    follow.current = true;
    const source = { pageNumber: excerpt.pageNumber, cleanedText: excerpt.cleanedText,
      context: { before: excerpt.context.before, after: excerpt.context.after } };
    change(rows => [...rows, { id, question: value.trim(), answer: '', model: 'Gemini', selection: source,
      status: 'loading', createdAt: Date.now() }]);
    setQuestion('');
    const update = (patch: Partial<ChatTurn>) => {
      if (mounted.current) change(rows => rows.map(turn => turn.id === id ? { ...turn, ...patch } : turn));
    };
    void streamGemini({ action: 'ask', question: value.trim(), history,
      excerpt: { cleanedText: excerpt.cleanedText, context: excerpt.context },
      baseUrl: import.meta.env.VITE_AI_API_URL || '', signal: abort.signal,
      onModel: model => update({ model }),
      onText: part => {
        if (mounted.current && !abort.signal.aborted) change(rows => rows.map(turn => turn.id === id
          ? { ...turn, answer: turn.answer + part, status: 'streaming' } : turn));
      },
    }).then(() => update({ status: 'ready' })).catch((error: unknown) => {
      if (abort.signal.aborted) { update({ status: 'stopped' }); return; }
      const failure = error instanceof AiRequestError ? error : new AiRequestError(error instanceof Error ? error.message : 'Không nhận được phản hồi.');
      setNow(Date.now());
      update({ status: 'error', error: { code: failure.code, message: failure.message,
        retryable: failure.retryable, retryAt: Date.now() + failure.retryAfterSeconds * 1000 } });
    }).finally(() => { if (controller.current === abort) controller.current = null; });
  };

  return <section className="ai-panel ask-chat" aria-label="Hội thoại Hỏi AI" data-selection-controls>
    <header className="chat-header">
      <strong>Hỏi AI · Hội thoại của PDF</strong>
      <small>{documentHash ? 'Bản nháp được giữ trên máy. Lưu vào Lịch sử để bắt đầu hội thoại mới.' : 'Hội thoại tạm: chưa nhận diện được PDF nên chưa thể lưu.'} Chỉ các lượt gần nhất được gửi làm ngữ cảnh tới Google.</small>
      <button type="button" disabled={!documentHash || !loaded || !turns.length || busy || archiving} onClick={async () => {
        if (!documentHash || archiveLock.current || controller.current || !latest.current.length) return;
        archiveLock.current = true; setArchiving(true); setArchiveStatus('');
        if (pendingSave.current) { clearTimeout(pendingSave.current); pendingSave.current = null; }
        try {
          const archives = await archiveChat(documentHash, latest.current);
          latest.current = [];
          if (mounted.current) {
            setTurns([]); conversationListener.current?.(archives); setStorageError('');
            setArchiveStatus('Đã lưu vào Lịch sử. Bạn có thể bắt đầu hội thoại mới.');
          }
        } catch {
          if (mounted.current) setStorageError('Chưa lưu được vào Lịch sử. Hội thoại vẫn được giữ; hãy bấm lưu lại.');
        } finally {
          archiveLock.current = false;
          if (mounted.current) setArchiving(false);
        }
      }}>{archiving ? 'Đang lưu hội thoại…' : 'Lưu đoạn chat vào lịch sử'}</button>
      {archiveStatus && <small role="status">{archiveStatus}</small>}
    </header>
    {storageError && <div className="storage-warning" role="alert">{storageError} <button onClick={() => {
      if (!loaded) setRevision(value => value + 1);
      else if (documentHash) void saveChat(documentHash, latest.current).then(() => setStorageError('')).catch(() => {});
    }}>{loaded ? 'Thử lưu lại' : 'Thử tải lại'}</button></div>}
    {!loaded && !storageError && <p role="status">Đang tải hội thoại…</p>}
    <div className="chat-messages" ref={messages} onScroll={event => {
      const node = event.currentTarget;
      follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
    }}>
      {loaded && !turns.length && <p>Đặt câu hỏi về đoạn đã chọn. Các câu hỏi và câu trả lời sẽ được giữ lại ở đây.</p>}
      {turns.map((turn, index) => <article className="chat-turn" key={turn.id}>
        <div className="chat-user"><strong>Bạn</strong><p>{turn.question}</p>
          <details><summary>Đoạn nguồn · Trang {turn.selection.pageNumber}</summary><blockquote>{turn.selection.cleanedText}</blockquote></details>
        </div>
        <div className="chat-assistant"><strong>Trợ lý AI</strong> <small>{turn.model}</small>
          {turn.answer && <AiResponse action="ask" text={turn.answer} pageNumber={turn.selection.pageNumber} />}
          <p role="status">{turn.status === 'loading' ? 'Đang kết nối Gemini…' : turn.status === 'streaming' ? 'Đang nhận phản hồi…'
            : turn.status === 'stopped' ? 'Đã dừng. Phần đã nhận được giữ lại.' : turn.status === 'ready' ? 'Đã hoàn tất.' : 'Yêu cầu không hoàn tất.'}</p>
          {turn.error && <div className="ai-error" role="alert"><strong>{aiErrorTitle(turn.error.code)}</strong><p>{turn.error.message}</p></div>}
          {turn.answer && <CopyButton text={turn.answer} />}
          {index === turns.length - 1 && !busy && (turn.status === 'stopped' || turn.status === 'error') && turn.error?.retryable !== false &&
            <button disabled={remaining > 0} onClick={() => send(turn.question, turn.selection)}>{remaining ? `Thử lại sau ${formatWait(remaining)}` : 'Thử lại câu hỏi'}</button>}
        </div>
      </article>)}
    </div>
    <form className="chat-composer" onSubmit={event => { event.preventDefault(); send(question, selection); }}>
      <ChatExcerptPreview selection={selection} onClose={onClearSelection} />
      <label htmlFor="chat-question">Câu hỏi của bạn</label>
      <textarea id="chat-question" value={question} maxLength={2000} rows={2} placeholder="Hỏi tiếp về nội dung này…"
        onChange={event => setQuestion(event.target.value)} onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
        }} />
      {busy ? <button type="button" onClick={() => controller.current?.abort()}>Dừng phản hồi</button>
        : <button disabled={!loaded || !selection || !question.trim() || remaining > 0 || archiving}>{remaining ? `Chờ ${formatWait(remaining)}` : 'Gửi câu hỏi'}</button>}
      <small>Enter để gửi · Shift+Enter để xuống dòng. Đoạn chọn và ngữ cảnh hội thoại được gửi tới Google khi bạn gửi câu hỏi.</small>
    </form>
  </section>;
}
