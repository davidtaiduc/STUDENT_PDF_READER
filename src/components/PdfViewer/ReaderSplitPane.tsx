import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
export default function ReaderSplitPane({pdf,chat,chatReveal=0}:{pdf:ReactNode;chat:ReactNode;chatReveal?:number}) {
  const root=useRef<HTMLDivElement>(null), [width,setWidth]=useState(50),[collapsed,setCollapsed]=useState<'pdf'|'ai'|null>(null);
  const [lastReveal,setLastReveal]=useState(chatReveal);
  if(chatReveal!==lastReveal){setLastReveal(chatReveal);if(collapsed==='ai')setCollapsed(null);}
  const [dragging,setDragging]=useState(false);
  const limits=()=>{const available=Math.max(1,root.current?.clientWidth??1000);return {min:Math.max(20,Math.min(40,260/available*100)),max:Math.min(85,Math.max(60,100-300/available*100))};};
  const clamp=(value:number)=>{const bounds=limits();return Math.max(bounds.min,Math.min(bounds.max,value));};
  return <div ref={root} className="reader-workspace resizable-reader" data-collapsed={collapsed??''} data-resizing={dragging} style={{'--pdf-width':`${width}%`} as CSSProperties}>
    <div className="split-pdf" id="reader-pdf-pane" hidden={collapsed==='pdf'}>{pdf}</div>
    <div className="split-divider">
      <button type="button" title={collapsed==='pdf'?'Mở lại PDF':'Thu gọn PDF'} aria-label={collapsed==='pdf'?'Mở lại PDF':'Thu gọn PDF'} aria-expanded={collapsed!=='pdf'} aria-controls="reader-pdf-pane" onClick={()=>setCollapsed(old=>old==='pdf'?null:'pdf')}>{collapsed==='pdf'?'›':'‹'}</button>
      <div className="split-resize-handle" role="separator" tabIndex={0} aria-label="Điều chỉnh chiều rộng PDF và AI" aria-orientation="vertical" aria-valuemin={20} aria-valuemax={85} aria-valuenow={Math.round(width)} aria-disabled={!!collapsed}
        onDoubleClick={()=>{setWidth(50);setCollapsed(null);}}
        onKeyDown={event=>{if(collapsed)return;const value=event.key==='ArrowLeft'?width-2:event.key==='ArrowRight'?width+2:event.key==='Home'?limits().min:event.key==='End'?limits().max:null;if(value!==null){event.preventDefault();setWidth(clamp(value));}}}
        onPointerDown={event=>{if(collapsed||event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);}}
        onPointerMove={event=>{if(!dragging||!root.current)return;const bounds=root.current.getBoundingClientRect();setWidth(clamp((event.clientX-bounds.left)/Math.max(1,bounds.width-8)*100));}}
        onPointerUp={()=>setDragging(false)} onPointerCancel={()=>setDragging(false)} onLostPointerCapture={()=>setDragging(false)}><span>⋮</span></div>
      <button type="button" title={collapsed==='ai'?'Mở lại Hỏi AI':'Thu gọn Hỏi AI'} aria-label={collapsed==='ai'?'Mở lại Hỏi AI':'Thu gọn Hỏi AI'} aria-expanded={collapsed!=='ai'} aria-controls="reader-ai-pane" onClick={()=>setCollapsed(old=>old==='ai'?null:'ai')}>{collapsed==='ai'?'‹':'›'}</button>
    </div>
    <div className="split-ai" id="reader-ai-pane" hidden={collapsed==='ai'}>{chat}</div>
  </div>;
}
