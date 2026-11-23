import { ObjectId } from 'mongodb';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthRepository, UserDocument } from './repository.ts';
import { AuthError, resolveSession, validateName, validatePassword, type PasswordWork } from './security.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { sessionCookie } from './session.ts';
const profile = (user: UserDocument) => ({ id: user._id.toHexString(), email: user.email, displayName: user.displayName, ...(user.emailVerifiedAt ? {emailVerified:true} : {}), createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() });
export async function manageAccount(repo: AuthRepository, req: IncomingMessage, res: ServerResponse,
  input: Record<string, unknown>, secure: boolean, passwordWork: PasswordWork) {
  const auth = await resolveSession(repo, req.headers.cookie);
  if (!auth) { res.setHeader('Set-Cookie', sessionCookie('', secure)); throw new AuthError(401, 'Phiên đăng nhập đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.'); }
  const { user, session } = auth, version = user.sessionVersion ?? 0, path = req.url;
  const send = (value: object) => { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
  if (path === '/api/users/me' && req.method === 'GET') { send(profile(user)); return; }
  if (path === '/api/users/me' && req.method === 'PATCH') {
    if (Object.keys(input).some(key => key !== 'displayName')) throw new AuthError(400, 'Chỉ được cập nhật tên hiển thị.');
    const updated = await repo.updateName(user._id, validateName(input.displayName));
    if (!updated) throw new AuthError(401, 'Tài khoản không còn khả dụng.');
    send(profile(updated)); return;
  }
  if (path === '/api/auth/sessions' && req.method === 'GET') {
    const sessions = await repo.listSessions(user._id, version, new Date());
    const list = [session, ...sessions.filter(item => !item._id.equals(session._id))].slice(0, 100);
    send({ sessions: list.map(item => ({ id: item._id.toHexString(), createdAt: item.createdAt.toISOString(), expiresAt: item.expiresAt.toISOString(), isCurrent: item._id.equals(session._id) })), limit: 100 }); return;
  }
  if (path?.startsWith('/api/auth/sessions/') && req.method === 'DELETE') {
    const id = path.slice('/api/auth/sessions/'.length);
    if (!/^[a-fA-F0-9]{24}$/.test(id) || !await repo.revokeSession(new ObjectId(id), user._id)) throw new AuthError(404, 'Không tìm thấy phiên đăng nhập.');
    const current = session._id.toHexString() === id.toLowerCase();
    if (current) res.setHeader('Set-Cookie', sessionCookie('', secure));
    send({ success: true, authenticated: !current }); return;
  }
  if (path === '/api/auth/logout-others' && req.method === 'POST') {
    await repo.revokeOthers(user._id, session._id); send({ success: true }); return;
  }
  if ((path === '/api/auth/change-password' || path === '/api/auth/logout-all') && req.method === 'POST') {
    const current = validatePassword(input.currentPassword), change = path === '/api/auth/change-password';
    const next = change ? validatePassword(input.newPassword) : '';
    await passwordWork(req, change ? 'change-password' : 'logout-all', user._id.toHexString(), async () => {
      if (!await verifyPassword(user.passwordHash, current)) throw new AuthError(400, 'Mật khẩu hiện tại không đúng.');
      if (change && next === current) throw new AuthError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại.');
      // No cache: recheck revocation after expensive work, then atomically compare hash + generation.
      const newHash = change ? await hashPassword(next) : '';
      if (!await resolveSession(repo, req.headers.cookie)) throw new AuthError(401, 'Phiên đã bị thu hồi. Vui lòng đăng nhập lại.');
      const success = change ? await repo.changePassword(user._id, user.passwordHash, version, newHash)
        : await repo.revokeAll(user._id, user.passwordHash, version);
      if (!success) throw new AuthError(409, 'Thông tin bảo mật đã thay đổi. Vui lòng đăng nhập lại.');
    });
    res.setHeader('Set-Cookie', sessionCookie('', secure));
    send({ success: true, authenticated: false }); return;
  }
  throw new AuthError(404, 'Không tìm thấy API.');
}
