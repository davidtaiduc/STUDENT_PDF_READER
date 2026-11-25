import type {OwnerScope} from '../ownerScope.ts';
import {exportLibrary,importLibrary,MAX_ARCHIVE_BYTES} from './archive.ts';
export class LibrarySyncError extends Error {status:number;constructor(message:string,status=0){super(message);this.status=status;}}
const heads=new Map<OwnerScope,{etag:string;signature:string}>();
async function signature(archive:Blob){
 const length=new DataView(await archive.slice(10,14).arrayBuffer()).getUint32(0),manifest=JSON.parse(await archive.slice(14,14+length).text());
 manifest.documents.sort((a:{id:string},b:{id:string})=>a.id.localeCompare(b.id));manifest.chats.sort((a:{id:string},b:{id:string})=>a.id.localeCompare(b.id));
 const canonical=JSON.stringify(manifest,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function syncLibrary(owner:OwnerScope,onProgress:(message:string)=>void,options:{signal?:AbortSignal;canCommit?:()=>boolean}={}){
 if(owner==='guest')throw new Error('Đăng nhập để đồng bộ thư viện.');
 const signal=AbortSignal.any([AbortSignal.timeout(150000),...(options.signal?[options.signal]:[])]);
 const canCommit=()=>!signal.aborted&&(options.canCommit?.()??true);
 const check=()=>{signal.throwIfAborted();if(!canCommit())throw new DOMException('Đang xử lý hội thoại, sẽ đồng bộ sau.','InvalidStateError');};check();
 const url=`${(import.meta.env.VITE_AI_API_URL||'').replace(/\/$/,'')}/api/library/archive`,headers={'X-Library-Owner':owner.slice(5)};
 const fail=async(response:Response)=>{if(response.status===401&&typeof window!=='undefined')window.dispatchEvent(new Event('auth-invalid'));const payload=await response.json().catch(()=>null);throw new LibrarySyncError(typeof payload?.error==='string'?payload.error:'Chưa kết nối được kho dữ liệu MongoDB. Bản trên máy vẫn được giữ.',response.status);};
 onProgress('Đang kiểm tra dữ liệu MongoDB…');
 const head=await fetch(url,{method:'HEAD',credentials:'include',signal,headers});if(!head.ok&&head.status!==404)await fail(head);
 let etag=head.status===404?'"0"':head.headers.get('etag')??'';if(!/^"\d+"$/.test(etag))throw new Error('Máy chủ không trả phiên bản thư viện hợp lệ.');
 const known=heads.get(owner);
 if(head.ok&&known?.etag!==etag){
  onProgress('Đang nhận PDF và chat từ tài khoản…');const remote=await fetch(url,{credentials:'include',signal,headers});if(!remote.ok)await fail(remote);
  etag=remote.headers.get('etag')??'';if(!/^"\d+"$/.test(etag))throw new Error('Phiên bản thư viện không hợp lệ.');
  if(Number(remote.headers.get('content-length'))>MAX_ARCHIVE_BYTES)throw new Error('Thư viện trên máy chủ quá lớn.');const blob=await remote.blob();check();
  await importLibrary(owner,blob,false,canCommit);check();heads.set(owner,{etag,signature:await signature(blob)});
 }
 check();const archive=await exportLibrary(owner),hash=await signature(archive);check();
 if(heads.get(owner)?.etag===etag&&heads.get(owner)?.signature===hash)return new Date();
 // Empty accounts do not need an empty GridFS upload.
 if(head.status===404){const size=new DataView(await archive.slice(10,14).arrayBuffer()).getUint32(0),manifest=JSON.parse(await archive.slice(14,14+size).text());if(!manifest.documents.length&&!manifest.chats.length){heads.set(owner,{etag,signature:hash});return new Date();}}
 onProgress('Đang lưu PDF và hội thoại lên MongoDB…');
 const saved=await fetch(url,{method:'PUT',credentials:'include',signal,headers:{...headers,'Content-Type':'application/octet-stream','If-Match':etag},body:archive});
 if(!saved.ok){heads.delete(owner);await fail(saved);}const next=saved.headers.get('etag');if(!next||!/^"\d+"$/.test(next))throw new Error('Máy chủ chưa xác nhận phiên bản đã lưu.');
 heads.set(owner,{etag:next,signature:hash});return new Date();
}
