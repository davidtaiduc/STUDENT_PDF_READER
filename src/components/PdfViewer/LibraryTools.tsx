import {useRef,useState} from 'react';
import type {OwnerScope} from '../../services/ownerScope';
import {downloadLibrary,exportLibrary,importLibrary} from '../../services/library/archive';
import type {AutoSyncState} from '../../services/library/autoSyncController';
export default function LibraryTools({owner,run,cloud,onSync}:{cloud:AutoSyncState;onSync:()=>void;owner:OwnerScope|null;run:(work:()=>Promise<void>,refresh?:boolean)=>Promise<void>}){
 const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const execute=async(work:()=>Promise<void>,refresh=true)=>{if(busy)return;setBusy(true);setMessage('Đang xử lý thư viện…');setError('');try{await run(work,refresh);}catch(e){setMessage('');setError(e instanceof Error?e.message:'Không thực hiện được thao tác thư viện.');}finally{setBusy(false);}};
 return <details className="library-tools"><summary>Sao lưu và đồng bộ</summary><p>PDF và chat tự lưu vào tài khoản để bạn đọc tiếp trên thiết bị khác. Bạn cũng có thể tải bản sao lưu về máy.</p>
 <button disabled={!owner||owner==='guest'||busy||cloud.phase==='syncing'} onClick={onSync}>Đồng bộ tài khoản</button>{cloud.phase==='error'&&<p role="status">Chưa lưu được thay đổi. Bản trên máy vẫn được giữ; bấm Đồng bộ tài khoản để thử lại.</p>}
 {cloud.phase==='saved'&&<p role="status">Đã lưu thay đổi vào tài khoản.</p>}
 <button disabled={!owner||busy} onClick={()=>owner&&void execute(async()=>{downloadLibrary(await exportLibrary(owner));setMessage('Đã xuất bản sao lưu gồm PDF và chat.');},false)}>Xuất bản sao lưu</button>
 <button disabled={!owner||busy} onClick={()=>input.current?.click()}>Nhập bản sao lưu</button>
 <input hidden type="file" accept=".studypdf" ref={input} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file&&owner)void execute(async()=>{await importLibrary(owner,file);setMessage('Đã nhập thư viện. Chat khác nội dung được giữ thành bản khôi phục.');});}}/>
 <small>Bản sao lưu chứa tài liệu và hội thoại, không được mã hóa. Giữ file ở nơi riêng tư.</small>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </details>;
}
