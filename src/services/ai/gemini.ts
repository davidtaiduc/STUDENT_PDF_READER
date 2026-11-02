import type { AiAction } from '../../types/ai.ts';
import type { AiExcerpt } from '../../../shared/types/ai.ts';
import { readSse } from '../../../shared/ai/sse.ts';
import { errorFromPayload } from '../../../shared/ai/errors.ts';

export async function streamGemini(options: { action: AiAction; excerpt: AiExcerpt; question: string;
  baseUrl?: string; signal: AbortSignal; onText: (text: string) => void; onModel: (model: string) => void }) {
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(185000)]);
  try {
    const response = await fetch(`${(options.baseUrl || '').replace(/\/$/, '')}/api/ai`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: options.action, selectedText: options.excerpt.cleanedText,
        before: options.excerpt.context.before.slice(-650), after: options.excerpt.context.after.slice(0, 650), question: options.question }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw errorFromPayload(payload);
    }
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Backend AI trả phản hồi không hợp lệ.');
    let done = false;
    let length = 0;
    await readSse(response.body, signal, data => {
      const event = JSON.parse(data);
      if (event?.type === 'meta' && typeof event.model === 'string') options.onModel(event.model);
      else if (event?.type === 'text' && typeof event.text === 'string') {
        length += event.text.length;
        if (length > 50000) throw new Error('Kết quả quá dài.');
        options.onText(event.text);
      } else if (event?.type === 'error') throw errorFromPayload(event);
      else if (event?.type === 'done') { done = true; return false; }
      else throw new Error('Phản hồi AI không hợp lệ.');
    });
    if (!done) throw new Error('Kết nối AI bị ngắt. Hãy thử lại.');
    if (!length) throw new Error('Gemini không trả nội dung. Hãy thử lại.');
  } catch (error) {
    options.signal.throwIfAborted();
    if (signal.aborted) throw new Error('Gemini phản hồi quá lâu. Hãy thử lại.', { cause: error });
    if (error instanceof TypeError) throw new Error('Không kết nối được backend AI. Kiểm tra kết nối và dịch vụ backend.', { cause: error });
    if (error instanceof SyntaxError) throw new Error('Phản hồi AI không hợp lệ.', { cause: error });
    throw error;
  }
}
