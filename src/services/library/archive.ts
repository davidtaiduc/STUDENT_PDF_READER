import type {OwnerScope} from '../ownerScope.ts';
import {GENERAL_CHAT_ID,readSnapshot,mergeSnapshot,pdfId,type LibraryChat} from './store.ts';
import {validateContextScope} from '../../../shared/ai/contextScope.ts';
const MAGIC='STUDYPDF1\n';
export const MAX_ARCHIVE_BYTES=544*1024*1024;
const fail=()=>{throw new Error('Bản sao lưu không hợp lệ hoặc vượt giới hạn.');};
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
export async function exportLibrary(owner:OwnerScope){
 const snapshot=await readSnapshot(owner);if(snapshot.documents.filter(d=>d.kind!=='general').length>200||snapshot.chats.length>2000)throw new Error('Bản sao lưu hỗ trợ tối đa 200 PDF và 2.000 chat.');const manifest={version:1,documents:snapshot.documents.map(({blob,owner,...d})=>{void blob;void owner;return d;}),chats:snapshot.chats.map(({owner,...c})=>{void owner;return c;})};
 const json=new TextEncoder().encode(JSON.stringify(manifest));if(json.length>32*1024*1024)fail();
 const size=new Uint8Array(4);new DataView(size.buffer).setUint32(0,json.length);
 return new Blob([MAGIC,size,json,...snapshot.documents.map(d=>d.blob)],{type:'application/octet-stream'});
}
export async function parseArchive(owner:OwnerScope,file:Blob){
 if(file.size>MAX_ARCHIVE_BYTES||file.size<14)fail();
 if(await file.slice(0,10).text()!==MAGIC)fail();
 const length=new DataView(await file.slice(10,14).arrayBuffer()).getUint32(0);if(length>32*1024*1024||14+length>file.size)fail();
 const raw=JSON.parse(await file.slice(14,14+length).text());
 if(raw.version!==1||!Array.isArray(raw.documents)||raw.documents.length>201||!Array.isArray(raw.chats)||raw.chats.length>2000)fail();
 if(raw.documents.filter((d:{kind?:string})=>d?.kind!=='general').length>200)fail();
 const documents:Awaited<ReturnType<typeof readSnapshot>>['documents']=[];const ids=new Set<string>();let offset=14+length,total=0;
 for(const d of raw.documents){
  if(!d||!text(d.id,64)||!/^[a-f0-9]{64}$/.test(d.id)||ids.has(d.id)||!text(d.name,150)||!Number.isSafeInteger(d.size)||d.size<0||d.size>150*1024*1024||!Number.isSafeInteger(d.nextChatNumber)||d.nextChatNumber<1||!Number.isFinite(d.openedAt)||!Number.isFinite(d.updatedAt??d.openedAt)||d.deletedAt!==undefined&&!Number.isFinite(d.deletedAt))fail();
  if(d.kind!==undefined&&d.kind!=='general')fail();if(d.id===GENERAL_CHAT_ID||d.kind==='general'){if(d.id!==GENERAL_CHAT_ID||d.kind!=='general'||d.size!==0||d.deletedAt)fail();}
  ids.add(d.id);const blob=file.slice(offset,offset+d.size,'application/pdf');offset+=d.size;total+=d.size;if(offset>file.size||total>512*1024*1024)fail();
  if(d.kind!=='general'&&!d.deletedAt){if(!(await blob.slice(0,1024).text()).includes('%PDF-'))fail();if(await pdfId(await blob.arrayBuffer())!==d.id)fail();}else if(d.size!==0)fail();
  documents.push({owner,...(d.kind==='general'?{kind:'general' as const}:{}),id:d.id,name:d.name,size:d.size,openedAt:d.openedAt,nextChatNumber:d.nextChatNumber,updatedAt:d.updatedAt,deletedAt:d.deletedAt,blob});
 }
 if(offset!==file.size)fail();const chatIds=new Set<string>();const chats:LibraryChat[]=[];
 for(const c of raw.chats){
  if(!c||!text(c.id,120)||!c.id||chatIds.has(c.id)||!ids.has(c.documentId)||!text(c.title,100)||!Number.isFinite(c.updatedAt)||!Number.isSafeInteger(c.revision)||c.revision<0||!Array.isArray(c.turns)||c.turns.length>500||JSON.stringify(c.turns).length>4_000_000||c.deletedAt!==undefined&&!Number.isFinite(c.deletedAt))fail();
  chatIds.add(c.id);
  for(const t of c.turns){const s=t?.selection;if(!t||!text(t.id,120)||!text(t.question,2000)||!text(t.answer,50000)||!text(t.model,100)||!Number.isFinite(t.createdAt)||!['loading','streaming','ready','stopped','error'].includes(t.status)||t.action!==undefined&&!['ask','translate','explain'].includes(t.action)||!s||!text(s.cleanedText,12000)||!Number.isSafeInteger(s.pageNumber)||s.pageNumber<1||!text(s.context?.before,650)||!text(s.context?.after,650))fail();if(s.ocr!==undefined&&typeof s.ocr!=='boolean')fail();validateContextScope(s.scope);if(t.error&&(!text(t.error.message,2000)||!text(t.error.code,50)||typeof t.error.retryable!=='boolean'||!Number.isFinite(t.error.retryAt)))fail();}
  chats.push({owner,id:c.id,documentId:c.documentId,title:c.title,updatedAt:c.updatedAt,revision:c.revision,deletedAt:c.deletedAt,turns:c.turns.map((t:LibraryChat['turns'][number])=>({...t,status:t.status==='loading'||t.status==='streaming'?'stopped':t.status}))});
 }
 return {documents,chats};
}
export async function importLibrary(owner:OwnerScope,file:Blob,restoreDeleted=true,canCommit:()=>boolean=()=>true){await mergeSnapshot(owner,await parseArchive(owner,file),restoreDeleted,canCommit);}
export function downloadLibrary(blob:Blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`StudyPDF-${new Date().toISOString().slice(0,10)}.studypdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
