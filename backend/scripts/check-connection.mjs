import { MongoClient } from 'mongodb';
import { configureDns } from '../src/config/dns.ts';

async function check() {
  configureDns(process.env.MONGODB_DNS_SERVERS);
  if (!process.env.MONGODB_URI?.trim()) throw new Error('Điền MONGODB_URI của database đã có vào .env trước.');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  try {
    try { await client.connect(); await client.db(process.env.MONGODB_DB || 'student_pdf_reader').command({ping:1},{timeoutMS:5000}); }
    catch { throw new Error('Không kết nối được MongoDB. Kiểm tra URI, tài khoản database và quyền truy cập mạng.'); }
    const base = `http://127.0.0.1:${process.env.PORT || 3001}`;
    let response;
    try { response = await fetch(`${base}/api/health`, {signal:AbortSignal.timeout(6000)}); }
    catch { throw new Error('Database kết nối được nhưng backend chưa chạy. Mở terminal khác và chạy npm run server.'); }
    const status = await response.json();
    if (!response.ok || status.service !== 'student-pdf-reader-api' || status.database !== 'connected') throw new Error('Backend chưa kết nối được database.');
    const access = await fetch(`${base}/api/access`, {signal:AbortSignal.timeout(5000),
      headers:{Authorization:`Bearer ${process.env.AI_ACCESS_TOKEN || ''}`}});
    if (!access.ok) throw new Error('Backend chạy nhưng mã truy cập không khớp. Khởi động lại backend sau khi đổi .env.');
    console.log(JSON.stringify({database:'connected',backend:'connected',authentication:'app-token',geminiConfigured:status.ai.configured}));
  } finally { await client.close(); }
}
check().catch(error => { console.error(error instanceof Error ? error.message : 'Kiểm tra backend thất bại.'); process.exitCode = 1; });
