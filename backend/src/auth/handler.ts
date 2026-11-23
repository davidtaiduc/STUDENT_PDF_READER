import type { IncomingMessage, ServerResponse } from 'node:http';
import { ObjectId } from 'mongodb';
import type { AuthRepository, UserDocument } from './repository.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { newSessionToken, readSessionCookie, sessionCookie, sessionHash, SESSION_SECONDS } from './session.ts';
import { AuthError, createPasswordWork, jsonBody, publicUser, resolveSession, validateName, validatePassword } from './security.ts';
import { manageAccount } from './management.ts';

export function validateCredentials(input: unknown, register: boolean) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AuthError(400, 'Dữ liệu không hợp lệ.');
  const data = input as Record<string, unknown>;
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError(400, 'Email không hợp lệ.');
  return { email, password: validatePassword(data.password), displayName: register ? validateName(data.displayName) : '' };
}
export function createAuthHandler(repo: AuthRepository, origins: string[], secure: boolean) {
  const passwordWork = createPasswordWork(repo);
  // Lazy dummy hash; failure is handled with the request rather than an unhandled startup rejection.
  let dummyHash: Promise<string> | undefined;
  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, value: object) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      const path = req.url, read = req.method === 'GET';
      if (!read && !['POST', 'PATCH', 'DELETE'].includes(req.method ?? '')) throw new AuthError(404, 'Không tìm thấy API.');
      if (!read && (!req.headers.origin || !origins.includes(req.headers.origin))) throw new AuthError(403, 'Nguồn yêu cầu không được phép.');
      const input = read ? {} : await jsonBody(req);
      if (path === '/api/auth/me' && read) {
        const auth = await resolveSession(repo, req.headers.cookie);
        send(200, { authenticated: !!auth, user: auth ? publicUser(auth.user) : null }); return;
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        const token = readSessionCookie(req.headers.cookie);
        if (token) await repo.revoke(sessionHash(token));
        res.setHeader('Set-Cookie', sessionCookie('', secure)); send(200, { authenticated: false, user: null }); return;
      }
      if (!['/api/auth/register', '/api/auth/login'].includes(path ?? '') || req.method !== 'POST') {
        await manageAccount(repo, req, res, input, secure, passwordWork); return;
      }
      const register = path === '/api/auth/register';
      const { email, password, displayName } = validateCredentials(input, register);
      await passwordWork(req, register ? 'register' : 'login', email, async () => {
        let user: UserDocument | null;
        if (register) {
          const now = new Date();
          user = { _id: new ObjectId(), email, displayName, passwordHash: await hashPassword(password), createdAt: now, updatedAt: now, sessionVersion: 0 };
          try { await repo.insertUser(user); }
          catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 11000) throw new AuthError(409, 'Không thể đăng ký với email này. Hãy đăng nhập hoặc dùng email khác.'); throw error; }
        } else {
          user = await repo.findUser(email);
          if (!user) dummyHash ??= hashPassword(newSessionToken());
          const valid = await verifyPassword(user?.passwordHash ?? await dummyHash!, password);
          if (!user || !valid) throw new AuthError(401, 'Email hoặc mật khẩu không đúng.');
        }
        const token = newSessionToken(), now = new Date(), version = user.sessionVersion ?? 0;
        await repo.insertSession({ _id: new ObjectId(), userId: user._id, tokenHash: sessionHash(token), createdAt: now, expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000), version });
        const latest = await repo.userById(user._id);
        if (!latest || latest.passwordHash !== user.passwordHash || (latest.sessionVersion ?? 0) !== version) {
          await repo.revoke(sessionHash(token)); throw new AuthError(401, 'Thông tin bảo mật đã thay đổi. Vui lòng đăng nhập lại.');
        }
        const oldToken = readSessionCookie(req.headers.cookie);
        if (oldToken) await repo.revoke(sessionHash(oldToken));
        res.setHeader('Set-Cookie', sessionCookie(token, secure));
        send(register ? 201 : 200, { authenticated: true, user: publicUser(latest) });
      });
    } catch (error) {
      if (error instanceof AuthError) { if (error.status === 429) res.setHeader('Retry-After', '900'); send(error.status, { error: error.message }); }
      else send(503, { error: 'Dịch vụ tài khoản chưa sẵn sàng. Vui lòng thử lại sau.' });
    }
  };
}
