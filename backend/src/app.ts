import { createServer } from 'node:http';
import { once } from 'node:events';
import { buildMessages } from './services/ai/prompts.ts';
import type { AiAction } from '../../shared/types/ai.ts';
import type { BackendHealth } from '../../shared/types/backend.ts';
import type { Authenticate, Principal } from './auth/appToken.ts';
import { AiRequestError } from '../../shared/ai/errors.ts';
import { validateChatContext } from '../../shared/ai/chat.ts';

export interface ApiOptions {
  authenticate: Authenticate; origins: string[]; model: string; maxConcurrent: number;
  aiConfigured: boolean;
  getHealth: () => Promise<BackendHealth>;
  consumeQuota: (principal: Principal) => Promise<boolean>;
  generate: (messages: { role: string; content: string }[], signal: AbortSignal, onText: (text: string) => Promise<void>) => Promise<void>;
}

export function createApi(options: ApiOptions) {
  let active = 0;
  return createServer({ requestTimeout: 15000, headersTimeout: 10000, maxHeaderSize: 8192 }, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const fail = (status: number, error: string, details: object = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error, ...details }));
    };
    const origin = req.headers.origin;
    if (origin && !options.origins.includes(origin)) { fail(403, 'Website chưa được phép gọi AI.'); return; }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
      res.end(); return;
    }
    if (req.url === '/api/health' && req.method === 'GET') {
      try {
        const health = await options.getHealth();
        res.writeHead(health.database === 'connected' ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(health));
      } catch { fail(503, 'Backend chưa sẵn sàng.'); }
      return;
    }
    if (!(req.url === '/api/ai' && req.method === 'POST') && !(req.url === '/api/access' && req.method === 'GET')) { fail(404, 'Không tìm thấy API.'); return; }
    let principal: Principal | null;
    try { principal = await options.authenticate(req.headers.authorization); }
    catch { fail(503, 'Dịch vụ xác thực chưa sẵn sàng.'); return; }
    if (!principal) { fail(401, 'Bạn chưa có quyền sử dụng tác vụ này.'); return; }
    if (req.url === '/api/access') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ authenticated: true, authentication: principal.kind, accountsEnabled: false }));
      return;
    }
    if (!options.aiConfigured) { fail(503, 'Backend đã kết nối; quản trị viên cần cấu hình Gemini API key để dùng AI.'); return; }
    if (!req.headers['content-type']?.startsWith('application/json')) { fail(415, 'Yêu cầu phải là JSON.'); return; }
    if (active >= options.maxConcurrent) { fail(429, 'Ứng dụng đang xử lý các yêu cầu khác. Chờ một chút rồi thử lại.', { code: 'app_busy', retryable: true, retryAfterSeconds: 2 }); return; }
    active++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180000);
    const disconnected = () => { if (!res.writableFinished) controller.abort(); };
    res.on('close', disconnected);
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const part of req) {
        size += part.length;
        if (size > 65536) { fail(413, 'Đoạn gửi quá dài.'); return; }
        chunks.push(part);
      }
      let messages;
      try {
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!input || !['translate', 'explain', 'ask'].includes(input.action)
          || typeof input.selectedText !== 'string' || typeof input.before !== 'string' || typeof input.after !== 'string'
          || typeof input.question !== 'string' || input.before.length > 650 || input.after.length > 650) throw new Error('Dữ liệu gửi không hợp lệ.');
        messages = buildMessages(input.action as AiAction, { cleanedText: input.selectedText,
          context: { before: input.before, after: input.after } }, input.question,
          validateChatContext(input.history));
      } catch (error) { fail(400, error instanceof SyntaxError ? 'JSON không hợp lệ.' : error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.'); return; }
      let allowed;
      try { allowed = await options.consumeQuota(principal); }
      catch { fail(503, 'Không kết nối được cơ sở dữ liệu. Hãy thử lại sau.'); return; }
      if (!allowed) { fail(429, 'Ứng dụng đã chạm hạn mức hiện tại. Hãy thử lại sau hoặc liên hệ người quản lý ứng dụng.', { code: 'app_quota', retryable: true, retryAfterSeconds: 60 }); return; }
      controller.signal.throwIfAborted();
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no' });
      res.flushHeaders();
      const send = async (value: object) => {
        controller.signal.throwIfAborted();
        if (!res.write(`data: ${JSON.stringify(value)}\n\n`)) await once(res, 'drain', { signal: controller.signal });
      };
      await send({ type: 'meta', model: options.model });
      try {
        await options.generate(messages, controller.signal, text => send({ type: 'text', text }));
        await send({ type: 'done' });
      } catch (error) {
        if (error instanceof AiRequestError && !controller.signal.aborted) {
          await send({ type: 'error', error: error.message, code: error.code, retryable: error.retryable, retryAfterSeconds: error.retryAfterSeconds });
          res.end(); return;
        }
        // Provider messages are curated by our adapter; never forward raw API bodies.
        if (!controller.signal.aborted) await send({ type: 'error', error: error instanceof Error && !(error instanceof SyntaxError) && !(error instanceof TypeError)
          ? error.message : 'Không nhận được phản hồi Gemini. Hãy thử lại.' });
      }
      res.end();
    } catch {
      if (!res.headersSent) fail(503, 'Dịch vụ AI chưa sẵn sàng.');
      else res.end();
    } finally {
      clearTimeout(timer);
      res.off('close', disconnected);
      controller.abort();
      active--;
    }
  });
}
