import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AccountProfile, AccountSession } from '../../../shared/types/account';
import { accountRequest, AccountRequestError, loadProfile, loadSessions } from '../../services/account';
import { useAuth } from './context';
export default function AccountSettings({ onClose }: { onClose: () => void }) {
  const { setAccount } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null), [sessions, setSessions] = useState<AccountSession[]>([]);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'others' | 'all' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), lock = useRef(false), requestVersion = useRef(0);
  const handleError = (error: unknown) => {
    if (error instanceof AccountRequestError && error.status === 401) { setAccount(null); onClose(); }
    else setError(error instanceof Error ? error.message : 'Không thực hiện được yêu cầu.');
  };
  useEffect(() => {
    dialog.current?.showModal();
    let cancelled = false;
    const id = requestVersion.current;
    void Promise.all([loadProfile(), loadSessions()]).then(([data, result]) => {
      if (!cancelled && id === requestVersion.current) { setProfile(data); setSessions(result.sessions); }
    }).catch(error => {
      if (cancelled || id !== requestVersion.current) return;
      if (error instanceof AccountRequestError && error.status === 401) { setAccount(null); onClose(); }
      else setError(error instanceof Error ? error.message : 'Không tải được tài khoản.');
    });
    return () => { cancelled = true; };
  }, [setAccount, onClose]);
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage(''); ++requestVersion.current;
    try { await work(); } catch (error) { handleError(error); }
    finally { lock.current = false; setBusy(false); }
  };
  const reload = () => run(async () => { const [data, result] = await Promise.all([loadProfile(), loadSessions()]); setProfile(data); setSessions(result.sessions); });
  const saveName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const name = new FormData(event.currentTarget).get('displayName');
    void run(async () => { const data = await accountRequest<AccountProfile>('users/me', 'PATCH', { displayName: name }); setProfile(data); setAccount({ id: data.id, email: data.email, displayName: data.displayName }); setMessage('Đã cập nhật tên hiển thị.'); });
  };
  const changePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget, values = new FormData(form);
    if (values.get('newPassword') !== values.get('confirmPassword')) { setError('Mật khẩu xác nhận chưa khớp.'); return; }
    void run(async () => {
      await accountRequest('auth/change-password', 'POST', { currentPassword: values.get('currentPassword'), newPassword: values.get('newPassword') });
      form.reset(); setAccount(null); onClose();
      // Announce success outside the now-closed account dialog.
      window.dispatchEvent(new CustomEvent('account-notice', { detail: 'Đã đổi mật khẩu và thu hồi mọi phiên. Vui lòng đăng nhập lại.' }));
    });
  };
  const revoke = (id: string) => run(async () => { const result = await accountRequest<{authenticated: boolean}>(`auth/sessions/${id}`, 'DELETE'); if (!result.authenticated) { setAccount(null); onClose(); return; } setSessions(old => old.filter(item => item.id !== id)); setMessage('Đã thu hồi phiên đăng nhập.'); });
  const revokeMany = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget, currentPassword = new FormData(form).get('currentPassword');
    void run(async () => {
      await accountRequest(`auth/logout-${confirm}`, 'POST', confirm === 'all' ? { currentPassword } : {});
      form.reset();
      if (confirm === 'all') { setAccount(null); onClose(); window.dispatchEvent(new CustomEvent('account-notice', { detail: 'Đã đăng xuất tất cả thiết bị.' })); }
      else { setSessions(old => old.filter(item => item.isCurrent)); setConfirm(null); setMessage('Đã đăng xuất các phiên khác.'); }
    });
  };
  const date = (value: string) => new Date(value).toLocaleString('vi-VN');
  return <dialog ref={dialog} className="auth-dialog account-settings" aria-labelledby="account-title" onCancel={event => { event.preventDefault(); if (!lock.current) onClose(); }}>
    <div className="auth-heading"><h2 id="account-title">Quản lý tài khoản</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Đóng quản lý tài khoản">×</button></div>
    {error && <p className="auth-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button disabled={busy} onClick={() => void reload()}>Tải lại thông tin</button>
    {!profile && !error && <p role="status">Đang tải tài khoản…</p>}
    {profile && <>
      <section aria-labelledby="profile-title"><h3 id="profile-title">Thông tin cá nhân</h3><p>Email: {profile.email}</p><p>Ngày tạo: {date(profile.createdAt)}</p>
        <form onSubmit={saveName}><label>Tên hiển thị<input key={profile.displayName} name="displayName" defaultValue={profile.displayName} maxLength={80} required disabled={busy} autoComplete="name" /></label><button disabled={busy}>Lưu tên</button></form>
      </section>
      <section aria-labelledby="password-title"><h3 id="password-title">Đổi mật khẩu</h3><p>Đổi mật khẩu sẽ đăng xuất tất cả thiết bị, kể cả phiên hiện tại.</p>
        <form onSubmit={changePassword}><label>Mật khẩu hiện tại<input type="password" name="currentPassword" autoComplete="current-password" required minLength={8} maxLength={128} disabled={busy} /></label><label>Mật khẩu mới<input type="password" name="newPassword" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} /></label><label>Xác nhận mật khẩu mới<input type="password" name="confirmPassword" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} /></label><button disabled={busy}>Đổi mật khẩu và đăng xuất</button></form>
      </section>
      <section aria-labelledby="sessions-title"><h3 id="sessions-title">Phiên đăng nhập</h3><p>Hiển thị tối đa 100 phiên còn hiệu lực, gồm phiên hiện tại. Không suy đoán thiết bị từ trình duyệt.</p>
        <ul className="account-sessions">{sessions.map(item => <li key={item.id}><strong>{item.isCurrent ? 'Phiên hiện tại' : 'Phiên khác'}</strong><span>Tạo: {date(item.createdAt)}</span><span>Hết hạn: {date(item.expiresAt)}</span>{!item.isCurrent && <button disabled={busy} onClick={() => void revoke(item.id)}>Đăng xuất phiên này</button>}</li>)}</ul>
        {!confirm ? <div className="account-session-actions"><button disabled={busy} onClick={() => setConfirm('others')}>Đăng xuất các phiên khác</button><button disabled={busy} onClick={() => setConfirm('all')}>Đăng xuất tất cả thiết bị</button></div> : <form onSubmit={revokeMany} className="account-confirm"><p>{confirm === 'all' ? 'Xác nhận đăng xuất tất cả thiết bị, gồm phiên hiện tại?' : 'Xác nhận đăng xuất mọi phiên khác? Phiên hiện tại được giữ lại.'}</p>{confirm === 'all' && <label>Mật khẩu hiện tại để đăng xuất tất cả<input type="password" name="currentPassword" required minLength={8} maxLength={128} autoComplete="current-password" disabled={busy} /></label>}<button disabled={busy}>Xác nhận đăng xuất</button><button type="button" disabled={busy} onClick={() => setConfirm(null)}>Hủy</button></form>}
      </section>
      <p>PDF và chat được lưu theo tài khoản trên trình duyệt này, chưa đồng bộ giữa các thiết bị.</p>
    </>}
    {busy && <p role="status">Đang xử lý…</p>}
  </dialog>;
}
