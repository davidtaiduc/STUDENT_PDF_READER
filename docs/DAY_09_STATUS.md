# DAY 9 — USER AUTHENTICATION

Ngày 04/11/2026. Chỉ thay đổi working tree, không branch/commit/push/deploy, không sửa .env và không tạo tài khoản trong MongoDB thật.

## AUTH

- Register: triển khai, test HTTP và browser fake PASS; email chuẩn hóa, unique constraint chống race.
- Login: triển khai, test đúng/sai/email không tồn tại PASS; lỗi chung, dummy hash.
- Logout: triển khai, test thu hồi cookie/session, gọi lặp và reload PASS.
- Auth Me: triển khai, session hợp lệ/không có/hết hạn/thu hồi PASS với fake repository.
- Session persistence: browser reload giữ phiên PASS (cookie thật trong browser, repository in-memory cho QA).

## PASSWORD SECURITY

- Algorithm: argon2@0.45.2, Argon2id m=65536 KiB, t=3, p=1.
- Salt: thư viện sinh ngẫu nhiên; hai hash cùng password khác nhau, test PASS.
- Hash verification: argon2.verify đúng/sai PASS. Native package cài và chạy được trên Windows/Node hiện tại.
- Plaintext storage: không có trường password trong user/session; test PASS.
- PasswordHash exposure: public response whitelist id/email/displayName; test PASS. Không log password/hash/token.
- Policy: 8–128 UTF-16 code units, không trim password; Unicode được hỗ trợ. Tối đa 2 hash/verify đồng thời mỗi instance (dummy hash khởi tạo riêng lúc startup). Chưa benchmark tải production; không suy ra số user từ test unit.

## SESSION SECURITY

- HttpOnly: có. Secure: bật khi NODE_ENV=production hoặc backend không có --development; unit test cookie PASS, chưa thử HTTPS browser thật.
- SameSite=Lax, Path=/, host-only, Max-Age=604800.
- Session expiration: kiểm tra expiresAt > now trước khi xác thực; TTL chỉ cleanup.
- Session revocation: logout xóa DB; login/register rotate token và thu hồi token cũ đang có trong browser.
- Token hash storage: SHA-256 của randomBytes(32), token raw chỉ qua cookie; không auth token trong localStorage/sessionStorage/IndexedDB/React state.

## DATABASE

- users: ObjectId, email, displayName, passwordHash, createdAt, updatedAt; unique email.
- sessions: ObjectId, userId, tokenHash, createdAt, expiresAt; unique tokenHash, TTL expiresAt.
- auth_rate_limits: atomic counter và TTL, dùng consumeCounter chung với quota nhưng collection/key/policy riêng.
- Index startup được nối vào createDatabase.connect; test lời gọi createIndex PASS. Chưa chạy tạo index hoặc CRUD trên MongoDB thật; dùng DI/fake, không dữ liệu production.

## FRONTEND

- Register UI: tên/email/password/confirm, validation, label, loading, khóa submit trùng, dialog hỗ trợ Escape/focus/modal.
- Login UI: email/password, lỗi chung, giữ nội dung khi lỗi, không persist password.
- Auth state: AuthProvider/useAuth, GET me khi khởi động, checking/ready/unavailable; lỗi mạng không chủ động xóa user đang có. Auth fetch credentials include, timeout 15 giây.
- Account menu: tên/email/logout và cảnh báo lịch sử vẫn local. Đã kiểm tra browser ở viewport hẹp; sửa menu không tràn mép. Ảnh DAY_09_ACCOUNT_PREVIEW.png.

## SECURITY

- CSRF: POST yêu cầu Origin chính xác trong allowlist (kể cả logout), thiếu Origin bị 403, JSON Content-Type bắt buộc. Body auth tối đa 8 KiB. Không dựa riêng SameSite.
- Rate limit: cửa sổ 15 phút; register 5/IP,3/email; login 20/IP,10/email; global 200 request cần hash/15 phút. Mongo counters tồn tại qua restart và chia sẻ nhiều instance, lỗi DB fail closed. Local concurrency 2 chỉ là lớp bổ sung.
- Không tin X-Forwarded-For; sau proxy có thể chung IP/rate limit, cần trusted-proxy design trước production. Counter dùng hash email/IP. Không lockout vĩnh viễn.
- CORS: echo origin allowlist; auth Allow-Credentials true, không wildcard. No-store và nosniff giữ nguyên.
- Sensitive logging: không thêm log credential, DB error được chuyển 503 chung.
- AI_ACCESS_TOKEN, Gemini prompt/key, SSE và quota hiện tại giữ nguyên. Cookie user không thay thế token ứng dụng; đăng nhập không tự cho browser quyền gọi AI trực tiếp. Proxy dev vẫn chỉ dùng loopback.

