import { useLayoutEffect, useState, type RefObject } from 'react';
import type { PdfSelection } from '../../types/selection';
import type { OwnerScope } from '../../services/ownerScope';
import type { AiAction } from '../../types/ai';
export default function PdfSelectionActions({selection,ownerScope,containerRef,onAction}:{onAction:(action:AiAction,source:PdfSelection)=>boolean;selection:PdfSelection|null;ownerScope:OwnerScope;containerRef:RefObject<HTMLElement|null>}) {
  const [captured,setCaptured]=useState(selection),[closed,setClosed]=useState<PdfSelection|null>(null);
  const [position,setPosition]=useState({left:12,top:80});
  const [notice,setNotice]=useState('');
  const source=selection??captured;
  const key=source?JSON.stringify([source.pageNumber,source.cleanedText,source.context]):'';
  const [previous,setPrevious]=useState(key);
  if(selection&&selection!==captured)setCaptured(selection);
  if(key!==previous){setPrevious(key);if(notice)setNotice('');if(closed)setClosed(null);}
  useLayoutEffect(()=>{
    const root=containerRef.current;
    if(!root||!selection)return;
    const bounds=root.getBoundingClientRect(),rect=selection.rect;
    const left=Math.max(8,Math.min(bounds.width-248,rect.left-bounds.left));
    const above=rect.top-bounds.top-46;
    const top=above>8?above:Math.min(bounds.height-56,rect.bottom-bounds.top+8);
    setPosition({left,top:Math.max(8,top)});
  },[selection,containerRef]);
  if(!source||closed===source)return null;
  const close=()=>{setClosed(source);setNotice('');setCaptured(null);window.getSelection()?.removeAllRanges();};
  const submit=(action:AiAction)=>{if(onAction(action,source))close();else setNotice('Chưa thể gửi. Hãy chờ phản hồi hiện tại hoặc kiểm tra trạng thái trong chat AI.');};
  return <>
    {selection&&<section className="pdf-selection-actions selection-floating-tools" aria-label="Dịch và giải thích đoạn PDF" data-selection-controls style={position}>
      <button disabled={ownerScope==='guest'} title={ownerScope==='guest'?'Đăng nhập để dịch':'Dịch đoạn đã chọn'} onClick={()=>submit('translate')}>Dịch</button>
      <button disabled={ownerScope==='guest'} title={ownerScope==='guest'?'Đăng nhập để giải thích':'Giải thích đoạn đã chọn'} onClick={()=>submit('explain')}>Giải thích</button>
      <span aria-hidden="true" className="floating-tool-separator" />
      <button className="selection-dismiss" aria-label="Đóng dịch và giải thích" title="Bỏ vùng công cụ" onClick={close}>×</button>
    </section>}
    {notice&&<p className="selection-action-notice" role="status" data-selection-controls>{notice}</p>}
  </>;
}
