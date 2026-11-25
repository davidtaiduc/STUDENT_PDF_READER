import {useEffect,useState} from 'react';
import {GENERAL_CHAT_ID,listChats,type ChatSummary} from '../../services/library/store';
import type {OwnerScope} from '../../services/ownerScope';
export default function GeneralChatNavigation({owner,revision,activeChatId,working,onOpen,onRename,onDelete}:{owner:OwnerScope|null;revision:number;activeChatId?:string;working:boolean;onOpen:(id?:string)=>void;onRename:(documentId:string,id:string,title:string)=>Promise<void>;onDelete:(documentId:string,id:string)=>Promise<void>}){
 const [rows,setRows]=useState<ChatSummary[]>([]),[error,setError]=useState(''),[edit,setEdit]=useState<{id:string;mode:'rename'|'delete'}|null>(null),[name,setName]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!owner)return;let active=true;void listChats(owner,GENERAL_CHAT_ID).then(data=>{if(active){setRows(data);setError('');}}).catch(()=>{if(active)setError('Không tải được chat không gắn PDF.');});return()=>{active=false;};},[owner,revision]);
 const submit=async()=>{if(!edit)return;setBusy(true);setError('');try{if(edit.mode==='rename')await onRename(GENERAL_CHAT_ID,edit.id,name);else await onDelete(GENERAL_CHAT_ID,edit.id);setEdit(null);}catch(e){setError(e instanceof Error?e.message:'Không cập nhật được chat.');}finally{setBusy(false);}};
 return <section className="general-chat-navigation" aria-label="Chat không gắn PDF" inert={working}>
  <div className="general-chat-heading"><strong>Chat không gắn PDF</strong><button disabled={!owner||busy} onClick={()=>onOpen()}>＋ Chat mới</button></div>
  {rows.map(chat=><div className="general-chat-row" key={chat.id}>
   <button className="general-chat-link" aria-current={chat.id===activeChatId?'true':undefined} title={chat.title} disabled={busy} onClick={()=>onOpen(chat.id)}>{chat.title}</button>
   <button aria-label={`Đổi tên chat ${chat.title}`} disabled={busy} onClick={()=>{setName(chat.title);setEdit({id:chat.id,mode:'rename'});}}>✎</button>
   <button aria-label={`Xóa chat ${chat.title}`} disabled={busy} onClick={()=>setEdit({id:chat.id,mode:'delete'})}>×</button>
   {edit?.id===chat.id&&<form onSubmit={e=>{e.preventDefault();void submit();}}>{edit.mode==='rename'?<label>Tên chat<input aria-label="Tên chat không gắn PDF" value={name} maxLength={100} required disabled={busy} onChange={e=>setName(e.target.value)}/></label>:<p>Xóa chat “{chat.title}”?</p>}<button disabled={busy}>{edit.mode==='rename'?'Lưu tên chat':'Xác nhận xóa chat'}</button><button type="button" disabled={busy} onClick={()=>setEdit(null)}>Hủy</button></form>}
  </div>)}
  {!rows.length&&<p>Chat sẽ được lưu tại đây khi bạn gửi câu hỏi.</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
