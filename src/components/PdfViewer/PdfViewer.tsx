import {useLibraryAutoSync} from '../../hooks/useLibraryAutoSync';
import PdfRegionOcr from './PdfRegionOcr';
import {extractOcrContext,type OcrOptions} from '../../services/pdf/ocr';
import {useAuth} from '../Auth/context';
import type {OwnerScope} from '../../services/ownerScope';
import {MAX_PDF_BYTES} from '../../../shared/ai/contextScope';
import {extractPageContext} from '../../services/pdf/pageContext';
import type {PdfSelection} from '../../types/selection';
import type { ChatActionHandle } from '../AiPanel/ChatPanel';
import DocumentNavigation from './DocumentNavigation';
import {GENERAL_CHAT_ID,subscribeLibrary,renameDocument,deleteDocument,renameChat,deleteChat,pdfId,saveDocument,listDocuments,loadDocument,loadChat,type LibraryDocument,type LibrarySession} from '../../services/library/store';
import ReaderSplitPane from './ReaderSplitPane';
import PdfSelectionActions from './PdfSelectionActions';
import { useOwnerScope } from '../Auth/useOwnerScope';
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { pdfjsLib, pdfAssetBase } from "../../lib/pdf";
import PdfPage from "./PdfPage";
import PdfToolbar from "./PdfToolbar";
import { usePdfSelection } from "../../hooks/usePdfSelection";
import ReaderAssistant from "../AiPanel/ReaderAssistant";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const STEP = 0.1;
const round1 = (n: number) => Math.round(n * 10) / 10;

