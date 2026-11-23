# Account integration tests — Day 10

## Ranh giới an toàn

Mặc định `npm test` chỉ chạy các test fake/unit/HTTP hiện có; không kết nối MongoDB thật. `npm run test:integration` là lệnh riêng, chỉ đọc MONGODB_TEST_URI từ môi trường tiến trình, không tự load .env và không fallback MONGODB_URI.

Chỉ dùng một MongoDB server/account dành riêng cho test. Không sao chép URI ứng dụng/production sang biến test. Bộ test từ chối khi MONGODB_TEST_URI bằng MONGODB_URI của tiến trình. Cần xác nhận test write bằng MONGODB_TEST_ALLOW_WRITE=isolated-tests. Không dùng URI hardcoded; không đưa URI vào Git, chat hoặc báo cáo.

Bạn tự điền biến môi trường của terminal:

```powershell
# Điền URI của server test riêng trong cấu hình môi trường bạn đang dùng.
# Không dùng URI production. Không lưu giá trị thật vào tài liệu.
$env:MONGODB_TEST_URI = '<URI test riêng do bạn tự điền>'
$env:MONGODB_TEST_ALLOW_WRITE = 'isolated-tests'
npm run test:integration
Remove-Item Env:MONGODB_TEST_URI
Remove-Item Env:MONGODB_TEST_ALLOW_WRITE
```

Lệnh có thể lưu lại trong shell history, nên ưu tiên dùng cơ chế secret/environment của công cụ của bạn để tự nhập URI. Các biến test không phải cấu hình chạy ứng dụng; runtime ứng dụng vẫn đọc .env như trước, không đọc .env.example.

Runner sinh tên database mới `studypdf_test_<32 hex ngẫu nhiên>`; chỉ tạo users/sessions/auth_rate_limits trong database đó. Client cần quyền createIndex/CRUD/dropDatabase trên các database test được sinh. Cuối run, chỉ drop đúng database ngẫu nhiên được tạo cho lần đó, có kiểm tra tên. Không đụng database do URI mặc định chọn hoặc database ứng dụng. Nếu process bị kill đột ngột, có thể còn database test cần người quản trị tự xem xét xóa.

Không cấu hình URI: runner SKIP với thông báo NOT RUN, không phải PASS integration. Có URI nhưng thiếu write opt-in: FAIL trước khi kết nối. Các lỗi driver được ẩn để tránh in chi tiết kết nối.

## Phạm vi

- Index tạo lại idempotent; unique email/tokenHash; TTL expiry và userId/createdAt.
- User create/duplicate/read/update profile; không plaintext password.
- Argon2id password update/verify.
- Session tồn tại khi dùng MongoClient/pool/repository mới (mô phỏng tiến trình khởi động lại; chưa restart server database).
- Expiry được kiểm tra trong code, không đợi TTL background.
- List/revoke session theo user, chống thao tác IDOR; logout-others.
- Hai cập nhật password cạnh tranh chỉ một compare-and-swap thành công.
- Session generation cũ bị từ chối, kể cả session được insert trễ sau cập nhật password.
- Logout-all tăng sessionVersion; user khác không bị ảnh hưởng.

HTTP API/CSRF/rate limit/body validation và frontend được kiểm bằng bộ test fake cùng QA browser, không coi repository integration là end-to-end HTTP Mongo.

## Trạng thái ngày 04/11/2026

NOT RUN — chưa có MongoDB test server/URI riêng được cấu hình. Runner đã chạy và báo 1 SKIP; không kết nối database ứng dụng.

Secure cookie qua HTTPS staging: MANUAL TEST REQUIRED; chưa có staging, không tự triển khai.

Benchmark bounded local: `npm run benchmark:auth`; chỉ dữ liệu giả, không DB. Concurrency tối đa 2, cấu hình 64 MiB/lần, t=3,p=1; không giảm mức hash để làm đẹp kết quả.

## Bổ sung Day 11

Cùng `npm run test:integration` chạy thêm user-quota-mongo.test.mjs: indexes user quota/attempt TTL, atomic quota increment dưới 30 request cạnh tranh, A/B riêng, reset UTC, persistence khi tạo pool mới, shared lease guard nhiều instance/reclaim/release, live Mongo session gating HTTP AI, expiry/revoke/DB-error path. Không gọi Gemini thật. Giữ nguyên test-server/write-opt-in/namespace/drop guard trên. Hiện 2 suite SKIP (NOT RUN), không phải Mongo integration PASS.
