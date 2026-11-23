import { useEffect, useRef, useState } from 'react';
import { accountRequest, AccountRequestError } from '../../services/account';
import type { OwnerScope } from '../../services/ownerScope';
import type { UserUsage } from '../../../shared/types/usage';
export default function UsageStatus({ownerScope}:{ownerScope:OwnerScope}) {
  const [snapshot,setSnapshot]=useState<{scope:OwnerScope;data?:UserUsage;error?:string}|null>(null);
  const [revision,setRevision]=useState(0), sequence=useRef(0);
  useEffect(()=>{
    if(ownerScope==='guest')return;
    let active=true;
    const load=()=>{const id=++sequence.current;void accountRequest<UserUsage>('usage/me').then(data=>{
      if(typeof data.dailyUsed!=='number'||typeof data.dailyLimit!=='number'||typeof data.dailyRemaining!=='number'||typeof data.resetAt!=='string')throw new Error('Phản hồi hạn mức không hợp lệ.');
      if(active&&id===sequence.current)setSnapshot({scope:ownerScope,data});
    }).catch(error=>{
      if(error instanceof AccountRequestError&&error.status===401)window.dispatchEvent(new Event('auth-invalid'));
      if(active&&id===sequence.current)setSnapshot({scope:ownerScope,error:'Chưa đọc được hạn mức AI. Hãy kiểm tra kết nối và thử lại.'});
    });};
    load();window.addEventListener('usage-changed',load);
    return()=>{active=false;window.removeEventListener('usage-changed',load);};
  },[ownerScope,revision]);
  if(ownerScope==='guest')return <p className="usage-status">Đăng nhập để sử dụng Gemini. Ghi chú khách vẫn được giữ riêng.</p>;
  const current=snapshot?.scope===ownerScope?snapshot:null;
  return <div className="usage-status" role="status">{current?.data?<><span>Đã dùng {current.data.dailyUsed}/{current.data.dailyLimit} lượt hôm nay · Còn {current.data.dailyRemaining}</span>{!current.data.dailyRemaining&&<strong>Đã hết lượt hôm nay.</strong>}<small title={`Đặt lại: ${new Date(current.data.resetAt).toLocaleString('vi-VN')}`}>Đặt lại 00:00 UTC</small></>:<span>{current?.error??'Đang tải hạn mức AI…'}</span>}<button aria-label="Làm mới hạn mức" title="Làm mới hạn mức" onClick={()=>setRevision(value=>value+1)}>↻</button></div>;
}
