import { createApi } from './app.ts';
import { generateGemini } from './services/ai/gemini.ts';
import { mongoQuota } from './services/usage/quota.ts';
import { createDatabase } from './database/mongo.ts';
import { appTokenAuthenticator } from './auth/appToken.ts';
import { configureDns } from './config/dns.ts';
import { createQuotaPolicy } from './services/usage/quotaPolicy.ts';

async function main() {
  configureDns(process.env.MONGODB_DNS_SERVERS);
  const required = (name: string) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Cần cấu hình ${name} trong file .env hoặc môi trường backend.`);
    return value;
  };
  const positive = (name: string, fallback: number) => {
    const value = Number(process.env[name] || fallback);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} phải là số nguyên dương.`);
    return value;
  };
  const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  const authenticate = appTokenAuthenticator(required('AI_ACCESS_TOKEN'));
  const origins = required('ALLOWED_ORIGINS').split(',').map(value => value.trim());
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('ALLOWED_ORIGINS phải gồm các origin chính xác, không có dấu / cuối.');
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const port = positive('PORT', 3001);
  if (port > 65535) throw new Error('PORT phải nhỏ hơn 65536.');
  const maxConcurrent = positive('MAX_CONCURRENT_REQUESTS', 3);
  const daily = positive('DAILY_REQUEST_LIMIT', 100);
  const minute = positive('MINUTE_REQUEST_LIMIT', 10);
  const database = createDatabase(required('MONGODB_URI'), process.env.MONGODB_DB || 'student_pdf_reader');
  const host = process.env.HOST || '127.0.0.1';
  const quota = createQuotaPolicy({ development: process.argv.includes('--development'), host, nodeEnv: process.env.NODE_ENV },
    mongoQuota(database.usage, daily, minute));
  try {
    await database.connect();
    const server = createApi({ authenticate, origins, model, maxConcurrent, aiConfigured: !!apiKey,
      getHealth: async () => ({ service: 'student-pdf-reader-api', database: await database.isConnected() ? 'connected' : 'unavailable',
        ai: { configured: !!apiKey }, accounts: { enabled: false }, requestLimits: quota.mode }),
      consumeQuota: quota.consume,
      generate: (messages, signal, onText) => generateGemini({ apiKey, model, messages, signal, onText }),
    });
    server.on('error', () => { console.error('Không mở được cổng backend.'); void database.close(); process.exitCode = 1; });
    server.listen(port, host, () => {
      console.log(`Backend sẵn sàng tại http://${host}:${port}; MongoDB đã kết nối.`);
      if (quota.mode === 'development-unlimited') console.log('Phát triển local: không giới hạn số lượt AI theo phút/ngày.');
      if (!apiKey) console.log('AI chưa bật: cần cấu hình GEMINI_API_KEY.');
    });
    const shutdown = () => { server.close(() => { void database.close(); }); server.closeAllConnections(); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch {
    await database.close();
    throw new Error('Không kết nối được MongoDB. Kiểm tra server đang chạy và MONGODB_URI.');
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Không khởi động được backend.'); process.exitCode = 1; });
