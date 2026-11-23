import type { IncomingMessage } from 'node:http';
import type { AuthRepository, UserDocument } from './repository.ts';
import { readSessionCookie, sessionHash } from './session.ts';
export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export const publicUser = (user: UserDocument) => ({ id: user._id.toHexString(), email: user.email, displayName: user.displayName, ...(user.emailVerifiedAt ? {emailVerified:true} : {}) });
export function validateName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 80 || Array.from(name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new AuthError(400, 'Tên hiển thị cần từ 1 đến 80 ký tự.');
  return name;
}
export function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) throw new AuthError(400, 'Mật khẩu cần từ 8 đến 128 ký tự.');
  return value;
}
export async function jsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw new AuthError(415, 'Yêu cầu phải là JSON.');
  let size = 0; const chunks: Buffer[] = [];
  for await (const part of req) { size += part.length; if (size > 8192) throw new AuthError(413, 'Dữ liệu quá dài.'); chunks.push(part); }
  let data: unknown;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AuthError(400, 'JSON không hợp lệ.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AuthError(400, 'Dữ liệu không hợp lệ.');
  return data as Record<string, unknown>;
}
export async function resolveSession(repo: AuthRepository, cookie: string | undefined) {
  const token = readSessionCookie(cookie);
  const session = token ? await repo.findSession(sessionHash(token), new Date()) : null;
  const user = session ? await repo.userById(session.userId) : null;
  if (!user || !session || (session.version ?? 0) !== (user.sessionVersion ?? 0)) return null;
  return { user, session };
}
export function createPasswordWork(repo: AuthRepository) {
  let active = 0;
  return async <T>(req: IncomingMessage, action: 'register' | 'login' | 'change-password' | 'logout-all', subject: string, work: () => Promise<T>): Promise<T> => {
    const bucket = Math.floor(Date.now() / 900000), expiry = new Date((bucket + 2) * 900000);
    const register = action === 'register', sensitive = action === 'change-password' || action === 'logout-all';
    if (!await repo.consume(`${action}:ip:${sessionHash(req.socket.remoteAddress ?? 'unknown')}:${bucket}`, register ? 5 : 20, expiry)
      || !await repo.consume(`${action}:subject:${sessionHash(subject)}:${bucket}`, register ? 3 : sensitive ? 5 : 10, expiry)
      || !await repo.consume(`auth:global:${bucket}`, 200, expiry)) throw new AuthError(429, 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.');
    if (active >= 2) throw new AuthError(429, 'Đang xử lý yêu cầu tài khoản khác. Vui lòng thử lại sau.');
    active++;
    try { return await work(); } finally { active--; }
  };
}
export type PasswordWork = ReturnType<typeof createPasswordWork>;
