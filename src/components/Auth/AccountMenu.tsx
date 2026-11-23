import EmailRecovery from './EmailRecovery';
import AccountSettings from './AccountSettings';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from './context';
export default function AccountMenu() {
  const { user, status, error: connectionError, refresh, submit } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false), dialog = useRef<HTMLDialogElement>(null), first = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [settings, setSettings] = useState(false), [notice, setNotice] = useState('');
  const closeSettings = useCallback(() => setSettings(false), []);
  useEffect(() => {
    const listener = (event: Event) => setNotice(String((event as CustomEvent).detail));
    window.addEventListener('account-notice', listener);
    return () => window.removeEventListener('account-notice', listener);
  }, []);
  useEffect(() => { if (open) { dialog.current?.showModal(); first.current?.focus(); } else dialog.current?.close(); }, [open]);
  const close = () => { if (!lock.current) { setOpen(false); setError(''); } };
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (lock.current) return;
    const form = event.currentTarget, values = new FormData(form);
    const password = String(values.get('password'));
    if (mode === 'register' && password !== values.get('confirm')) { setError('Mật khẩu xác nhận chưa khớp.'); return; }
    lock.current = true; setBusy(true); setError('');
    try { await submit(mode, { email: values.get('email'), password, displayName: values.get('displayName') }); form.reset(); setOpen(false); setSettings(false); setNotice(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Không thực hiện được yêu cầu.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const logout = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await submit('logout'); } catch (error) { setError(error instanceof Error ? error.message : 'Chưa đăng xuất được.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="account-controls">
    <EmailRecovery />
    {status === 'checking' ? <span role="status">Đang kiểm tra tài khoản…</span> : status === 'unavailable' ? <span role="status">{connectionError} <button onClick={() => void refresh()}>Thử lại</button></span> : null}
    {user && status === 'ready' ? <details><summary>{user.displayName}</summary><div className="account-popover"><strong>{user.displayName}</strong><span>{user.email}</span><button disabled={busy} onClick={() => setSettings(true)}>Quản lý tài khoản</button><p>PDF đọc trên máy. PDF và chat lưu trên trình duyệt này.</p><button disabled={busy} onClick={() => void logout()}>{busy ? 'Đang xử lý…' : 'Đăng xuất'}</button></div></details> : status === 'ready' ? <><button onClick={() => { setMode('login'); setOpen(true); }}>Đăng nhập</button><button onClick={() => { setMode('register'); setOpen(true); }}>Đăng ký</button></> : null}
    {notice && <span role="status">{notice}</span>}
    {settings && user && status === 'ready' && <AccountSettings onClose={closeSettings} />}
    {!open && error && <span role="alert">{error}</span>}
    <dialog ref={dialog} className="auth-dialog" aria-labelledby="auth-title" onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      {open && <form onSubmit={send}>
        <div className="auth-heading"><h2 id="auth-title">{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h2><button type="button" aria-label="Đóng" disabled={busy} onClick={close}>×</button></div>
        <p>Tài khoản StudyPDF AI. PDF và chat lưu trên trình duyệt này, chưa đồng bộ thiết bị. Sau đăng ký, bấm Xác minh email để nhận liên kết.</p>
        {mode === 'register' && <label>Tên hiển thị<input name="displayName" autoComplete="name" maxLength={80} required disabled={busy} /></label>}
        <label>Email<input ref={first} name="email" type="email" autoComplete="username" maxLength={254} required disabled={busy} /></label>
        <label>Mật khẩu<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={128} required disabled={busy} /></label>
        {mode === 'register' && <label>Xác nhận mật khẩu<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} /></label>}
        {error && <p role="alert" className="auth-error">{error}</p>}
        <button className="auth-submit" disabled={busy} type="submit">{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
        <button type="button" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</button>
      </form>}
    </dialog>
  </div>;
}
