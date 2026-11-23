import {useRef,useState} from 'react';
import type {OwnerScope} from '../../services/ownerScope';
import {downloadLibrary,exportLibrary,importLibrary} from '../../services/library/archive';
import {syncLibrary} from '../../services/library/cloud';
export default function LibraryTools({owner,run}:{owner:OwnerScope|null;run:(work:()=>Promise<void>,refresh?:boolean)=>Promise<void>}){
 const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const execute=async(work:()=>Promise<void>,refresh=true)=>{if(busy)return;setBusy(true);setMessage('Đang xử lý thư viện…');setError('');try{await run(work,refresh);}catch(e){setMessage('');setError(e instanceof Error?e.message:'Không thực hiện được thao tác thư viện.');}finally{setBusy(false);}};
 return <details className="library-tools"><summary>Sao lưu và đồng bộ</summary><p>Đồng bộ sẽ tải và hợp nhất thư viện rồi lưu lên tài khoản. Thiết bị khác dùng cùng tài khoản và bấm Đồng bộ để nhận dữ liệu. Bản chat khác nội dung được giữ thêm thành bản khôi phục.</p>
 <button disabled={!owner||owner==='guest'||busy} onClick={()=>owner&&void execute(async()=>{const time=await syncLibrary(owner,setMessage);setMessage(`Đã đồng bộ lúc ${time.toLocaleTimeString('vi-VN')}.`);})}>Đồng bộ tài khoản</button>
 <button disabled={!owner||busy} onClick={()=>owner&&void execute(async()=>{downloadLibrary(await exportLibrary(owner));setMessage('Đã xuất bản sao lưu gồm PDF và chat.');},false)}>Xuất bản sao lưu</button>
 <button disabled={!owner||busy} onClick={()=>input.current?.click()}>Nhập bản sao lưu</button>
 <input hidden type="file" accept=".studypdf" ref={input} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file&&owner)void execute(async()=>{await importLibrary(owner,file);setMessage('Đã nhập thư viện. Chat khác nội dung được giữ thành bản khôi phục.');});}}/>
 <small>Bản sao lưu chứa tài liệu và hội thoại, không được mã hóa. Giữ file ở nơi riêng tư.</small>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </details>;
}
