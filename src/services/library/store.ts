import {assertOwnerScope,type OwnerScope} from '../ownerScope.ts';
import type {ChatTurn} from '../../types/chat.ts';
export const GENERAL_CHAT_ID="0".repeat(64);
export interface LibraryDocument {kind?:'general';owner:OwnerScope;id:string;name:string;size:number;openedAt:number;nextChatNumber:number;updatedAt?:number;deletedAt?:number}
interface StoredDocument extends LibraryDocument {blob:Blob|ArrayBuffer}
export interface LibraryChat {owner:OwnerScope;id:string;documentId:string;title:string;updatedAt:number;revision:number;turns:ChatTurn[];deletedAt?:number}
export type ChatSummary=Omit<LibraryChat,'turns'>;
export interface LibrarySession {owner:OwnerScope;documentId:string;chatId:string;turns:ChatTurn[];revision:number;onSaved:()=>void;onNew:()=>Promise<void>}
const changes=new EventTarget();
const erasedOwners=new Set<OwnerScope>();
const generalOwners=new Set<OwnerScope>();
function writableOwner(owner:OwnerScope){assertOwnerScope(owner);if(erasedOwners.has(owner))throw new Error('Dữ liệu tài khoản đã bị xóa.');}
let broadcast:BroadcastChannel|undefined;
export function subscribeLibrary(listener:()=>void){
 if(typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined'&&!broadcast){broadcast=new BroadcastChannel('studypdf-library-changes');broadcast.onmessage=e=>{if(e.data?.type==='owner-erased'){try{assertOwnerScope(e.data.owner);erasedOwners.add(e.data.owner);}catch{/* Ignore malformed messages. */}}changes.dispatchEvent(new Event('changed'));};}
 changes.addEventListener('changed',listener);return()=>changes.removeEventListener('changed',listener);
}
function announce(){changes.dispatchEvent(new Event('changed'));broadcast?.postMessage('changed');}
let connection:Promise<IDBDatabase>|undefined;
function open(){
 if(connection)return connection;
 connection=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('studypdf-library',1);r.onupgradeneeded=()=>{const d=r.result;const docs=d.createObjectStore('documents',{keyPath:['owner','id']});docs.createIndex('owner','owner');const chats=d.createObjectStore('chats',{keyPath:['owner','id']});chats.createIndex('document',['owner','documentId']);};r.onerror=()=>reject(new Error('Không mở được thư viện trên trình duyệt.'));r.onblocked=()=>{ /* Wait for older connections to close; no false save success. */ };r.onsuccess=()=>{const d=r.result;d.onversionchange=()=>{d.close();connection=undefined;};resolve(d);};}).catch(e=>{connection=undefined;throw e;});return connection;
}
function validate(owner:OwnerScope,id:string){assertOwnerScope(owner);if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Mã PDF không hợp lệ.');}
function result<T>(tx:IDBTransaction,work:(done:(v:T)=>void)=>void){return new Promise<T>((resolve,reject)=>{let value:T;tx.oncomplete=()=>{if(tx.mode==='readwrite')announce();resolve(value);};tx.onabort=tx.onerror=()=>reject(tx.error?.name==='QuotaExceededError'?new Error('Bộ nhớ trình duyệt đã đầy. PDF/chat chưa được lưu; hãy giữ trang và sao chép nội dung cần thiết.'):tx.error??new Error('Không lưu được thư viện.'));work(v=>{value=v;});});}
export async function pdfId(data:ArrayBuffer){const hash=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function ensureGeneralChat(owner:OwnerScope){
 writableOwner(owner);if(generalOwners.has(owner))return;const db=await open(),tx=db.transaction('documents','readwrite');
 await result<void>(tx,done=>{const store=tx.objectStore('documents'),r=store.get([owner,GENERAL_CHAT_ID]);r.onsuccess=()=>{if(!r.result){const now=Date.now();store.put({owner,id:GENERAL_CHAT_ID,kind:'general',name:'Chat không gắn PDF',size:0,blob:new ArrayBuffer(0),openedAt:now,updatedAt:now,nextChatNumber:1});}done();};});generalOwners.add(owner);
}
export async function saveDocument(owner:OwnerScope,id:string,file:File,bytes?:ArrayBuffer){
 writableOwner(owner);validate(owner,id);if(id===GENERAL_CHAT_ID)throw new Error('Mã PDF không hợp lệ.');const data=bytes??await file.arrayBuffer();if(data.byteLength!==file.size)throw new Error('Dữ liệu PDF chưa đầy đủ. Hãy mở lại file.');const db=await open();const tx=db.transaction('documents','readwrite');let tooLarge=false;
 try{return await result<LibraryDocument>(tx,done=>{const store=tx.objectStore('documents'),r=store.index('owner').getAll(owner);r.onsuccess=()=>{const rows=r.result as StoredDocument[];if(rows.reduce((sum,d)=>sum+(d.id===id?0:d.size),file.size)>512*1024*1024){tooLarge=true;tx.abort();return;}const old=rows.find(d=>d.id===id);const entry:StoredDocument={owner,id,name:file.name.slice(0,150),size:file.size,openedAt:Date.now(),updatedAt:old?.deletedAt||old?.name!==file.name.slice(0,150)?Date.now():old?.updatedAt??Date.now(),nextChatNumber:old?.nextChatNumber??1,blob:data};store.put(entry);const {blob,...metadata}=entry;void blob;done(metadata);};});}catch(error){if(tooLarge)throw new Error('Thư viện đã vượt 512MB trên trình duyệt này. PDF vẫn mở nhưng chưa được lưu.',{cause:error});throw error;}
}
export async function listDocuments(owner:OwnerScope){assertOwnerScope(owner);const db=await open();const tx=db.transaction('documents','readonly');return result<LibraryDocument[]>(tx,done=>{const r=tx.objectStore('documents').index('owner').getAll(owner);r.onsuccess=()=>done((r.result as StoredDocument[]).filter(doc=>!doc.deletedAt&&doc.kind!=='general').map(({blob,...metadata})=>{void blob;return metadata;}).sort((a,b)=>b.openedAt-a.openedAt));});}
export async function loadDocument(owner:OwnerScope,id:string){validate(owner,id);const db=await open();const tx=db.transaction('documents','readonly');return result<File>(tx,done=>{const r=tx.objectStore('documents').get([owner,id]);r.onsuccess=()=>{const d=r.result as StoredDocument|undefined;if(!d||d.deletedAt||d.kind==='general'){tx.abort();return;}done(new File([d.blob],d.name,{type:'application/pdf'}));};});}
export async function listChats(owner:OwnerScope,documentId:string){validate(owner,documentId);const db=await open();const tx=db.transaction('chats','readonly');return result<ChatSummary[]>(tx,done=>{const r=tx.objectStore('chats').index('document').getAll([owner,documentId]);r.onsuccess=()=>done((r.result as LibraryChat[]).filter(chat=>!chat.deletedAt).map(({turns,...summary})=>{void turns;return summary;}).sort((a,b)=>b.updatedAt-a.updatedAt));});}
export async function loadChat(owner:OwnerScope,documentId:string,id:string){validate(owner,documentId);const db=await open();const tx=db.transaction('chats','readonly');return result<LibraryChat>(tx,done=>{const r=tx.objectStore('chats').get([owner,id]);r.onsuccess=()=>{const chat=r.result as LibraryChat|undefined;if(!chat||chat.deletedAt||chat.documentId!==documentId){tx.abort();return;}done({...chat,turns:chat.turns.map(t=>({...t,status:t.status==='loading'||t.status==='streaming'?'stopped':t.status}))});};});}
export async function saveChat(owner:OwnerScope,documentId:string,id:string,turns:ChatTurn[],revision:number){
 writableOwner(owner);validate(owner,documentId);if(!turns.length)return revision;
 if(turns.length>500||JSON.stringify(turns).length>4_000_000)throw new Error('Đoạn chat đã quá dài. Hãy mở đoạn chat mới; phần chưa lưu vẫn ở màn hình.');
 if(documentId===GENERAL_CHAT_ID)await ensureGeneralChat(owner);
 const db=await open(),tx=db.transaction(['documents','chats'],'readwrite');let conflict=false;
 try{return await result<number>(tx,done=>{const chats=tx.objectStore('chats'),docs=tx.objectStore('documents'),r=chats.get([owner,id]);r.onsuccess=()=>{const old=r.result as LibraryChat|undefined;if(old?.deletedAt||(old?.revision??0)!==revision||(old&&old.documentId!==documentId)){conflict=true;tx.abort();return;}const q=docs.get([owner,documentId]);q.onsuccess=()=>{const doc=q.result as StoredDocument|undefined;if(!doc||doc.deletedAt){tx.abort();return;}const title=old?.title??`Đoạn chat ${doc.nextChatNumber}`;if(!old)docs.put({...doc,nextChatNumber:doc.nextChatNumber+1});chats.put({owner,id,documentId,title,turns,updatedAt:Date.now(),revision:revision+1} satisfies LibraryChat);done(revision+1);};};});}catch(e){if(conflict)throw new Error('Chat đã được sửa trong tab khác. Hãy sao chép nội dung chưa lưu trước khi mở lại.',{cause:e});throw e;}
}


export async function renameChat(owner:OwnerScope,documentId:string,id:string,title:string){
 validate(owner,documentId);
 const name=title.trim();if(!name||name.length>100)throw new Error('Tên chat cần từ 1 đến 100 ký tự.');
 const db=await open(),tx=db.transaction('chats','readwrite');
 return result<void>(tx,done=>{const store=tx.objectStore('chats'),r=store.get([owner,id]);r.onsuccess=()=>{
  const chat=r.result as LibraryChat|undefined;if(!chat||chat.deletedAt||chat.documentId!==documentId){tx.abort();return;}
  // Title is independent of the content revision; autosave reads the latest title.
  store.put({...chat,title:name,updatedAt:Date.now()});done();
 };});
}
export async function deleteChat(owner:OwnerScope,documentId:string,id:string){
 validate(owner,documentId);const db=await open(),tx=db.transaction('chats','readwrite');
 return result<void>(tx,done=>{const store=tx.objectStore('chats'),r=store.get([owner,id]);r.onsuccess=()=>{
  const chat=r.result as LibraryChat|undefined;if(!chat||chat.documentId!==documentId){tx.abort();return;}
  // Keep a tombstone so delayed autosaves from another tab cannot resurrect it.
  store.put({...chat,title:'',turns:[],updatedAt:Date.now(),deletedAt:Date.now(),revision:chat.revision+1});done();
 };});
}


export async function renameDocument(owner:OwnerScope,id:string,name:string){
 validate(owner,id);if(id===GENERAL_CHAT_ID)throw new Error('Đây là nhóm chat, không phải PDF.');const title=name.trim();if(!title||title.length>150)throw new Error('Tên PDF cần từ 1 đến 150 ký tự.');
 const db=await open(),tx=db.transaction('documents','readwrite');
 return result<void>(tx,done=>{const store=tx.objectStore('documents'),r=store.get([owner,id]);r.onsuccess=()=>{const doc=r.result as StoredDocument|undefined;if(!doc||doc.deletedAt){tx.abort();return;}store.put({...doc,name:title,updatedAt:Date.now()});done();};});
}
export async function deleteDocument(owner:OwnerScope,id:string){
 validate(owner,id);if(id===GENERAL_CHAT_ID)throw new Error('Hãy xóa từng chat trong nhóm chat không gắn PDF.');const db=await open(),tx=db.transaction(['documents','chats'],'readwrite');
 return result<void>(tx,done=>{const docs=tx.objectStore('documents'),chats=tx.objectStore('chats'),r=docs.get([owner,id]);r.onsuccess=()=>{const doc=r.result as StoredDocument|undefined;if(!doc){tx.abort();return;}docs.put({...doc,name:'',blob:new ArrayBuffer(0),size:0,deletedAt:Date.now(),updatedAt:Date.now()});const q=chats.index('document').getAll([owner,id]);q.onsuccess=()=>{for(const chat of q.result as LibraryChat[])chats.put({...chat,title:'',turns:[],deletedAt:Date.now(),updatedAt:Date.now(),revision:chat.revision+1});done();};};});
}
export async function readSnapshot(owner:OwnerScope){
 assertOwnerScope(owner);const db=await open(),tx=db.transaction(['documents','chats'],'readonly');
 return result<{documents:StoredDocument[];chats:LibraryChat[]}>(tx,done=>{let documents:StoredDocument[]=[],chats:LibraryChat[]=[];const d=tx.objectStore('documents').index('owner').getAll(owner),c=tx.objectStore('chats').getAll();d.onsuccess=()=>{documents=d.result;done({documents,chats});};c.onsuccess=()=>{chats=(c.result as LibraryChat[]).filter(chat=>chat.owner===owner);done({documents,chats});};});
}
// Restore only after the entire archive has been validated. Existing differing chats
// are retained under a deterministic copy id, so repeated imports do not multiply them.
export async function mergeSnapshot(owner:OwnerScope,snapshot:Awaited<ReturnType<typeof readSnapshot>>,restoreDeleted=false,canCommit:()=>boolean=()=>true){
 writableOwner(owner);const db=await open();const existing=await readSnapshot(owner);
 const docs=new Map(existing.documents.map(d=>[d.id,d]));
 for(const doc of snapshot.documents){
  validate(owner,doc.id);const old=docs.get(doc.id),openedAt=Math.max(doc.openedAt,old?.openedAt??0),nextChatNumber=Math.max(doc.nextChatNumber,old?.nextChatNumber??1);
  if(restoreDeleted&&old?.deletedAt&&!doc.deletedAt){docs.set(doc.id,{...doc,owner,openedAt,nextChatNumber,updatedAt:Math.max(Date.now(),old.deletedAt+1)});continue;}
  if(!old||(doc.updatedAt??doc.openedAt)>(old.updatedAt??old.openedAt))docs.set(doc.id,{...doc,owner,openedAt,nextChatNumber});
  else docs.set(doc.id,{...old,openedAt,nextChatNumber});
 }
 if([...docs.values()].reduce((sum,d)=>sum+d.size,0)>512*1024*1024)throw new Error('Thư viện sau khi nhập vượt 512MB.');
 const chats=new Map(existing.chats.map(c=>[c.id,c]));
 const content=(c:LibraryChat)=>JSON.stringify({title:c.title,turns:c.turns,deletedAt:c.deletedAt??0});
 for(const incoming of snapshot.chats){const chat={...incoming,owner},old=chats.get(chat.id);if(!docs.has(chat.documentId))throw new Error('Chat không có PDF tương ứng.');
  if(!old){chats.set(chat.id,chat);continue;}if(old.documentId!==chat.documentId)throw new Error('Mã chat trùng ở hai PDF.');
  if(restoreDeleted&&old.deletedAt&&!chat.deletedAt){chats.set(chat.id,{...chat,revision:Math.max(old.revision,chat.revision)+1,updatedAt:Math.max(Date.now(),old.deletedAt+1)});continue;}if(content(old)===content(chat)){chats.set(chat.id,{...old,revision:Math.max(old.revision,chat.revision),updatedAt:Math.max(old.updatedAt,chat.updatedAt)});continue;}
  const deleted=old.deletedAt?old:chat.deletedAt?chat:undefined;
  const winner=deleted??(old.updatedAt>chat.updatedAt?old:chat),other=winner===old?chat:old;
  // A conflict keeps the newer version and a copy of the other nonempty version.
  if(other.turns.length&&!other.deletedAt&&(!winner.deletedAt||other.updatedAt>winner.deletedAt)){const hash=await pdfId(new TextEncoder().encode(content(other)).buffer);const id=`copy-${other.id.slice(0,40)}-${hash.slice(0,20)}`;if(!chats.has(id))chats.set(id,{...other,id,title:`${other.title.slice(0,75)} (bản khôi phục)`,revision:0});}
  chats.set(chat.id,{...winner,revision:Math.max(old.revision,chat.revision)+1});
 }
 for(const [id,c] of chats){const deletedAt=docs.get(c.documentId)?.deletedAt;if(deletedAt&&(c.deletedAt!==deletedAt||c.title||c.turns.length))chats.set(id,{...c,title:'',turns:[],deletedAt,revision:c.revision+1});}
 if(!canCommit())throw new DOMException('Đang có thay đổi chưa lưu; sẽ đồng bộ lại.','InvalidStateError');
 if(JSON.stringify({documents:[...docs.values()],chats:[...chats.values()]})===JSON.stringify(existing))return;
 // ArrayBuffer storage also works on WebKit builds where IDB Blob writes fail.
 for(const doc of docs.values())if(doc.blob instanceof Blob)doc.blob=await doc.blob.arrayBuffer();
 const tx=db.transaction(['documents','chats'],'readwrite');await result<void>(tx,done=>{
  const d=tx.objectStore('documents').index('owner').getAll(owner),c=tx.objectStore('chats').getAll();let ready=0;
  const commit=()=>{if(++ready!==2)return;if(!canCommit()){tx.abort();return;}const actual={documents:d.result,chats:(c.result as LibraryChat[]).filter(chat=>chat.owner===owner)};
   if(JSON.stringify(actual)!==JSON.stringify(existing)){tx.abort();return;}
   for(const doc of docs.values())tx.objectStore('documents').put(doc);for(const chat of chats.values())tx.objectStore('chats').put(chat);done();
  };d.onsuccess=commit;c.onsuccess=commit;
 });
}

/** Remove this account only; other accounts and guest data remain intact. */
export async function clearAccountLibrary(owner:OwnerScope){
 assertOwnerScope(owner);if(owner==='guest')throw new Error('Cần tài khoản để xóa dữ liệu.');erasedOwners.add(owner);broadcast?.postMessage({type:'owner-erased',owner});
 const db=await open(),tx=db.transaction(['documents','chats'],'readwrite');
 return result<void>(tx,done=>{
  for(const name of ['documents','chats']){const store=tx.objectStore(name),request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){if(cursor.value.owner===owner)cursor.delete();cursor.continue();}};}
  done();
 });
}
