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
    const data = await response.json();
    if (!response.ok) throw new AccountRequestError(response.status, typeof data.error === 'string' ? data.error : 'Không thực hiện được yêu cầu.');
    return data as T;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('Không kết nối được dịch vụ tài khoản. Trạng thái thay đổi chưa được xác nhận; hãy tải lại thông tin.', { cause: error });
    throw error;
  } finally { clearTimeout(timer); }
}
export const loadProfile = () => accountRequest<AccountProfile>('users/me');
export const loadSessions = () => accountRequest<{sessions: AccountSession[]; limit: number}>('auth/sessions');
