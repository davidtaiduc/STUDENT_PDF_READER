import { readSse } from '../../../../shared/ai/sse.ts';
import { geminiFailure, readProviderError } from './geminiErrors.ts';

export async function generateGemini(options: {
  apiKey: string; model: string; messages: { role: string; content: string }[];
  signal: AbortSignal; onText: (text: string) => Promise<void>;
}) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse', {
    method: 'POST', signal: options.signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
    body: JSON.stringify({ model: options.model, store: false, stream: true,
      system_instruction: options.messages[0].content, input: options.messages[1].content,
      generation_config: { max_output_tokens: 2048 },
    }),
  });
  if (!response.ok || !response.body) {
    const payload = await readProviderError(response).catch(() => null);
    throw geminiFailure(response.status, payload, response.headers.get('retry-after'));
  }
  let completed = false;
  let length = 0;
  const outputSteps = new Set<number>();
  await readSse(response.body, options.signal, async data => {
    const event = JSON.parse(data);
    if (event.event_type === 'step.start' && event.step?.type === 'model_output') outputSteps.add(event.index);
    if (event.event_type === 'step.delta' && outputSteps.has(event.index) && event.delta?.type === 'text') {
      if (typeof event.delta.text !== 'string') throw new Error('Phản hồi Gemini không hợp lệ.');
      length += event.delta.text.length;
      if (length > 50000) throw new Error('Kết quả quá dài. Hãy chọn đoạn ngắn hơn.');
      await options.onText(event.delta.text);
    }
    if (event.event_type === 'error' || event.event_type === 'interaction.failed' || event.event_type === 'interaction.cancelled') {
      if (event.error || event.interaction?.error) throw geminiFailure(500, { error: event.error || event.interaction.error });
      throw new Error('Gemini không thể hoàn tất yêu cầu này. Hãy thử đoạn khác.');
    }
    if (event.event_type === 'interaction.completed') {
      if (event.interaction?.status !== 'completed') throw new Error('Gemini không thể hoàn tất yêu cầu này.');
      completed = true;
      return false;
    }
  });
  if (!completed) throw new Error('Kết nối Gemini bị ngắt. Hãy thử lại.');
  if (!length) throw new Error('Gemini không trả nội dung. Hãy thử đoạn khác.');
}
