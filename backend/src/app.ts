import { validateContextScope } from '../../shared/ai/contextScope.ts';
import type { UserUsage, QuotaDecision } from '../../shared/types/usage.ts';
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
  authenticateUser?: (cookie: string | undefined) => Promise<Principal | null>;
  readUsage?: (principal: Principal) => Promise<UserUsage>;
  allowAiAttempt?: (userId: string) => Promise<boolean>;
  acquireSlot?: () => Promise<(() => Promise<void>) | null>;
  libraryHandler?: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>;
  emailHandler?: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>;
  authHandler?: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>;
  getHealth: () => Promise<BackendHealth>;
  consumeQuota: (principal: Principal) => Promise<boolean | QuotaDecision>;
  admitGlobal?: () => Promise<boolean>;
  generate: (messages: { role: string; content: string }[], signal: AbortSignal, onText: (text: string) => Promise<void>) => Promise<void>;
}

export function createApi(options: ApiOptions) {
  let active = 0;
  return createServer({ requestTimeout: 120000, headersTimeout: 10000, maxHeaderSize: 8192 }, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const fail = (status: number, error: string, details: object = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error, ...details }));
    };
    const origin = req.headers.origin;
    if (origin && !options.origins.includes(origin)) { fail(403, 'Website chưa được phép gọi AI.'); return; }
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, HEAD, PUT, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match, X-Library-Owner' });
      res.end(); return;
    }
    if(req.url?.startsWith('/api/library/')&&options.libraryHandler){await options.libraryHandler(req,res);return;}
    if (['/api/auth/forgot-password','/api/auth/reset-password','/api/auth/resend-verification','/api/auth/verify-email'].includes(req.url ?? '') && options.emailHandler) { await options.emailHandler(req,res); return; }
    if ((req.url?.startsWith('/api/auth/') || req.url?.startsWith('/api/users/')) && options.authHandler) { await options.authHandler(req, res); return; }
    if (req.url === '/api/health' && req.method === 'GET') {
      try {
        const health = await options.getHealth();
        res.writeHead(health.database === 'connected' ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(health));
      } catch { fail(503, 'Backend chưa sẵn sàng.'); }
      return;
    }
    if (!(req.url === '/api/ai' && req.method === 'POST') && !(req.url === '/api/access' && req.method === 'GET') && !(req.url === '/api/usage/me' && req.method === 'GET')) { fail(404, 'Không tìm thấy API.'); return; }
    let principal: Principal | null;
    try {
      if (req.url !== '/api/usage/me' && !await options.authenticate(req.headers.authorization)) { fail(401, 'Chưa có quyền truy cập dịch vụ AI.'); return; }
      principal = await options.authenticateUser?.(req.headers.cookie) ?? null;
    } catch { fail(503, 'Dịch vụ xác thực chưa sẵn sàng.'); return; }
    if (!principal || principal.kind !== 'user') { fail(401, 'Vui lòng đăng nhập để sử dụng AI.'); return; }
    if (req.url === '/api/usage/me') {
      try {
        if (!options.readUsage) throw new Error('Usage unavailable');
        const usage = await options.readUsage(principal);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(usage));
      } catch { if (!res.headersSent) fail(503, 'Không đọc được hạn mức AI.'); else res.end(); }
      return;
    }
    if (req.url === '/api/access') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ authenticated: true, authentication: 'user', accountsEnabled: true })); return;
    }
    if (!origin || !options.origins.includes(origin)) { fail(403, 'Nguồn yêu cầu AI không được phép.'); return; }
    if (!options.aiConfigured) { fail(503, 'Backend đã kết nối; quản trị viên cần cấu hình Gemini API key để dùng AI.'); return; }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) { fail(415, 'Yêu cầu phải là JSON.'); return; }
    if (options.allowAiAttempt) {
      try { if (!await options.allowAiAttempt(principal.id)) { fail(429, 'Bạn gửi yêu cầu quá nhanh. Hãy chờ một phút.', { code: 'app_busy', retryable: true, retryAfterSeconds: 60 }); return; } }
      catch { fail(503, 'Không kiểm tra được giới hạn yêu cầu AI.'); return; }
    }
    if (active >= options.maxConcurrent) { fail(429, 'Ứng dụng đang xử lý các yêu cầu khác. Chờ một chút rồi thử lại.', { code: 'app_busy', retryable: true, retryAfterSeconds: 2 }); return; }
    active++;
    let releaseSlot: (() => Promise<void>) | null = null;
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
          context: { before: input.before, after: input.after }, scope:validateContextScope(input.scope) }, input.question,
          validateChatContext(input.history));
      } catch (error) { fail(400, error instanceof SyntaxError ? 'JSON không hợp lệ.' : error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.'); return; }
      controller.signal.throwIfAborted();
      if (options.acquireSlot) {
        try { releaseSlot = await options.acquireSlot(); } catch { fail(503, 'Không kết nối được bộ điều phối AI.'); return; }
        if (!releaseSlot) { fail(429, 'AI đang xử lý yêu cầu khác. Vui lòng thử lại.', { code: 'app_busy', retryable: true, retryAfterSeconds: 2 }); return; }
      }
      controller.signal.throwIfAborted();
      if(options.admitGlobal){
        let admitted=false;try{admitted=await options.admitGlobal();}catch{fail(503,'Chưa kiểm tra được ngân sách lượt AI của ứng dụng.');return;}
        if(!admitted){const retry=Math.ceil((86400000-Date.now()%86400000)/1000);res.setHeader('Retry-After',String(retry));fail(429,'Ứng dụng đã hết ngân sách lượt AI hôm nay. Hãy quay lại sau 00:00 UTC.',{code:'app_quota',retryable:true,retryAfterSeconds:retry});return;}
      }
      let allowed;
      try { allowed = await options.consumeQuota(principal); }
      catch { fail(503, 'Không kết nối được cơ sở dữ liệu. Hãy thử lại sau.'); return; }
      if (allowed === false || (typeof allowed === 'object' && !allowed.allowed)) {
        const retry = typeof allowed === 'object' ? allowed.retryAfterSeconds ?? 60 : 60;
        res.setHeader('Retry-After', String(retry));
        fail(429, typeof allowed === 'object' && allowed.reason === 'day' ? 'Bạn đã dùng hết lượt AI hôm nay. Hạn mức đặt lại lúc 00:00 UTC.' : 'Bạn đã chạm giới hạn AI theo phút. Hãy chờ rồi thử lại.', { code: 'app_quota', retryable: true, retryAfterSeconds: retry }); return;
      }
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
      if (releaseSlot) await releaseSlot().catch(() => {});
    }
  });
}
