# Day 11 — security review (04/11/2026)

## Ranh giới xác thực

/api/ai và /api/access yêu cầu internal bearer được Vite local proxy chèn ở server và live HttpOnly user session. Token ứng dụng một mình bị 401; session một mình không gọi AI được. /api/usage/me chỉ cần session, principal lấy từ ObjectId của user sau kiểm tra expiry + generation + DB revocation, không từ body/query/header/email. Usage trả thông tin của chính user, no-store.

POST AI bắt buộc JSON và Origin chính xác trong ALLOWED_ORIGINS. CORS credential không wildcard. Auth/AI cookies giữ HttpOnly, SameSite=Lax, Path=/, Secure khi production/non-development. Không thay Argon2/session architecture, model/prompt/key/SSE. Không log secret, token/cookie hoặc raw Mongo/provider response. Auth failures dùng message an toàn.

## Quota và rate limiting

ai_user_usage_v1 có _id=userId, unique userId, daily UTC bucket/counter và minute bucket/counter. Một findOneAndUpdate aggregation pipeline điều kiện tăng cả hai counter hoặc không tăng. Dùng indexed _id match, không dùng $expr trong upsert filter. Concurrent initial duplicate upsert được retry một lần không upsert; các lỗi khác fail closed. Không reset counter do restart, không in-memory source of truth, không multi-document transaction assumption.

Ai attempts rate guard Mongo riêng (default 30/user/phút), TTL counters; valid request quota default 30/user/ngày UTC và 5/phút. Invalid payload không tính paid quota, nhưng có thể tiêu thụ attempt guard. Register/login/change-password/logout-all tiếp tục Mongo counters của Day 9/10. Usage reads/profile/session mutations chưa có edge rate limiting riêng; cần thiết kế gateway rate policy trước public deployment.

ai_runtime_v1 là shared lease semaphore, limit MAX_CONCURRENT_REQUESTS default3 dùng chung DB. Lease 210 giây, request deadline180; release finally, crash reclaim khi hết hạn. Process active guard chỉ bổ sung. Điều kiện production: mọi instance dùng cùng DB/config, đồng hồ đồng bộ, upstream tuân thủ AbortSignal/deadline. Event loop bị treo/quá hạn hoặc process crash có thể giữ slot tới expiry; chưa load test. Không coi local RAM guard là global concurrency.

Validation/auth/slot unavailable/quota exhausted không tính lượt. Chấp nhận trước SSE meta/provider tính một lượt, kể cả provider lỗi/Stop sau chấp nhận. Retry là lượt mới. Không refund và không có client idempotency key; network retry có thể tính thêm nếu request mới được chấp nhận. Không trừ hai lần cùng một handler request.

## Data isolation

Scope derive từ AuthProvider confirmed state; scoped storage keys/indexes, not UI-only filter. Sidebar remount theo scope, abort stream, guard async callbacks; closures ghi về scope đã chụp. Auth unavailable khóa dữ liệu thay vì đổi guest. BroadcastChannel chỉ báo cần kiểm tra session, không phải bằng chứng principal. Các tài khoản trong cùng browser profile vẫn có thể bị đọc dữ liệu qua DevTools/mã độc origin: không encryption, không security boundary tuyệt đối.

Legacy v1 stores giữ nguyên, không silent migration, API import chỉ guest với xác nhận và transaction marker. Không có UI import; không tự chạy trên profile người dùng. Source không bị xóa. Không sync notes/history lên MongoDB.

## Trusted proxy và deployment

Vite proxy chỉ loopback với Host/Origin local. Không tin X-Forwarded-For/Forwarded-Host/Proto tùy ý; auth rate limiter dùng socket remoteAddress, có thể gộp nhiều người sau proxy. Chưa bật trust proxy. Khi có topology thật: gateway phải strip/overwrite forwarded/internal auth headers, chỉ nhận trusted upstream, giữ Origin chính xác và HTTPS; không dùng forwarded proto để tự bỏ Secure/CSRF. Không phát hành secret trong bundle hoặc thêm endpoint anonymous để làm UI chạy.

Các email chưa xác minh có thể tạo nhiều tài khoản và mỗi tài khoản có quota riêng; chưa có spend budget toàn project hoặc chống multi-account hoàn chỉnh. Hạn mức Google/billing vẫn độc lập; đây chưa là quyết định production-ready. Không deploy trong Day 11.

## Argon2 và HTTPS

Giữ Argon2id m=65536 KiB,t=3,p=1, cap2 expensive operations/process + Mongo budgets. Benchmark Day 11 Windows Node22.23.2: hash98.42ms, verify98.46ms (3 mẫu), cặp2hash118.82ms (2 batch). Không benchmark tải cao hay đổi thông số. RAM cấu hình khoảng128MiB cho hai hash, cộng overhead; nhiều process cần tổng hợp tài nguyên.

HttpOnly/Secure/SameSite/Path/expiry/revoke có automated tests. **HTTPS staging cookie: MANUAL TEST REQUIRED**, chưa có staging. **Mongo integration: NOT RUN**, thiếu URI test riêng; pipeline unit evaluator/fake repository không thay thế Mongo thật. Hướng dẫn docs/ACCOUNT_INTEGRATION_TESTS.md.

## Tham khảo chính thức

- MongoDB aggregation update: https://www.mongodb.com/docs/manual/reference/method/db.collection.findoneandupdate/
- MongoDB atomic writes: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
- MDN IndexedDB upgrades/compound keys: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
