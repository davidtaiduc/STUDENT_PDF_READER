import type { BackendHealth } from '../../shared/types/backend.ts';

export async function fetchBackendHealth(baseUrl: string, signal: AbortSignal): Promise<BackendHealth> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`, { signal,
    cache: 'no-store', headers: { Accept: 'application/json' } });
  const data = await response.json();
  if (data?.service !== 'student-pdf-reader-api' || !['connected', 'unavailable'].includes(data.database)
    || typeof data.ai?.configured !== 'boolean' || data.accounts?.enabled !== false
    || (!response.ok && response.status !== 503)) throw new Error('Backend trả trạng thái không hợp lệ.');
  return data;
}
