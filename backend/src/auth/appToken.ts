import { createHash, timingSafeEqual } from 'node:crypto';

// Routes receive a principal so a future account/session resolver can replace
// the server-to-server credential without rewriting AI handlers.
export type Principal = { kind: 'app'; id: 'preview' } | { kind: 'user'; id: string };
export type Authenticate = (authorization: string | undefined) => Promise<Principal | null>;

export function appTokenAuthenticator(accessToken: string): Authenticate {
  if (accessToken.length < 32) throw new Error('AI_ACCESS_TOKEN cần ít nhất 32 ký tự ngẫu nhiên.');
  const expected = createHash('sha256').update(`Bearer ${accessToken}`).digest();
  return async authorization => {
    const provided = createHash('sha256').update(authorization || '').digest();
    return timingSafeEqual(expected, provided) ? { kind: 'app', id: 'preview' } : null;
  };
}
