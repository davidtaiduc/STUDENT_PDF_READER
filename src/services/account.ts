import type { AccountProfile, AccountSession } from '../../shared/types/account';
export class AccountRequestError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export async function accountRequest<T>(path: string, method = 'GET', input?: object): Promise<T> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${(import.meta.env.VITE_AI_API_URL || '').replace(/\/$/, '')}/api/${path}`, {
      method, credentials: 'include', cache: 'no-store', signal: controller.signal,
      ...(method !== 'GET' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input ?? {}) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const fallback = response.status === 403
        ? 'Website chưa được cấp quyền truy cập dịch vụ tài khoản. Vui lòng liên hệ người quản trị.'
        : 'Dịch vụ tài khoản tạm chưa sẵn sàng. Hãy thử lại sau.';
      throw new AccountRequestError(response.status, typeof data?.error === 'string' ? data.error : fallback);
    }
    if (!data || typeof data !== 'object') throw new AccountRequestError(response.status, 'Chưa nhận được thông tin tài khoản hợp lệ. Hãy tải lại trang và thử lại.');
    return data as T;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('Không kết nối được dịch vụ tài khoản. Trạng thái thay đổi chưa được xác nhận; hãy tải lại thông tin.', { cause: error });
    throw error;
  } finally { clearTimeout(timer); }
}
export const loadProfile = () => accountRequest<AccountProfile>('users/me');
export const loadSessions = () => accountRequest<{sessions: AccountSession[]; limit: number}>('auth/sessions');
