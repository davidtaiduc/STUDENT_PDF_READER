import { useEffect,useRef,useState,type FormEvent } from 'react';
import { accountRequest } from '../../services/account';
import { useAuth } from './context';
export default function EmailRecovery(){
 const {user,refresh,setAccount}=useAuth();
 const [link]=useState(()=>{const m=/^#(reset-password|verify-email)=([a-f0-9]{64})$/.exec(window.location.hash);return m?{mode:m[1],token:m[2]}:null;});
 const [mode,setMode]=useState(link?.mode??''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),lock=useRef(false);
 useEffect(()=>{if(link)window.history.replaceState(null,'',window.location.pathname+window.location.search);},[link]);
 useEffect(()=>{if(mode)dialog.current?.showModal();else dialog.current?.close();},[mode]);
 const request=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(lock.current)return;const form=event.currentTarget,data=new FormData(form);
  if(mode==='reset-password'&&data.get('password')!==data.get('confirm')){setError('Mật khẩu xác nhận chưa khớp.');return;}
  lock.current=true;setBusy(true);setError('');setMessage('');
  try{
   const path=mode==='forgot'?'forgot-password':mode==='resend'?'resend-verification':mode;
   const result=await accountRequest<{message:string}>(`auth/${path}`,'POST',{email:data.get('email'),password:data.get('password'),token:link?.token});
   setMessage(result.message);form.reset();
   if(mode==='reset-password')setAccount(null);
   if(mode==='verify-email')await refresh();
   if(mode==='verify-email'||mode==='reset-password')setMode('done');
  }catch(e){setError(e instanceof Error?e.message:'Không thực hiện được yêu cầu.');}finally{lock.current=false;setBusy(false);}
 };
 const open=(value:string)=>{setMessage('');setError('');setMode(value);};
 return <>
  {!user?<button className="email-recovery-button" onClick={()=>open('forgot')}>Quên mật khẩu?</button>:<span className="email-verification-status">{user.emailVerified?'Email đã xác minh':<button onClick={()=>open('resend')}>Xác minh email</button>}</span>}
  <dialog className="auth-dialog" ref={dialog} aria-labelledby="email-title" onCancel={e=>{if(busy)e.preventDefault();else setMode('');}}>
   <form onSubmit={request}><div className="auth-heading"><h2 id="email-title">{mode==='forgot'?'Quên mật khẩu':mode==='resend'?'Gửi email xác minh':mode==='reset-password'?'Đặt lại mật khẩu':mode==='done'?'Hoàn tất':'Xác minh email'}</h2><button type="button" aria-label="Đóng email" disabled={busy} onClick={()=>setMode('')}>×</button></div>
    {mode==='forgot'&&<><p>Nhập email tài khoản để nhận liên kết đặt lại mật khẩu, có hiệu lực 30 phút.</p><label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" disabled={busy}/></label></>}
    {mode==='resend'&&<p>Gửi liên kết xác minh đến email tài khoản của bạn. Liên kết có hiệu lực 24 giờ. Đăng nhập vẫn hoạt động trong khi chờ xác minh.</p>}
    {mode==='reset-password'&&<><label>Mật khẩu mới<input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required disabled={busy}/></label><label>Xác nhận mật khẩu mới<input name="confirm" type="password" minLength={8} maxLength={128} autoComplete="new-password" required disabled={busy}/></label><p>Đặt lại mật khẩu sẽ đăng xuất tất cả thiết bị.</p></>}
    {mode==='verify-email'&&<p>Bấm xác nhận để xác minh email. Liên kết chỉ được sử dụng một lần.</p>}
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {mode!=='done'&&<button className="auth-submit" disabled={busy}>{busy?'Đang xử lý…':mode==='reset-password'?'Đặt lại mật khẩu':mode==='verify-email'?'Xác nhận email':'Gửi liên kết'}</button>}
   </form>
  </dialog>
 </>;
}
