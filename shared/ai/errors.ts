export type AiErrorCode = 'provider_rate_limit' | 'provider_limit' | 'provider_quota' | 'provider_unavailable'
  | 'app_busy' | 'app_quota' | 'configuration' | 'payment' | 'unknown';
export class AiRequestError extends Error {
  code: AiErrorCode;
  retryable: boolean;
  retryAfterSeconds: number;
  constructor(message: string, code: AiErrorCode = 'unknown', retryable = true, retryAfterSeconds = 0) {
    super(message);
    this.name = 'AiRequestError';
    this.code = code;
    this.retryable = retryable;
    this.retryAfterSeconds = Number.isFinite(retryAfterSeconds) ? Math.min(86400, Math.max(0, Math.ceil(retryAfterSeconds))) : 0;
  }
}

export function errorFromPayload(payload: { error?: unknown; code?: unknown; retryable?: unknown; retryAfterSeconds?: unknown }) {
  const codes: AiErrorCode[] = ['provider_rate_limit','provider_limit','provider_quota','provider_unavailable','app_busy','app_quota','configuration','payment','unknown'];
  return new AiRequestError(typeof payload?.error === 'string' ? payload.error : 'Chưa nhận được phản hồi AI. Hãy thử lại.',
    codes.includes(payload?.code as AiErrorCode) ? payload.code as AiErrorCode : 'unknown',
    payload?.retryable !== false, typeof payload?.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : 0);
}

export function aiErrorTitle(code: AiErrorCode) {
  if (code === 'provider_rate_limit') return 'Gemini cần một khoảng nghỉ';
  if (code === 'provider_limit') return 'Gemini đang giới hạn yêu cầu';
  if (code === 'provider_quota') return 'Đã hết hạn mức Gemini trong ngày';
  if (code === 'app_busy') return 'Ứng dụng đang xử lý yêu cầu khác';
  if (code === 'app_quota') return 'Đã chạm hạn mức của ứng dụng';
  if (code === 'payment' || code === 'configuration') return 'Dịch vụ AI cần được kiểm tra';
  return 'Chưa thể hoàn tất tác vụ';
}

export function formatWait(seconds: number) {
  const value = Math.max(0, Math.ceil(seconds));
  if (value >= 3600) return `${Math.floor(value / 3600)} giờ${value % 3600 >= 60 ? ` ${Math.floor(value % 3600 / 60)} phút` : ''}`;
  if (value >= 60) return `${Math.floor(value / 60)} phút${value % 60 ? ` ${value % 60} giây` : ''}`;
  return `${value} giây`;
}
