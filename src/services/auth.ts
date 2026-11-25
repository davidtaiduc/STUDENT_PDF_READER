import type { AccountUser } from '../../shared/types/account';
export interface AuthResult { authenticated: boolean; user: AccountUser | null }
export async function authRequest(action: 'me' | 'register' | 'login' | 'logout', input?: object): Promise<AuthResult> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${import.meta.env.VITE_AI_API_URL || ''}/api/auth/${action}`, {
      method: action === 'me' ? 'GET' : 'POST', credentials: 'include', cache: 'no-store', signal: controller.signal,
      ...(action !== 'me' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input ?? {}) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : response.status === 403 ? 'Website chưa được cấp quyền truy cập dịch vụ tài khoản. Vui lòng liên hệ người quản trị.' : 'Dịch vụ tài khoản tạm chưa sẵn sàng. Hãy thử lại sau.');
    if (!data || typeof data.authenticated !== 'boolean' || (data.authenticated && (!data.user || typeof data.user.id !== 'string' || typeof data.user.email !== 'string' || typeof data.user.displayName !== 'string')) || (!data.authenticated && data.user !== null)) throw new Error('Phản hồi tài khoản không hợp lệ.');
    return { authenticated: data.authenticated, user: data.user ? { id: data.user.id, email: data.user.email, displayName: data.user.displayName, emailVerified:data.user.emailVerified === true } : null };
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('Không kết nối được dịch vụ tài khoản. Hãy thử lại.', { cause: error });
    throw error;
  } finally { clearTimeout(timer); }
}
