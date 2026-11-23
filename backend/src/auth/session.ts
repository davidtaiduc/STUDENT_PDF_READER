import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'studypdf_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export function sessionHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function newSessionToken(): string { return randomBytes(32).toString('base64url'); }
export function readSessionCookie(header: string | undefined): string | undefined {
  const values = (header ?? '').split(';').map(item => item.trim()).filter(item => item.startsWith(`${SESSION_COOKIE}=`));
  if (values.length !== 1) return undefined;
  const value = values[0].slice(SESSION_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_SECONDS : 0}${secure ? '; Secure' : ''}`;
}