## REGRESSION

- Browser: PDF Test Case 2 mở và render; chuyển trang 1→2 và zoom 50→60% PASS sau đăng nhập. Register/login/logout/reload với repository giả PASS.
- Automated: 85/85 gồm AI HTTP/SSE, provider error/cooldown, Markdown/KaTeX security, text/context/selection, chat/archive/rename/IndexedDB, quota, local proxy authorization và auth mới PASS.
- Không chạy lại toàn bộ thao tác PDF/AI/Stop/Retry bằng tay; không gọi Gemini thật trong Day 9. Không thay code PDF/notes/history hoặc migrate/xóa IndexedDB.

## TEST RESULTS

- npm test: PASS 85/85.
- npm run lint: PASS.
- npm run build: PASS frontend/backend typecheck + bundle; cảnh báo bundle JS >500 KiB vẫn còn (~1.303 MB minified).
- npm run check:secrets: PASS.
- git diff --check: PASS.
- npm audit: 12 moderate ở nhánh ESLint/typescript-eslint/minimatch, 0 high/critical; không tuyên bố audit sạch. Không audit fix --force.
- npm audit --omit=dev: 0 vulnerabilities.

## FILES CHANGED

- backend/src/auth/{password,repository,handler,session}.ts: Argon2id, Mongo repository/indexes, auth API, session cookie/hash primitives.
- backend/src/{app,index}.ts, backend/src/database/mongo.ts: auth routing/runtime/startup indexes, health accounts enabled.
- shared/types/{account,backend}.ts: public account và health contracts.
- src/services/{auth,backend}.ts: auth fetch và health boolean contract.
- src/components/Auth/{context.ts,AuthProvider.tsx,AccountMenu.tsx}: shared auth state và account UI.
- src/{App.tsx,main.tsx,index.css}: tích hợp tài khoản, responsive.
- tests/{auth,session}.test.mjs, tests/helpers/authRepository.mjs: HTTP/hash/session/security tests và fake repository.
- package.json/package-lock.json: argon2 và dependency transitives.
- README.md, backend/README.md, docs/DAY_09_STATUS.md, docs/DAY_09_ACCOUNT_PREVIEW.png.
- tmp/day9-* là file QA bị Git ignore, không cấu hình chạy thật.

## PACKAGES ADDED

argon2 ^0.45.2. Không thêm framework test.

## KNOWN LIMITATIONS

- Chưa kiểm thử integration MongoDB test thật hoặc Secure cookie qua HTTPS thật; các chứng minh HTTP/browser dùng fake repository. Không tự coi index đã tồn tại trên DB thật.
- Chưa benchmark Argon2/đa instance/rate limit tải cao. Chưa cấu hình public deploy/trusted proxy; giữ backend local.
- Đăng ký thành công nhưng ghi session lỗi có thể để lại user hợp lệ; đăng nhập lại được, không giả định Mongo transaction hỗ trợ mọi topology.
- Chưa email verification/reset password/Google/OAuth/admin/roles/payment. Email đăng ký chưa chứng minh quyền sở hữu.
- Sessions chỉ thu hồi thiết bị hiện tại, chưa có quản lý đăng xuất mọi thiết bị.
- Local history/notes chung origin/profile giữa mọi tài khoản; logout không xóa. UI đã báo; chưa account-scoped storage/cloud sync.
- AI vẫn dùng danh tính ứng dụng/quota hiện có; cookie tài khoản không cấp quyền truy cập AI trực tiếp. Day 11 mới thiết kế quota user.

## DAY 10 RECOMMENDATIONS

1. User kiểm thử trên local với tài khoản tự nhập. Chuẩn bị DB test riêng để chạy integration indexes/CRUD/session expiry/revoke và restart persistence.
2. QA desktop/mobile và HTTPS trên staging riêng khi có hosting, đo chi phí Argon2/concurrency thực tế.
3. Thiết kế email verification/password reset cho giai đoạn tiếp theo, chưa triển khai tự động.
4. Day 11: phân vùng IndexedDB theo user/guest với kế hoạch dữ liệu cũ, quota theo user và chính sách phiên.

## FINAL VERDICT

COMPLETE WITH LIMITATIONS — đã triển khai MVP và xác minh bằng fake-based automated/browser tests; còn integration DB thật, HTTPS và load QA như ghi trên.

## Tham khảo chính thức

- node-argon2: https://github.com/ranisalt/node-argon2
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
