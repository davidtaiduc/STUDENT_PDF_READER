import { AiRequestError } from '../../../../shared/ai/errors.ts';

export function geminiFailure(status: number, payload: unknown, retryAfter: string | null = null, now = Date.now()) {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const error = data.error && typeof data.error === 'object' ? data.error as Record<string, unknown> : data;
  const code = typeof error.code === 'string' ? error.code.toLowerCase() : typeof error.status === 'string' ? error.status.toLowerCase() : '';
  const details = Array.isArray(error.details) ? error.details : [];
  let delay = 0;
  if (retryAfter) delay = /^\d+(?:\.\d+)?$/.test(retryAfter.trim()) ? Number(retryAfter) : (Date.parse(retryAfter) - now) / 1000;
  if (!Number.isFinite(delay)) delay = 0;
  for (const detail of details) {
    if (!detail || typeof detail !== 'object' || detail['@type'] !== 'type.googleapis.com/google.rpc.RetryInfo') continue;
    const retry = detail.retryDelay;
    if (typeof retry === 'string' && /^\d+(?:\.\d+)?s$/.test(retry)) delay = Math.max(delay, Number(retry.slice(0, -1)));
    else if (retry && typeof retry === 'object') {
      const seconds = Number(retry.seconds || 0) + Number(retry.nanos || 0) / 1e9;
      if (Number.isFinite(seconds)) delay = Math.max(delay, seconds);
    }
  }
  const daily = code === 'quota_exceeded' || details.some(detail => detail && typeof detail === 'object'
    && detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' && Array.isArray(detail.violations)
    && detail.violations.some((item: { quotaId?: unknown; quotaMetric?: unknown }) => /perday|per_day|daily/i.test(`${item?.quotaId || ''} ${item?.quotaMetric || ''}`)));
  if (daily) return new AiRequestError('Hạn mức Gemini trong ngày đã hết. Bạn vẫn có thể đọc PDF và lưu ghi chú; hãy quay lại khi hạn mức được làm mới.', 'provider_quota', false);
  if (status === 402 || code === 'payment_required') return new AiRequestError('Dịch vụ AI đã hết số dư. Vui lòng liên hệ người quản lý ứng dụng.', 'payment', false);
  if (status === 401 || status === 403) return new AiRequestError('Dịch vụ AI chưa được cấu hình đúng. Vui lòng liên hệ người quản lý ứng dụng.', 'configuration', false);
  if (status === 400 || status === 404) return new AiRequestError('Dịch vụ AI chưa xử lý được yêu cầu này. Vui lòng báo người quản lý ứng dụng để kiểm tra cấu hình.', 'configuration', false);
  if (status === 429 || ['rate_limit_exceeded', 'too_many_requests', 'resource_exhausted'].includes(code)) {
    const knownRate = ['rate_limit_exceeded', 'too_many_requests'].includes(code);
    return new AiRequestError(knownRate ? 'Google Gemini đang nhận quá nhiều yêu cầu trong thời gian ngắn. Hãy chờ rồi thử lại.'
      : 'Google Gemini đang giới hạn yêu cầu này. Chưa có thông tin xác nhận đã hết hạn mức trong ngày; hãy chờ một lúc rồi thử lại.',
    knownRate ? 'provider_rate_limit' : 'provider_limit', true, Math.max(5, delay));
  }
  return new AiRequestError('Dịch vụ Gemini tạm thời chưa phản hồi. Hãy chờ rồi thử lại.', 'provider_unavailable', true, Math.max(5, delay));
}

export async function readProviderError(response: Response): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) return null;
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); } catch { return null; }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
