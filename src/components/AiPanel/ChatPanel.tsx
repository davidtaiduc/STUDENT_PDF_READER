import type {OcrLanguage} from '../../services/pdf/ocr';
import {loadChat,subscribeLibrary,saveChat,type LibrarySession} from '../../services/library/store';
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

export interface ChatActionHandle { isBusy:()=>boolean; flush:()=>Promise<void>; sendSelection: (action: AiAction, selection: PdfSelection) => boolean; }

export default function ChatPanel({ librarySession, readerContext, actionRef, ownerScope, selection, onClearSelection }: {
  librarySession?:LibrarySession;
  readerContext?:ReaderContext;
  actionRef?: Ref<ChatActionHandle>;
  ownerScope: OwnerScope; selection: PdfSelection | null;
  onClearSelection: () => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>(librarySession?.turns??[]);
  const [question, setQuestion] = useState('');
  const [contextMode,setContextMode]=useState<'none'|'selection'|'pages'>('selection');
  const [ocr,setOcr]=useState(false),[ocrLanguage,setOcrLanguage]=useState<OcrLanguage>('eng+vie'),[ocrProgress,setOcrProgress]=useState('');
  const [pageRange,setPageRange]=useState('');
  const [prepared,setPrepared]=useState<{key:string;selection:PdfSelection}|null>(null);
  const [preparing,setPreparing]=useState(false),[contextError,setContextError]=useState('');
  const preparation=useRef<AbortController|null>(null);
  const contextKey=`${ocr}:${ocrLanguage}:${contextMode}:${pageRange}`;
  const originalChosen=contextMode==='none'?null:contextMode==='selection'?selection:prepared?.key===contextKey?prepared.selection:null;
  const [correction,setCorrection]=useState<{source:PdfSelection;value:PdfSelection}|null>(null);
  const [editSource,setEditSource]=useState<PdfSelection|null>(null),[ocrDraft,setOcrDraft]=useState(''),[editError,setEditError]=useState('');
  const chosen=correction?.source===originalChosen?correction.value:originalChosen;
  const editing=!!editSource&&editSource===originalChosen;
  const saveCorrection=()=>{if(!originalChosen)return;const text=ocrDraft.trim();if(!text||text.length>12000){setEditError('Nội dung nhận dạng cần từ 1 đến 12.000 ký tự.');return;}setCorrection({source:originalChosen,value:{...originalChosen,text,cleanedText:text}});setEditSource(null);setEditError('');};
  const [pageOnly,setPageOnly]=useState(false),[visibleCount,setVisibleCount]=useState(20);
  useEffect(()=>()=>{preparation.current?.abort();},[contextKey]);
  const prepare=async()=>{
    if(!readerContext)return;
    preparation.current?.abort();const abort=new AbortController();preparation.current=abort;
    setPreparing(true);setContextError('');
    try{const pages=parsePageRange(pageRange,readerContext.totalPages);const value=await readerContext.prepare(pages,abort.signal,{ocr,language:ocrLanguage,onProgress:setOcrProgress});if(!abort.signal.aborted)setPrepared({key:contextKey,selection:value});}
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
  const [saveError,setSaveError]=useState(''),[completing,setCompleting]=useState(false);
  const revision=useRef(librarySession?.revision??0);
  const saved=useRef(JSON.stringify(librarySession?.turns??[]));
  const queue=useRef<Promise<void>>(Promise.resolve());
  useEffect(()=>{
    if(!librarySession)return;let active=true;
    const refresh=()=>{void loadChat(librarySession.owner,librarySession.documentId,librarySession.chatId).then(incoming=>{
      if(!active||controller.current||incoming.revision<=revision.current||JSON.stringify(latest.current)!==saved.current)return;
      latest.current=incoming.turns;saved.current=JSON.stringify(incoming.turns);revision.current=incoming.revision;setTurns(incoming.turns);
    }).catch(()=>{/* Empty/deleted chats are handled by the library navigation. */});};
    const unsubscribe=subscribeLibrary(refresh);refresh();return()=>{active=false;unsubscribe();};
  },[librarySession]);
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
    if (editing || ownerScope === 'guest' || controller.current || (action !== 'ask' && !excerpt?.cleanedText.trim()) || (action === 'ask' && !excerpt && contextMode !== 'none' && contextMode !== 'selection') || !value.trim() || remaining > 0) return false;
    const id = crypto.randomUUID();
    const history = recentChatContext(latest.current.filter(turn => turn.status === 'ready')
      .map(turn => ({ question: turn.question, answer: turn.answer })).concat(continuation?[{question:continuation.question.slice(0,2000),answer:continuation.answer.slice(-2000)}]:[]));
    const abort = new AbortController();
    controller.current = abort;
    follow.current = true;
    const source:ChatExcerpt = excerpt ? { scope:excerpt.scope, pageNumber:excerpt.pageNumber,ocr:excerpt.ocr,cleanedText:excerpt.cleanedText,context:{...excerpt.context} } : {pageNumber:1,cleanedText:'',context:{before:'',after:''}};
    change(rows => [...rows, { id, action, question: value.trim(), answer: '', model: 'Gemini', selection: source,
      status: 'loading', createdAt: Date.now() }]);
    if (action === 'ask') setQuestion('');
    const update = (patch: Partial<ChatTurn>) => {
      if (mounted.current) change(rows => rows.map(turn => turn.id === id ? { ...turn, ...patch } : turn));
    };
    void streamGemini({ action, question: value.trim(), history,
      excerpt: { cleanedText:source.cleanedText,context:source.context,scope:source.scope },
      baseUrl: import.meta.env.VITE_AI_API_URL || '', signal: abort.signal,
      onModel: model => update({ model }),
      onText: part => {
        if (mounted.current && !abort.signal.aborted) change(rows => rows.map(turn => turn.id === id
          ? { ...turn, answer: turn.answer + part, status: 'streaming' } : turn));
      },
    }).then(async () => {
      if(!mounted.current)return;
      setCompleting(true);update({status:'ready'});
      try{await persist();}catch(e){if(mounted.current)setSaveError(e instanceof Error?e.message:'Chưa lưu được hội thoại.');}
      finally{if(mounted.current)setCompleting(false);}
    }).catch((error: unknown) => {
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
    isBusy:()=>!!controller.current||editing||completing||!!saveError,
    sendSelection: (action, source) => send(action === 'translate' ? 'Dịch đoạn đã chọn sang tiếng Việt.' : 'Giải thích đoạn đã chọn.', correction?.source===source?correction.value:source, action),
  }));

  const filtered=pageOnly&&readerContext?turns.filter(turn=>!!turn.selection.cleanedText.trim()&&includesPage(turn.selection.scope,turn.selection.pageNumber,readerContext.currentPage)):turns;
  const visible=filtered.slice(-visibleCount);
  return <section className="ai-panel ask-chat" aria-label="Hội thoại Hỏi AI" data-selection-controls>
    <header className="chat-header">
      <strong>Hội thoại AI</strong>
      <details className="chat-help"><summary>Cách hỏi và lưu hội thoại</summary><small>Tô đen một đoạn để chọn Dịch hoặc Giải thích, hoặc viết yêu cầu vào ô bên dưới. PDF và chat tự lưu vào tài khoản. Để đọc lại, mở rộng tên tài liệu bên trái và chọn đoạn chat. Nội dung bạn chọn và các lượt chat gần nhất được gửi tới Google khi bạn hỏi AI.</small></details>
      <button type="button" disabled={!librarySession&&!turns.length} onClick={()=>void (librarySession?librarySession.onNew():flush().then(()=>change(()=>[]))).catch(e=>setSaveError(e.message))}>Đoạn chat mới</button>
    </header>
    {saveError&&<p role="alert">{saveError} <button onClick={()=>void persist().catch(e=>setSaveError(e.message))}>Thử lưu lại</button></p>}
    {readerContext&&<label className="chat-page-filter"><input type="checkbox" checked={pageOnly} onChange={event=>{setPageOnly(event.target.checked);setVisibleCount(20);}}/>Chỉ câu hỏi liên quan trang {readerContext.currentPage} ({filtered.length})</label>}
    <div className="chat-messages" ref={messages} onScroll={event => {
      const node = event.currentTarget;
      follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
    }}>
      {!turns.length && <div className="reader-chat-welcome">
        <div className="selection-gesture" aria-hidden="true"><span>một đoạn bạn muốn hiểu</span><svg viewBox="0 0 24 28" width="24" height="28"><path d="M3 2v21l5-5 4 8 4-2-4-8h8Z" fill="currentColor" stroke="var(--panel)" strokeWidth="1.5"/></svg></div>
        <h2>Tô đen một đoạn trong PDF để hỏi AI</h2>
        <p>Tô đen chữ ở bên trái rồi chọn Dịch, Giải thích hoặc viết câu hỏi bên dưới.</p>
        <small>Không tô đen được? Giữ chuột phải và kéo để nhận dạng chữ trong vùng chọn, hoặc bấm Nhận dạng chữ trong vùng. Bạn cũng có thể hỏi mà không kèm PDF.</small>
      </div>}

      {filtered.length>visibleCount&&<button type="button" onClick={()=>{follow.current=false;setVisibleCount(n=>n+20);}}>Xem thêm 20 lượt trước</button>}
      {pageOnly&&turns.length>0&&filtered.length===0&&<p>Chưa có câu hỏi liên quan trang này trong hội thoại hiện tại. Mở rộng thư mục PDF bên trái để xem các chat cũ.</p>}
      {visible.map((turn) => <article className="chat-turn" key={turn.id}>
        <div className="chat-user"><strong>Bạn</strong><p>{turn.question}</p>
          {turn.selection.cleanedText.trim()?<details open><summary>{scopeLabel(turn.selection.scope,turn.selection.pageNumber)}</summary><blockquote>{turn.selection.cleanedText}</blockquote></details>:<small>Không kèm đoạn PDF</small>}
        </div>
        <div className="chat-assistant"><strong>Trợ lý AI</strong>
          {turn.answer && <AiResponse action={turn.action ?? 'ask'} text={turn.answer} pageNumber={turn.selection.cleanedText.trim()?turn.selection.pageNumber:undefined} />}
          <p role="status">{turn.status === 'loading' ? 'Đang chuẩn bị câu trả lời…' : turn.status === 'streaming' ? 'Đang nhận phản hồi…'
            : turn.status === 'stopped' ? 'Đã dừng. Phần đã nhận được giữ lại.' : turn.status === 'ready' ? (completing&&turn.id===last?.id?'Đang lưu hội thoại…':saveError&&turn.id===last?.id?'Phản hồi xong · Chưa lưu được hội thoại.':'Đã hoàn tất.') : turn.answer ? 'Phản hồi bị ngắt · Nội dung chưa đầy đủ.' : 'Yêu cầu không hoàn tất.'}</p>
          {turn.error && <div className="ai-error" role="alert"><strong>{aiErrorTitle(turn.error.code)}</strong><p>{turn.error.message}</p></div>}
          {turn.answer && <CopyButton text={turn.answer} />}
          {turn.id===last?.id&&!busy&&turn.answer&&(turn.status==='stopped'||turn.status==='error')&&turn.error?.retryable!==false&&<button disabled={remaining>0} onClick={()=>send(`Tiếp tục ${turn.action==='translate'?'bản dịch sang tiếng Việt':'câu trả lời'} đang bị ngắt cho yêu cầu: ${turn.question.slice(0,1300)}. Nối tiếp phần đã nhận, tránh lặp lại. Nếu đã đủ nội dung, hãy nói rõ.`,turn.selection,'ask',turn)}>{remaining?`Tiếp tục sau ${formatWait(remaining)}`:'Tiếp tục phản hồi'}</button>}
          {turn.id === turns.at(-1)?.id && !busy && (turn.status === 'stopped' || turn.status === 'error') && turn.error?.retryable !== false &&
            <button disabled={remaining > 0} onClick={() => send(turn.question, turn.selection, turn.action)}>{remaining ? `Thử lại sau ${formatWait(remaining)}` : 'Thử lại câu hỏi'}</button>}
        </div>
      </article>)}
    </div>
    <form className="chat-composer" onSubmit={event => { event.preventDefault(); send(question, chosen); }}>
      {readerContext&&<details className="composer-context" open={preparing||!!contextError?true:undefined}>
        <summary>Phạm vi: <strong>{contextMode==='none'?'Không kèm PDF':contextMode==='selection'?'Đoạn tô đen':'Nhóm trang tự chọn'}</strong><span className="composer-context-state">{chosen?'Đã chọn nội dung':contextMode==='none'||contextMode==='selection'?'Có thể chat ngay':'Cần chuẩn bị'}</span></summary>
        <div className="reader-context-controls">
        <label>Phạm vi gửi AI<select aria-label="Phạm vi gửi AI" value={contextMode} disabled={busy} onChange={event=>{setContextMode(event.target.value as typeof contextMode);setContextError('');}}>
          <option value="none">Không kèm PDF</option><option value="selection">Đoạn tô đen</option><option value="pages">Nhóm trang tự chọn</option>
        </select></label>
        {contextMode==='pages'&&<label>Các trang<input aria-label="Các trang gửi AI" value={pageRange} placeholder="Ví dụ: 2-4, 8" maxLength={80} disabled={busy} onChange={event=>setPageRange(event.target.value)}/></label>}
        {(contextMode==='pages')&&<><label><input type="checkbox" checked={ocr} disabled={busy||preparing} onChange={e=>setOcr(e.target.checked)}/>Lấy chữ từ trang PDF dạng ảnh</label>{ocr&&<><label>Ngôn ngữ nhận dạng<select aria-label="Ngôn ngữ nhận dạng" value={ocrLanguage} disabled={preparing} onChange={e=>setOcrLanguage(e.target.value as OcrLanguage)}><option value="eng+vie">Anh + Việt</option><option value="eng">Tiếng Anh</option><option value="vie">Tiếng Việt</option></select></label><small>Chữ và công thức nhận dạng có thể chưa đúng. Kiểm tra bản xem trước trước khi gửi AI. Ảnh trang không rời máy.</small></>}</>}
        {(contextMode==='pages')&&<><button type="button" disabled={!readerContext.totalPages||preparing||busy||ownerScope==='guest'} onClick={()=>void prepare()}>{preparing?(ocr?'Đang nhận dạng chữ…':'Đang đọc chữ trên các trang đã chọn…'):'Đọc nội dung các trang'}</button><small>Tối đa 5 trang / 12.000 ký tự mỗi lượt. Chuẩn bị chỉ đọc trên máy, chưa gọi AI.</small></>}
        {preparing&&<><p role="status">{ocr?ocrProgress: "Đang chuẩn bị ngữ cảnh…"}</p><button type="button" onClick={()=>preparation.current?.abort()}>Hủy chuẩn bị</button></>}
        {contextError&&<p role="alert">{contextError}</p>}
      </div>
      {chosen&&<details className="context-preview"><summary>Xem toàn bộ nội dung sẽ gửi AI</summary><pre>{chosen.cleanedText}</pre><small>Kèm tối đa 6 lượt chat gần nhất, tối đa 6.000 ký tự; không gửi toàn bộ lịch sử hay toàn bộ PDF.</small></details>}
      {(contextMode==='pages')&&!chosen&&<small>Nhập số trang, bấm Đọc nội dung các trang rồi kiểm tra trước khi gửi câu hỏi.</small>}
      </details>}
      {chosen&&<ChatExcerptPreview selection={chosen} onEdit={chosen.ocr===true?()=>{if(!originalChosen)return;setEditSource(originalChosen);setOcrDraft(chosen.cleanedText);setEditError('');}:undefined} onClose={()=>{if(contextMode==='selection'){onClearSelection();}else setPrepared(null);}} />}
      {editing&&<div className="ocr-edit-panel"><label>Chữ đã nhận dạng<textarea aria-label="Sửa nội dung đã nhận dạng" value={ocrDraft} maxLength={12000} rows={5} onChange={e=>setOcrDraft(e.target.value)}/></label><small>Sửa lại chữ, số liệu và công thức trước khi gửi. Chưa lưu thì AI chưa nhận nội dung mới.</small>{editError&&<p role="alert">{editError}</p>}<button type="button" onClick={saveCorrection}>Lưu chữ đã sửa</button><button type="button" onClick={()=>{setEditSource(null);setEditError('');}}>Hủy sửa</button></div>}
      {!chosen&&(contextMode==='selection'||contextMode==='none')&&<small className="chat-general-hint">Không kèm đoạn PDF. Bạn vẫn có thể hỏi AI; nội dung chưa gửi của tài liệu không được tự đọc.</small>}
      {!librarySession&&<small className="chat-general-hint">Chưa lưu được chat. Hãy kiểm tra thư viện trước khi rời trang.</small>}
      <label className="composer-question-label" htmlFor="chat-question">Câu hỏi của bạn</label>
      <div className="chat-input-row"><textarea id="chat-question" value={question} maxLength={2000} rows={2} placeholder={chosen?"Hỏi về đoạn đã chọn hoặc yêu cầu AI hỗ trợ…":"Nhập câu hỏi hoặc yêu cầu của bạn…"}
        onChange={event => setQuestion(event.target.value)} onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
        }} />
      {busy ? <button type="button" onClick={() => controller.current?.abort()}>Dừng phản hồi</button>
        : <button aria-label="Gửi câu hỏi" title="Gửi câu hỏi" disabled={editing || completing || ownerScope === 'guest' || (!chosen && (contextMode==='pages')) || preparing || !question.trim() || remaining > 0}>{remaining ? `Chờ ${formatWait(remaining)}` : '↑'}</button>}</div>
      <details className="composer-shortcuts"><summary>Phím tắt và lượt AI</summary><small>Enter để gửi · Shift+Enter để xuống dòng. Tiếp tục/Thử lại là lượt AI mới.</small></details>
    </form>
  </section>;
}
