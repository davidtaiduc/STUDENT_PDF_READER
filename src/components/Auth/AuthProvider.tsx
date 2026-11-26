import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AccountUser } from '../../../shared/types/account';
import { authRequest } from '../../services/auth';
import { AuthContext } from './context';
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [status, setStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [error, setError] = useState('');
  const version = useRef(0);
  const mutation = useRef(false);
  const pendingCheck = useRef<{id:number;promise:Promise<void>;block:boolean}|null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const refresh = useCallback((block = true):Promise<void> => {
    if(mutation.current)return Promise.resolve();
    const pending=pendingCheck.current;
    if(pending&&pending.id===version.current&&(!block||pending.block))return pending.promise;
    if(block)setStatus('checking');
    const id=++version.current;
    const promise=authRequest('me').then(result=>{
      if(id===version.current){setUser(result.user);setStatus('ready');setError('');}
    }).catch(()=>{
      if(id===version.current){setStatus(current=>!block&&current==='ready'?'ready':'unavailable');setError('Chưa kiểm tra được phiên đăng nhập.');}
    }).finally(()=>{if(pendingCheck.current?.id===id)pendingCheck.current=null;});
    pendingCheck.current={id,promise,block};return promise;
  }, []);
  useEffect(() => {
    let cancelled = false;
    const id = version.current;
    void authRequest('me').then(result => {
      if (!cancelled && id === version.current) { setUser(result.user); setStatus('ready'); setError(''); }
    }).catch(() => { if (!cancelled && id === version.current) { setStatus('unavailable'); setError('Chưa kiểm tra được phiên đăng nhập.'); } });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') void refresh(false); };
    const invalidate = () => { void refresh(true); };
    window.addEventListener('auth-invalid', invalidate); window.addEventListener('focus', check); document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(false); }, 60000);
    if (typeof BroadcastChannel !== 'undefined') { channel.current = new BroadcastChannel('studypdf-auth'); channel.current.onmessage = () => void refresh(); }
    return () => { window.removeEventListener('auth-invalid', invalidate); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); clearInterval(timer); channel.current?.close(); channel.current = null; };
  }, [refresh]);
  const setAccount = useCallback((account: AccountUser | null) => { ++version.current; setUser(current => account === null || current?.id === account.id ? account : current); setStatus('ready'); setError(''); if (!account) channel.current?.postMessage('session-changed'); }, []);
  const submit = async (action: 'login' | 'register' | 'logout', input?: object) => {
    if(mutation.current)throw new Error('Đang xử lý tài khoản. Vui lòng chờ.');
    mutation.current=true;const id=++version.current;
    try{const result=await authRequest(action,input);
      if(id===version.current){setUser(result.user);setStatus('ready');setError('');channel.current?.postMessage('session-changed');}
    }finally{mutation.current=false;}
  };
  return <AuthContext.Provider value={{ user, status, error, refresh, submit, setAccount }}>{children}</AuthContext.Provider>;
}
