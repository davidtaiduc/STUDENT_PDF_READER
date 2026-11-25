import {useEffect,useRef,useState,type RefObject} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import type {PdfSelection} from '../../types/selection';
import {extractOcrRegion,type OcrLanguage} from '../../services/pdf/ocr';
import {regionFromPoints,type NormalizedRegion} from '../../services/pdf/ocrRegion';
interface Area {region:NormalizedRegion;rect:DOMRect}
export default function PdfRegionOcr({pdf,pageNumber,rootRef,onSelection}:{pdf:PDFDocumentProxy;pageNumber:number;rootRef:RefObject<HTMLElement|null>;onSelection:(selection:PdfSelection|null)=>void}){
 const [area,setArea]=useState<Area|null>(null),[armed,setArmed]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const [language,setLanguage]=useState<OcrLanguage>('eng+vie');
 const armedRef=useRef(armed),languageRef=useRef(language),controller=useRef<AbortController|null>(null);
 useEffect(()=>{armedRef.current=armed;languageRef.current=language;});
 const pageElement=()=>rootRef.current?.querySelector<HTMLElement>('.pdf-page');
 const toArea=(region:NormalizedRegion):Area|null=>{const bounds=pageElement()?.getBoundingClientRect();return bounds?{region,rect:new DOMRect(bounds.left+bounds.width*region.x,bounds.top+bounds.height*region.y,bounds.width*region.width,bounds.height*region.height)}:null;};
 const run=async(selected:Area)=>{
  controller.current?.abort();const abort=new AbortController();controller.current=abort;
  setBusy(true);setError('');setStatus('Đang nhận dạng vùng chọn…');onSelection(null);
  try{const text=await extractOcrRegion(pdf,pageNumber,selected.region,abort.signal,{language:languageRef.current,onProgress:setStatus});
   if(abort.signal.aborted)return;const updated=toArea(selected.region);if(!updated)return;
   onSelection({ocr:true,source:'pdf',scope:{kind:'selection',pages:[pageNumber]},pageNumber,text,rawText:text,cleanedText:text,context:{before:'Nội dung được nhận dạng từ vùng người dùng chọn; có thể nhận sai chữ hoặc công thức.',after:''},rect:updated.rect,rects:[updated.rect]});setStatus('Đã nhận dạng vùng chọn. Kiểm tra chữ trong khung AI trước khi gửi.');
  }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Không nhận dạng được vùng chọn.');}
  finally{if(controller.current===abort){setBusy(false);controller.current=null;}}
 };
 const runRef=useRef(run);useEffect(()=>{runRef.current=run;});
 useEffect(()=>{const root=rootRef.current;if(!root)return;root.dataset.regionOcrArmed=String(armed);return()=>{delete root.dataset.regionOcrArmed;};},[armed,rootRef]);
 useEffect(()=>{
  const root=rootRef.current;if(!root)return;const events=new AbortController();
  let suppressMenuUntil=0;
  let drag:{x:number;y:number;page:HTMLElement;pointer:number}|null=null;
  const clear=()=>{drag=null;controller.current?.abort();setArea(null);setArmed(false);setStatus('');setError('');};
  root.addEventListener('pointerdown',e=>{
   if(!(e.target instanceof Element)||e.target.closest('[data-selection-controls]'))return;
   const page=e.target.closest<HTMLElement>('.pdf-page');if(!page)return;
   if(e.button===0&&!armedRef.current){controller.current?.abort();setArea(null);onSelection(null);return;}
   if(e.button!==2&&!(armedRef.current&&e.button===0)||e.shiftKey)return;
   e.preventDefault();e.stopPropagation();controller.current?.abort();onSelection(null);window.getSelection()?.removeAllRanges();
   if(e.button===2)suppressMenuUntil=Date.now()+60000;
   drag={x:e.clientX,y:e.clientY,page,pointer:e.pointerId};root.setPointerCapture(e.pointerId);setStatus('');setError('');setArea(null);
  },{capture:true,signal:events.signal});
  const update=(e:PointerEvent)=>{if(!drag||e.pointerId!==drag.pointer)return null;const bounds=drag.page.getBoundingClientRect();const region=regionFromPoints({x:drag.x,y:drag.y},{x:e.clientX,y:e.clientY},bounds);const selected={region,rect:new DOMRect(bounds.left+region.x*bounds.width,bounds.top+region.y*bounds.height,region.width*bounds.width,region.height*bounds.height)};setArea(selected);return selected;};
  root.addEventListener('pointermove',e=>{if(drag){e.preventDefault();update(e);}},{signal:events.signal});
  root.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointer)return;e.preventDefault();const selected=update(e);if(e.button===2)suppressMenuUntil=Date.now()+1000;drag=null;if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);setArmed(false);if(selected&&selected.rect.width>=8&&selected.rect.height>=8)void runRef.current(selected);else setArea(null);},{signal:events.signal});
  root.addEventListener('pointercancel',clear,{signal:events.signal});
  root.addEventListener('lostpointercapture',()=>{if(drag)clear();},{signal:events.signal});
  root.addEventListener('contextmenu',e=>{if(!e.shiftKey&&(Date.now()<suppressMenuUntil||e.target instanceof Element&&e.target.closest('.pdf-page')))e.preventDefault();},{signal:events.signal});
  root.addEventListener('scroll',clear,{capture:true,signal:events.signal});
  window.addEventListener('keydown',e=>{if(e.key==='Escape')clear();},{signal:events.signal});
  window.addEventListener('resize',clear,{signal:events.signal});
  window.addEventListener('scroll',e=>{if(e.target===document)clear();},{capture:true,signal:events.signal});
  let previous=root.getBoundingClientRect();const observer=new ResizeObserver(()=>{const next=root.getBoundingClientRect();if(next.width!==previous.width||next.height!==previous.height)clear();previous=next;});observer.observe(root);
  return()=>{observer.disconnect();events.abort();controller.current?.abort();};
 },[pdf,pageNumber,rootRef,onSelection]);
 return <>
  <div className="region-ocr-controls" data-selection-controls>
   <button type="button" aria-pressed={armed} onClick={()=>{controller.current?.abort();setArmed(v=>!v);setStatus('');setError('');}}><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8M8 12h8M8 16h5"/></svg><span>{armed?'Hủy chọn vùng':'Nhận dạng chữ trong vùng'}</span></button><div className="region-selection-guide"><span><strong>Chuột trái</strong><span>Kéo để tô đen chữ</span></span><span><strong>Chuột phải</strong><span>Giữ và kéo để lấy chữ từ ảnh</span></span></div>
  </div>
  {armed&&<p className="region-ocr-hint" role="status" data-selection-controls>Kéo chuột trái hoặc chạm và kéo để khoanh vùng chứa chữ. Thả tay để nhận dạng. Nhấn Esc hoặc bấm Hủy chọn vùng để hủy.</p>}
  {area&&<div className="region-ocr-box" aria-hidden="true" style={{left:area.rect.left,top:area.rect.top,width:area.rect.width,height:area.rect.height}}/>}
  {(area||busy||error)&&<section className="region-ocr-status" aria-label="Nhận dạng chữ trong vùng đã chọn" data-selection-controls>
   <label>Ngôn ngữ nhận dạng<select aria-label="Ngôn ngữ nhận dạng vùng" value={language} disabled={busy} onChange={e=>setLanguage(e.target.value as OcrLanguage)}><option value="eng+vie">Anh + Việt</option><option value="eng">Tiếng Anh</option><option value="vie">Tiếng Việt</option></select></label>
   {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
   {busy?<button type="button" onClick={()=>{controller.current?.abort();setStatus('Đã hủy nhận dạng chữ.');}}>Hủy nhận dạng</button>:area&&<button type="button" onClick={()=>void run(area)}>Nhận dạng lại vùng</button>}
   <button type="button" onClick={()=>{controller.current?.abort();setArea(null);setStatus('');setError('');setArmed(false);}}>Đóng nhận dạng</button>
  </section>}
 </>;
}
