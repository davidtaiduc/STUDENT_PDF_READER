import type {OwnerScope} from '../ownerScope.ts';
import {exportLibrary,importLibrary,MAX_ARCHIVE_BYTES} from './archive.ts';
export async function syncLibrary(owner:OwnerScope,onProgress:(message:string)=>void){
 if(owner==='guest')throw new Error('Đăng nhập để đồng bộ thư viện.');
 const url=`${(import.meta.env.VITE_AI_API_URL||'').replace(/\/$/,'')}/api/library/archive`;
 const signal=AbortSignal.timeout(150000);
 onProgress('Đang tải thư viện từ tài khoản…');
 const expectedOwner=owner.slice(5);const remote=await fetch(url,{credentials:'include',signal,headers:{'X-Library-Owner':expectedOwner}});let etag='"0"';
 if(remote.ok){etag=remote.headers.get('etag')??'';if(!/^"\d+"$/.test(etag))throw new Error('Máy chủ không trả phiên bản thư viện hợp lệ.');if(Number(remote.headers.get('content-length'))>MAX_ARCHIVE_BYTES)throw new Error('Thư viện trên máy chủ quá lớn.');const blob=await remote.blob();onProgress('Đang kiểm tra và hợp nhất dữ liệu…');await importLibrary(owner,blob,false);}
 else if(remote.status!==404){throw new Error(remote.status===401?'Phiên đăng nhập đã hết hạn. Đăng nhập lại trước khi đồng bộ.':'Không tải được thư viện tài khoản. Dữ liệu trên máy vẫn được giữ.');}
 onProgress('Đang lưu PDF và chat lên tài khoản…');const archive=await exportLibrary(owner);
 const saved=await fetch(url,{method:'PUT',credentials:'include',signal,headers:{'Content-Type':'application/octet-stream','If-Match':etag,'X-Library-Owner':expectedOwner},body:archive});
 if(!saved.ok){const payload=await saved.json().catch(()=>null);throw new Error(typeof payload?.error==='string'?payload.error:'Không lưu được thư viện lên tài khoản. Hãy thử lại.');}
 return new Date();
}
