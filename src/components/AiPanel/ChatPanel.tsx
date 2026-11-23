import type {OcrLanguage} from '../../services/pdf/ocr';
import {saveChat,type LibrarySession} from '../../services/library/store';
import type {ReaderContext} from '../../types/reader';
import {parsePageRange,scopeLabel,includesPage} from '../../../shared/ai/contextScope';
import type { OwnerScope } from '../../services/ownerScope';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { AiAction } from '../../types/ai';
import type { PdfSelection } from '../../types/selection';
import type {ChatTurn,ChatExcerpt} from '../../types/chat';
import { recentChatContext } from '../../../shared/ai/chat.ts';
import { AiRequestError, aiErrorTitle, formatWait } from '../../../shared/ai/errors.ts';
import { streamGemini } from '../../services/ai/gemini';
import AiResponse from './AiResponse';
import ChatExcerptPreview from './ChatExcerptPreview';
import { CopyButton } from './CopyButton';

export interface ChatActionHandle { flush:()=>Promise<void>; sendSelection: (action: AiAction, selection: PdfSelection) => boolean; }

export default function ChatPanel({ librarySession, readerContext, actionRef, ownerScope, selection, onClearSelection }: {
  librarySession?:LibrarySession;
  readerContext?:ReaderContext;
  actionRef?: Ref<ChatActionHandle>;
  ownerScope: OwnerScope; selection: PdfSelection | null;
  onClearSelection: () => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>(librarySession?.turns??[]);
  const [question, setQuestion] = useState('');
  const [contextMode,setContextMode]=useState<'selection'|'page'|'pages'>('selection');
  const [ocr,setOcr]=useState(false),[ocrLanguage,setOcrLanguage]=useState<OcrLanguage>('eng+vie'),[ocrProgress,setOcrProgress]=useState('');
  const [pageRange,setPageRange]=useState('');
  const [prepared,setPrepared]=useState<{key:string;selection:PdfSelection}|null>(null);
  const [preparing,setPreparing]=useState(false),[contextError,setContextError]=useState('');
  const preparation=useRef<AbortController|null>(null);
  const contextKey=`${ocr}:${ocrLanguage}:${contextMode}:${contextMode==='page'?readerContext?.currentPage:pageRange}`;
  const chosen=contextMode==='selection'?selection:prepared?.key===contextKey?prepared.selection:null;
  const [pageOnly,setPageOnly]=useState(false),[visibleCount,setVisibleCount]=useState(20);
  useEffect(()=>()=>{preparation.current?.abort();},[contextKey]);
  const prepare=async()=>{
    if(!readerContext)return;
    preparation.current?.abort();const abort=new AbortController();preparation.current=abort;
    setPreparing(true);setContextError('');
    try{const pages=contextMode==='page'?[readerContext.currentPage]:parsePageRange(pageRange,readerContext.totalPages);const value=await readerContext.prepare(pages,abort.signal,{ocr,language:ocrLanguage,onProgress:setOcrProgress});if(!abort.signal.aborted)setPrepared({key:contextKey,selection:value});}
    catch(error){if(!abort.signal.aborted)setContextError(error instanceof Error?error.message:'Không trích được nội dung.');}
    finally{if(preparation.current===abort){setPreparing(false);preparation.current=null;}}
  };

  const [now, setNow] = useState(Date.now);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(turns);
  const mounted = useRef(false);
  const messages = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(()=>{
    mounted.current=true;
    return()=>{mounted.current=false;controller.current?.abort();};
  },[]);

  const change = (update: (rows: ChatTurn[]) => ChatTurn[]) => {
    latest.current = update(latest.current);
    setTurns(latest.current);
  };
  const [saveError,setSaveError]=useState('');
  const revision=useRef(librarySession?.revision??0);
  const saved=useRef(JSON.stringify(librarySession?.turns??[]));
  const queue=useRef<Promise<void>>(Promise.resolve());
  const persist=()=>{
    if(!librarySession)return Promise.resolve();
    const rows=structuredClone(latest.current),encoded=JSON.stringify(rows);
    const operation=queue.current.catch(()=>{}).then(async()=>{
      if(encoded===saved.current)return;
      revision.current=await saveChat(librarySession.owner,librarySession.documentId,librarySession.chatId,rows,revision.current);
      saved.current=encoded;librarySession.onSaved();if(mounted.current)setSaveError('');
    });queue.current=operation;return operation;
  };
  const persistRef=useRef(persist);
  useEffect(()=>{persistRef.current=persist;});
  useEffect(()=>()=>{void persistRef.current().catch(()=>{});},[]);
  const flush=async()=>{
    if(controller.current){controller.current.abort();change(rows=>rows.map(t=>t.status==='loading'||t.status==='streaming'?{...t,status:'stopped'}:t));}
    await persist();
  };
  useEffect(()=>{
    const timer=setTimeout(()=>{void persist().catch(e=>{if(mounted.current)setSaveError(e.message);});},turns.some(t=>t.status==='streaming')?400:0);
    const leaving=()=>{void persist().catch(()=>{});};window.addEventListener('pagehide',leaving);
    return()=>{clearTimeout(timer);window.removeEventListener('pagehide',leaving);};
  });
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

  const send = (value: string, excerpt: ChatExcerpt | null, action: AiAction = 'ask', continuation?:ChatTurn) => {
    if (ownerScope === 'guest' || controller.current || !excerpt || !value.trim() || remaining > 0) return false;
    const id = crypto.randomUUID();
    const history = recentChatContext(latest.current.filter(turn => turn.status === 'ready')
      .map(turn => ({ question: turn.question, answer: turn.answer })).concat(continuation?[{question:continuation.question.slice(0,2000),answer:continuation.answer.slice(-2000)}]:[]));
    const abort = new AbortController();
    controller.current = abort;
    follow.current = true;
    const source = { scope:excerpt.scope, pageNumber: excerpt.pageNumber, cleanedText: excerpt.cleanedText,
      context: { before: excerpt.context.before, after: excerpt.context.after } };
    change(rows => [...rows, { id, action, question: value.trim(), answer: '', model: 'Gemini', selection: source,
      status: 'loading', createdAt: Date.now() }]);
    if (action === 'ask') setQuestion('');
    const update = (patch: Partial<ChatTurn>) => {
      if (mounted.current) change(rows => rows.map(turn => turn.id === id ? { ...turn, ...patch } : turn));
    };
    void streamGemini({ action, question: value.trim(), history,
      excerpt: { cleanedText: excerpt.cleanedText, context: excerpt.context, scope:excerpt.scope },
      baseUrl: import.meta.env.VITE_AI_API_URL || '', signal: abort.signal,
      onModel: model => update({ model }),
      onText: part => {
        if (mounted.current && !abort.signal.aborted) change(rows => rows.map(turn => turn.id === id
          ? { ...turn, answer: turn.answer + part, status: 'streaming' } : turn));
      },
    }).then(() => update({ status: 'ready' })).catch((error: unknown) => {
      if (abort.signal.aborted) { update({ status: 'stopped' }); return; }
      const failure = error instanceof AiRequestError ? error : new AiRequestError(error instanceof Error ? error.message : 'Không nhận được phản hồi.');
      if (!mounted.current) return;
      setNow(Date.now());
      update({ status: 'error', error: { code: failure.code, message: failure.message,
        retryable: failure.retryable, retryAt: Date.now() + failure.retryAfterSeconds * 1000 } });
    }).finally(() => { if (controller.current === abort) controller.current = null; });
    return true;
  };
  useImperativeHandle(actionRef, () => ({
    flush,
    sendSelection: (action, source) => send(action === 'translate' ? 'Dịch đoạn đã chọn sang tiếng Việt.' : 'Giải thích đoạn đã chọn.', source, action),
  }));

  const filtered=pageOnly&&readerContext?turns.filter(turn=>includesPage(turn.selection.scope,turn.selection.pageNumber,readerContext.currentPage)):turns;
  const visible=filtered.slice(-visibleCount);
  return <section className="ai-panel ask-chat" aria-label="Hội thoại Hỏi AI" data-selection-controls>
    <header className="chat-header">
      <strong>Hội thoại AI</strong>
      <details className="chat-help"><summary>Về hội thoại và dữ liệu gửi đi</summary><small>PDF và hội thoại được lưu trong thư viện trên trình duyệt này theo tài khoản, chưa đồng bộ lên máy chủ. Đoạn chọn và các lượt gần nhất được gửi làm ngữ cảnh tới Google khi bạn gửi câu hỏi.</small></details>
      <button type="button" disabled={!librarySession} onClick={()=>void librarySession?.onNew().catch(e=>setSaveError(e.message))}>Đoạn chat mới</button>
    </header>
    {saveError&&<p role="alert">{saveError} <button onClick={()=>void persist().catch(e=>setSaveError(e.message))}>Thử lưu lại</button></p>}
    {readerContext&&<label className="chat-page-filter"><input type="checkbox" checked={pageOnly} onChange={event=>{setPageOnly(event.target.checked);setVisibleCount(20);}}/>Chỉ câu hỏi liên quan trang {readerContext.currentPage} ({filtered.length})</label>}
    <div className="chat-messages" ref={messages} onScroll={event => {
      const node = event.currentTarget;
      follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
    }}>
      {!turns.length && <div className="reader-chat-welcome"><span className="reader-ai-mark" aria-hidden="true">✦</span><h2>Cùng đọc hiểu tài liệu</h2><p>Chọn đoạn tô đen, trang hiện tại hoặc nhóm trang rồi đặt câu hỏi. Mình có thể giúp bạn hiểu khái niệm, công thức hoặc tìm ví dụ dễ hiểu.</p><small>Câu hỏi chỉ được gửi khi bạn bấm Gửi.</small></div>}

      {filtered.length>visibleCount&&<button type="button" onClick={()=>{follow.current=false;setVisibleCount(n=>n+20);}}>Xem thêm 20 lượt trước</button>}
      {pageOnly&&turns.length>0&&filtered.length===0&&<p>Chưa có câu hỏi liên quan trang này trong hội thoại hiện tại. Mở rộng thư mục PDF bên trái để xem các chat cũ.</p>}
      {visible.map((turn) => <article className="chat-turn" key={turn.id}>
        <div className="chat-user"><strong>Bạn</strong><p>{turn.question}</p>
          <details><summary>{scopeLabel(turn.selection.scope,turn.selection.pageNumber)}</summary><blockquote>{turn.selection.cleanedText}</blockquote></details>
        </div>
        <div className="chat-assistant"><strong>Trợ lý AI</strong> <small>{turn.model}</small>
          {turn.answer && <AiResponse action={turn.action ?? 'ask'} text={turn.answer} pageNumber={turn.selection.pageNumber} />}
          <p role="status">{turn.status === 'loading' ? 'Đang kết nối Gemini…' : turn.status === 'streaming' ? 'Đang nhận phản hồi…'
            : turn.status === 'stopped' ? 'Đã dừng. Phần đã nhận được giữ lại.' : turn.status === 'ready' ? 'Đã hoàn tất.' : turn.answer ? 'Phản hồi bị ngắt · Nội dung chưa đầy đủ.' : 'Yêu cầu không hoàn tất.'}</p>
          {turn.error && <div className="ai-error" role="alert"><strong>{aiErrorTitle(turn.error.code)}</strong><p>{turn.error.message}</p></div>}
          {turn.answer && <CopyButton text={turn.answer} />}
          {turn.id===last?.id&&!busy&&turn.answer&&(turn.status==='stopped'||turn.status==='error')&&turn.error?.retryable!==false&&<button disabled={remaining>0} onClick={()=>send(`Tiếp tục ${turn.action==='translate'?'bản dịch sang tiếng Việt':'câu trả lời'} đang bị ngắt cho yêu cầu: ${turn.question.slice(0,1300)}. Nối tiếp phần đã nhận, tránh lặp lại. Nếu đã đủ nội dung, hãy nói rõ.`,turn.selection,'ask',turn)}>{remaining?`Tiếp tục sau ${formatWait(remaining)}`:'Tiếp tục phản hồi'}</button>}
          {turn.id === turns.at(-1)?.id && !busy && (turn.status === 'stopped' || turn.status === 'error') && turn.error?.retryable !== false &&
            <button disabled={remaining > 0} onClick={() => send(turn.question, turn.selection, turn.action)}>{remaining ? `Thử lại sau ${formatWait(remaining)}` : 'Thử lại câu hỏi'}</button>}
        </div>
      </article>)}
    </div>
    <form className="chat-composer" onSubmit={event => { event.preventDefault(); send(question, chosen); }}>
      {readerContext&&<div className="reader-context-controls">
        <label>Phạm vi gửi AI<select aria-label="Phạm vi gửi AI" value={contextMode} disabled={busy} onChange={event=>{setContextMode(event.target.value as typeof contextMode);setContextError('');}}>
          <option value="selection">Đoạn tô đen</option><option value="page">Trang hiện tại ({readerContext.currentPage})</option><option value="pages">Nhóm trang tự chọn</option>
        </select></label>
        {contextMode==='pages'&&<label>Các trang<input aria-label="Các trang gửi AI" value={pageRange} placeholder="Ví dụ: 2-4, 8" maxLength={80} disabled={busy} onChange={event=>setPageRange(event.target.value)}/></label>}
        {contextMode!=='selection'&&<><label><input type="checkbox" checked={ocr} disabled={busy||preparing} onChange={e=>setOcr(e.target.checked)}/>Nhận dạng chữ PDF scan (OCR trên máy)</label>{ocr&&<><label>Ngôn ngữ OCR<select aria-label="Ngôn ngữ OCR" value={ocrLanguage} disabled={preparing} onChange={e=>setOcrLanguage(e.target.value as OcrLanguage)}><option value="eng+vie">Anh + Việt</option><option value="eng">Tiếng Anh</option><option value="vie">Tiếng Việt</option></select></label><small>OCR có thể sai chữ và công thức. Kiểm tra bản xem trước trước khi gửi AI. Ảnh trang không rời máy.</small></>}</>}
        {contextMode!=='selection'&&<><button type="button" disabled={!readerContext.totalPages||preparing||busy||ownerScope==='guest'} onClick={()=>void prepare()}>{preparing?(ocr?'Đang nhận dạng chữ…':'Đang đọc chữ trên các trang đã chọn…'):'Chuẩn bị ngữ cảnh'}</button><small>Tối đa 5 trang / 12.000 ký tự mỗi lượt. Chuẩn bị chỉ đọc trên máy, chưa gọi AI.</small></>}
        {preparing&&<><p role="status">{ocr?ocrProgress: "Đang chuẩn bị ngữ cảnh…"}</p><button type="button" onClick={()=>preparation.current?.abort()}>Hủy chuẩn bị</button></>}
        {contextError&&<p role="alert">{contextError}</p>}
      </div>}
      {(contextMode==='selection'||chosen)&&<ChatExcerptPreview selection={chosen} onClose={()=>{if(contextMode==='selection'){onClearSelection();}else setPrepared(null);}} />}
      {chosen&&<details className="context-preview"><summary>Xem toàn bộ nội dung sẽ gửi AI</summary><pre>{chosen.cleanedText}</pre><small>Kèm tối đa 6 lượt chat gần nhất, tối đa 6.000 ký tự; không gửi toàn bộ lịch sử hay toàn bộ PDF.</small></details>}
      {contextMode!=='selection'&&!chosen&&<small>Hãy chuẩn bị và kiểm tra ngữ cảnh trước khi gửi câu hỏi.</small>}
      <label htmlFor="chat-question">Câu hỏi của bạn</label>
      <div className="chat-input-row"><textarea id="chat-question" value={question} maxLength={2000} rows={2} placeholder="Đặt câu hỏi về phạm vi đã chọn…"
        onChange={event => setQuestion(event.target.value)} onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
        }} />
      {busy ? <button type="button" onClick={() => controller.current?.abort()}>Dừng phản hồi</button>
        : <button aria-label="Gửi câu hỏi" title="Gửi câu hỏi" disabled={ownerScope === 'guest' || !chosen || preparing || !question.trim() || remaining > 0}>{remaining ? `Chờ ${formatWait(remaining)}` : '↑'}</button>}</div>
      <small>Enter để gửi · Shift+Enter để xuống dòng. Tiếp tục/Thử lại là lượt AI mới.</small>
    </form>
  </section>;
}