export default function PdfViewer({documentsOpen,onToggleDocuments,onDocumentChange}:{documentsOpen:boolean;onToggleDocuments:()=>void;onDocumentChange:(name:string)=>void}) {
  const ownerScope = useOwnerScope();
  const {user}=useAuth();
  // File pickers temporarily blur the window and trigger an auth refresh.
  // Keep the input and in-flight PDF tied to the account, not the checking state.
  const sessionOwner:OwnerScope=user?`user:${user.id}`:'guest';
  const [documentOwner,setDocumentOwner]=useState<typeof ownerScope>(null);
  const [currentDocumentId,setCurrentDocumentId]=useState('');
  const [documents,setDocuments]=useState<LibraryDocument[]>([]);
  const [librarySession,setLibrarySession]=useState<LibrarySession>(()=>newSession(sessionOwner,GENERAL_CHAT_ID));
  const [libraryOwner,setLibraryOwner]=useState(sessionOwner);
  if(libraryOwner!==sessionOwner){setLibraryOwner(sessionOwner);setLibrarySession(newSession(sessionOwner,GENERAL_CHAT_ID));}
  const [libraryRevision,setLibraryRevision]=useState(0);
  const ownerRef=useRef(sessionOwner);
  ownerRef.current=sessionOwner;
  const [fitToWidth,setFitToWidth]=useState(true);
  const chatActionRef=useRef<ChatActionHandle>(null);
  const canAutoSync=useCallback(()=>!chatActionRef.current?.isBusy(),[]);
  useLibraryAutoSync(sessionOwner,canAutoSync);
  const [chatReveal,setChatReveal]=useState(0);
  const viewerContainerRef=useRef<HTMLElement>(null);

  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const requestRef = useRef(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [documentVersion, setDocumentVersion] = useState(0);
  const [storageWarning, setStorageWarning] = useState("");

  const navigate=(page:number)=>setCurrentPage(page);
  const viewerRef = useRef<HTMLDivElement>(null);
  const selectionScope = `${ownerScope}-${documentVersion}-${pdf?.fingerprints[0] ?? "empty"}-${currentPage}-${scale}`;
  const nativeSelection = usePdfSelection(viewerRef, selectionScope);
  const ocrScope=`${sessionOwner}-${documentVersion}-${currentPage}-${scale}`;
  const [regionSelection,setRegionSelection]=useState<{scope:string;value:PdfSelection|null}|null>(null);
  const receiveRegion=useCallback((value:PdfSelection|null)=>setRegionSelection({scope:ocrScope,value}),[ocrScope]);
  const selection=nativeSelection??(regionSelection?.scope===ocrScope?regionSelection.value:null);

  const fittedScale = useCallback((pageWidth: number) => {
    const root = viewerRef.current;
    if (!root || !pageWidth) return 1.2;
    const style = getComputedStyle(root);
    const available = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.floor(available / pageWidth * 100) / 100));
  }, []);

  function handleFitWidth() {
    setFitToWidth(true);
    const page = viewerRef.current?.querySelector<HTMLElement>(".pdf-page");
    if (page?.offsetWidth) setScale(fittedScale(parseFloat(page.style.width) / scale));
  }

  useEffect(()=>subscribeLibrary(()=>setLibraryRevision(n=>n+1)),[]);
  useEffect(()=>{let active=true;if(ownerScope)void listDocuments(ownerScope).then(rows=>{if(active)setDocuments(rows);}).catch(e=>{if(active)setStorageWarning(e.message);});return()=>{active=false;};},[ownerScope,libraryRevision]);
  function newSession(owner:NonNullable<typeof ownerScope>,documentId:string,chat?:Awaited<ReturnType<typeof loadChat>>):LibrarySession{
    return {owner,documentId,chatId:chat?.id??crypto.randomUUID(),turns:chat?.turns??[],revision:chat?.revision??0,onSaved:()=>setLibraryRevision(n=>n+1),onNew:async()=>{await chatActionRef.current?.flush();setLibrarySession(newSession(owner,documentId));}};
  }
  async function openGeneralChat(chatId?:string){
    const owner=ownerRef.current;
    try{await chatActionRef.current?.flush();const chat=chatId?await loadChat(owner,GENERAL_CHAT_ID,chatId):undefined;if(ownerRef.current!==owner)return;await closeDocument();setLibrarySession(newSession(owner,GENERAL_CHAT_ID,chat));}
    catch(e){setStorageWarning(e instanceof Error?e.message:'Không mở được chat đã lưu.');}
  }
  async function closeDocument(){
    ++requestRef.current;setDocumentVersion(requestRef.current);setPdf(null);setLoading(false);setError(null);setFileName('');setCurrentDocumentId('');setLibrarySession(newSession(ownerRef.current,GENERAL_CHAT_ID));onDocumentChange('');const task=loadingTaskRef.current;loadingTaskRef.current=null;await task?.destroy();
  }
  async function renameLibraryDocument(id:string,name:string){const owner=ownerRef.current;await renameDocument(owner,id,name);if(currentDocumentId===id&&documentOwner===owner){setFileName(name.trim());onDocumentChange(name.trim());}setLibraryRevision(n=>n+1);}
  async function deleteLibraryDocument(id:string){const owner=ownerRef.current;if(currentDocumentId===id)await chatActionRef.current?.flush();await deleteDocument(owner,id);if(currentDocumentId===id&&ownerRef.current===owner)await closeDocument();setLibraryRevision(n=>n+1);}
  async function renameLibraryChat(documentId:string,id:string,title:string){
    const owner=ownerRef.current;await renameChat(owner,documentId,id,title);setLibraryRevision(n=>n+1);
  }
  async function deleteLibraryChat(documentId:string,id:string){
    const owner=ownerRef.current;
    if(librarySession?.owner===owner&&librarySession.chatId===id)await chatActionRef.current?.flush();
    await deleteChat(owner,documentId,id);
    if(ownerRef.current===owner)setLibrarySession(current=>current?.owner===owner&&current.chatId===id?newSession(owner,documentId):current);
    setLibraryRevision(n=>n+1);
  }
  async function openSaved(id:string,chatId?:string){
    const owner=ownerRef.current;
    try{await chatActionRef.current?.flush();const file=await loadDocument(owner,id);const chat=chatId?await loadChat(owner,id,chatId):undefined;if(ownerRef.current===owner)await handleOpenFile(file,chat,true);}
    catch(e){setStorageWarning(e instanceof Error?e.message:'Không mở được tài liệu đã lưu.');}
  }
  async function handleOpenFile(file: File,chat?:Awaited<ReturnType<typeof loadChat>>,flushed=false) {
    const owner=ownerRef.current;
    if(file.size>MAX_PDF_BYTES){setStorageWarning('File vượt giới hạn 150MB.');return;}
    if(!flushed){try{await chatActionRef.current?.flush();}catch(e){setStorageWarning(e instanceof Error?e.message:'Chat chưa lưu được.');return;}}
    setDocumentOwner(owner);
    const request = ++requestRef.current;
    setDocumentVersion(request);
    const previousTask = loadingTaskRef.current;
    loadingTaskRef.current = null;
    setPdf(null);
    setStorageWarning("");
    setLoading(true);
    setError(null);
    setFileName(file.name);setFitToWidth(true);onDocumentChange(file.name);
    try {
      await previousTask?.destroy();
      if (request !== requestRef.current) return;
      const data = await file.arrayBuffer();
      if (request !== requestRef.current) return;
      const id=await pdfId(data);
      // PDF.js transfers data to its worker. Keep bytes for cross-browser IDB storage.
      const persistedData=data.slice(0);
      if(request!==requestRef.current||ownerRef.current!==owner)return;
      const task = pdfjsLib.getDocument({
        data,
        cMapUrl: `${pdfAssetBase}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${pdfAssetBase}standard_fonts/`,
        wasmUrl: `${pdfAssetBase}wasm/`,
      });
      loadingTaskRef.current = task;
      const document = await task.promise;
      if (request !== requestRef.current) return;
      const firstPage = await document.getPage(1);
      if (request !== requestRef.current) return;
      if(ownerRef.current!==owner)return;
      try{await saveDocument(owner,id,file,persistedData);if(request!==requestRef.current||ownerRef.current!==owner)return;setLibraryRevision(n=>n+1);setCurrentDocumentId(id);setLibrarySession(newSession(owner,id,chat));}
      catch(e){setStorageWarning(e instanceof Error?e.message:'Không lưu được PDF.');setLibrarySession(newSession(ownerRef.current,GENERAL_CHAT_ID));setCurrentDocumentId('');}
      setPdf(document);
      setCurrentPage(1);
      setScale(fittedScale(firstPage.getViewport({ scale: 1 }).width));

    } catch (err) {
      if (request !== requestRef.current) return;
      console.error("PDF loading failed:", err);
      const failedTask = loadingTaskRef.current;
      loadingTaskRef.current = null;
      if (failedTask) void failedTask.destroy().catch(console.error);
      setError("Không mở được PDF. File có thể bị hỏng hoặc yêu cầu mật khẩu. Hãy thử file khác.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }

  useEffect(() => () => {
    ++requestRef.current;
    const task = loadingTaskRef.current;
    loadingTaskRef.current = null;
    if (task) void task.destroy().catch(console.error);
  }, []);

  const prepareContext=async(pages:number[],signal:AbortSignal,options?:OcrOptions):Promise<PdfSelection>=>{
    if(!pdf||!ownerScope||documentOwner!==ownerScope)throw new Error('Hãy mở PDF trước.');
    const version=requestRef.current;
    const cleanedText=options?.ocr?await extractOcrContext(pdf,pages,signal,options):await extractPageContext(pdf,pages,signal);
    signal.throwIfAborted();if(version!==requestRef.current)throw new Error('Tài liệu đã thay đổi. Hãy chuẩn bị ngữ cảnh lại.');
    return {ocr:options?.ocr??false,source:'pdf',scope:{kind:pages.length===1?'page':'pages',pages},pageNumber:pages[0],cleanedText,text:cleanedText,rawText:cleanedText,context:{before:'',after:''},rect:new DOMRect(),rects:[]};
  };
  useEffect(()=>{
    const root=viewerRef.current;
    if(!pdf||!fitToWidth||!root)return;
    let active=true;let observer:ResizeObserver|undefined;
    void pdf.getPage(currentPage).then(page=>{
      if(!active)return;
      const width=page.getViewport({scale:1}).width;
      const fit=()=>{if(active&&root.clientWidth>0)setScale(old=>{const next=fittedScale(width);return old===next?old:next;});};
      observer=new ResizeObserver(fit);observer.observe(root);fit();
    }).catch(()=>{});
    return()=>{active=false;observer?.disconnect();};
  },[pdf,currentPage,fitToWidth,fittedScale]);
  const totalPages = documentOwner===ownerScope?(pdf?.numPages??0):0;
  return (
    <div className="reader-shell" data-documents-open={documentsOpen}>
    {documentsOpen&&<DocumentNavigation onOpenGeneral={id=>void openGeneralChat(id)} working={false} onRenameDocument={renameLibraryDocument} onDeleteDocument={deleteLibraryDocument} onRenameChat={renameLibraryChat} onDeleteChat={deleteLibraryChat} key={sessionOwner} owner={ownerScope} revision={libraryRevision} activeChatId={librarySession?.chatId} onOpenDocument={(id,chatId)=>void openSaved(id,chatId)} documents={documents.filter(item=>item.owner===ownerScope)} currentId={currentDocumentId} onOpenFile={file=>{void handleOpenFile(file);}} onToggle={onToggleDocuments} />}
    <ReaderSplitPane chatReveal={chatReveal} pdf={
      <section hidden={!!documentOwner&&documentOwner!==ownerScope} ref={viewerContainerRef} className="viewer" aria-label="Tài liệu PDF">
      <div className="document-name" title={fileName}>{fileName || "Mở PDF trên máy để bắt đầu đọc"}</div>
      {storageWarning && <p className="storage-warning" role="status">{storageWarning}</p>}
      {pdf&&<PdfRegionOcr key={ocrScope} pdf={pdf} pageNumber={currentPage} rootRef={viewerContainerRef} onSelection={receiveRegion}/> }
      <div className="viewer-scroll" ref={viewerRef} aria-busy={loading}>
        {loading && <p className="hint" role="status">Đang mở PDF…</p>}
        {error && <p className="hint error" role="alert">{error}</p>}
        {!loading && !error && !pdf && <p className="hint">Mở danh sách tài liệu bằng nút ☰, rồi chọn “Mở PDF mới”. Tài liệu đã lưu sẽ xuất hiện trong danh sách để bạn đọc lại.</p>}
        {pdf && <PdfPage key={`${documentVersion}-${pdf.fingerprints[0]}-${currentPage}`} pdf={pdf} pageNumber={currentPage} scale={scale} />}
      </div>
      <PdfToolbar compact currentPage={currentPage} totalPages={totalPages} scale={scale}
        onOpenFile={(file) => { void handleOpenFile(file); }}
        onPrev={() => navigate(Math.max(1,currentPage-1))}
        onNext={() => navigate(Math.min(totalPages,currentPage+1))}
        onPageChange={(page) => navigate(Math.max(1, Math.min(totalPages, page)))}
        onZoomIn={() => {setFitToWidth(false);setScale((value) => Math.min(MAX_SCALE, round1(value + STEP)));}}
        onZoomOut={() => {setFitToWidth(false);setScale((value) => Math.max(MIN_SCALE, round1(value - STEP)));}}
        onFitWidth={handleFitWidth} />
      {ownerScope && <PdfSelectionActions onAction={(action,source)=>{const accepted=chatActionRef.current?.sendSelection(action,source)??false;if(accepted)setChatReveal(value=>value+1);return accepted;}} containerRef={viewerContainerRef} key={`${documentVersion}-${ownerScope}`} ownerScope={ownerScope} selection={selection} />}
      </section>
      } chat={<div className="library-chat-container"><ReaderAssistant librarySession={librarySession} actionRef={chatActionRef} key={documentVersion} fileName={fileName}
        selection={documentOwner===ownerScope?selection:null}
        readerContext={{currentPage,totalPages,prepare:prepareContext}} /></div>} />
    </div>
  );
}
