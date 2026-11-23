# DAY 10 STATUS — 04/11/2026

Chỉ triển khai trong working tree hiện tại. Không branch/commit/push/deploy; không sửa .env thật, không kết nối DB ứng dụng để test. Day 9 vẫn là thay đổi chưa commit và được giữ nguyên cùng các bổ sung Day 10.

## PROFILE

- View: GET /api/users/me, public id/email/displayName/createdAt/updatedAt.
- Update: PATCH chỉ displayName; session xác định user, không nhận userId.
- Validation: Unicode, trim, 1–80 ký tự, chặn control chars; mọi field ngoài whitelist bị 400, không mass assignment. Email read-only.
- Browser fake: lưu “Nguyễn Day 10”, header đổi ngay không reload PASS.

## PASSWORD

- Argon2id: tái sử dụng Day 9, m=65536 KiB,t=3,p=1, salt mới do thư viện tạo.
- Verify old password: bắt buộc, đúng/sai được automated test.
- Change password: POST /api/auth/change-password; 8–128 ký tự, từ chối mật khẩu trùng; không log/persist plaintext ngoài form/request tạm thời.
- Session revocation: chọn thu hồi tất cả, gồm hiện tại; clear cookie và UI, yêu cầu đăng nhập lại. Frontend xóa nội dung form khi thành công.
- Atomicity: passwordHash + sessionVersion thay đổi trong một Mongo update, filter expected hash+version. Không cache auth. Login đã verify trước rotation nhưng insert session trễ vẫn có version cũ nên bị từ chối.

## SESSIONS

- List: GET /api/auth/sessions, tối đa 100 phiên còn hiệu lực, luôn gồm current. Chỉ id/createdAt/expiresAt/isCurrent. Không tokenHash/raw token/IP/User-Agent.
- Revoke one: DELETE /api/auth/sessions/:id, filter _id+userId tại repository; khác chủ sở hữu/không tồn tại/ID lỗi đều 404. Nếu là current, clear cookie và frontend logout.
- Logout others: POST /api/auth/logout-others, giữ current; UI xác nhận trước thao tác nhiều phiên.
- Logout all: POST /api/auth/logout-all yêu cầu currentPassword, rate limit riêng; tăng generation, clear cookie, đóng account UI.
- Expiration: expiresAt kiểm tra tại mỗi resolve, không đợi TTL.
- User isolation: test A không list/delete phiên B; thu hồi A không ảnh hưởng B.
- Legacy: version thiếu =0, không migrate/xóa user/session cũ. Generation cũ bị từ chối nhưng document có thể còn tới TTL.
- Frontend: protected API trả 401 thì clear user/đóng account; lỗi mạng/503 không giả logout thành công. Me được refresh khi focus/visible và mỗi 60 giây khi visible.

## SECURITY

- CSRF: Origin allowlist + JSON cho POST/PATCH/DELETE, body tối đa 8 KiB. Không dựa riêng SameSite.
- IDOR: thao tác session scoped theo user của cookie, không chọn user từ body.
- Mass assignment: reject field ngoài displayName.
- Rate limit: change-password/logout-all 5/user/action/15 phút và 20/IP/action; dùng Mongo counters, global 200/15 phút và semaphore 2 dùng chung login/register. Không quota Gemini.
- Sensitive exposure: public mapping whitelist, lỗi DB chung 503, no-store, nosniff, CORS allowlist credentials không wildcard; frontend không có auth token trong storage/state.
- Liên quan Day 9 đã cải thiện: resolve session tập trung và generation checks; dummy hash lazy trong request để tránh promise startup không được xử lý; AuthProvider chặn refresh/submit cũ ghi đè kết quả mới, cập nhật tên không phục hồi user đã logout.

## DATABASE INTEGRATION

- Indexes: giữ unique email/tokenHash + TTL sessions/auth counters; thêm userId/createdAt cho sessions. Hàm createIndex idempotent; không tạo tên/index trùng.
- CRUD / expiry / new-client persistence / revocation / isolation / competing CAS: đã viết trong tests/integration/auth-mongo.test.mjs.
- Thực chạy MongoDB: **NOT RUN**. npm run test:integration chạy runner và báo 1 SKIP vì chưa MONGODB_TEST_URI; không coi SKIP là integration PASS.
- Guard: chỉ MONGODB_TEST_URI riêng, write opt-in; không fallback URI ứng dụng; DB test tên ngẫu nhiên mới, chỉ drop đúng DB test khi cleanup. Không hardcode URI, không in driver connection details.
- Cách chạy: docs/ACCOUNT_INTEGRATION_TESTS.md. Không tự tạo/cấu hình test server hoặc dùng production.

## PERFORMANCE

Máy hiện tại Windows, Node v22.23.2. Benchmark không DB/không mật khẩu thật, không giảm cấu hình Argon2.

| Phép đo | Kết quả |
|---|---:|
| Hash trung bình, 3 mẫu tuần tự | 107.97 ms |
| Verify trung bình, 3 mẫu tuần tự | 108.57 ms |
| Cặp 2 hash đồng thời, trung bình 2 batch | 116.28 ms/cặp |
| Hash memory configuration | 64 MiB/lần |
| Concurrency được thử | 2 |

Khoảng 128 MiB hash memory cấu hình khi hai tác vụ hash đồng thời, chưa tính overhead Node và không phải peak RSS đo được. Phù hợp kiểm thử local hiện tại; staging phải đo trên tài nguyên thật và HTTPS, không suy ra năng lực production hay số user từ benchmark này. Lệnh npm run benchmark:auth.

## REGRESSION

- PDF: browser mở/render Test Case 2, chuyển trang 1→2 và zoom sau quản lý tài khoản PASS.
- Gemini/streaming/error/Stop/Retry/Markdown/KaTeX/selection-context/IndexedDB/chat/history/quota/Day9 auth: toàn bộ bộ test hiện có PASS, không sửa AI_ACCESS_TOKEN/Gemini/prompt/SSE/quota hay code dữ liệu học tập.
- Không gọi Gemini thật trong Day 10; không chạy lại mọi luồng PDF/AI bằng tay. Không tự tuyên bố kiểm thử end-to-end Gemini provider.
- Browser fake: register, profile view/name update, logout-others confirmation/cancel, logout-all reauthentication + clear UI/reload, login lại PASS. Password đổi/thu hồi nhiều session/IDOR được kiểm qua HTTP automated fake.
- Ảnh: DAY_10_ACCOUNT_PREVIEW.png và DAY_10_SESSIONS_PREVIEW.png, đều dữ liệu giả ở origin QA riêng 5181.

## TEST RESULTS

- npm test: PASS 92/92.
- npm run lint: PASS.
- npm run build: PASS frontend/backend typecheck và bundle; cảnh báo JS >500 KiB vẫn còn (~1.312 MB minified).
- npm run check:secrets: PASS.
- git diff --check: PASS.
- npm audit: 12 moderate ở nhánh ESLint/typescript-eslint/minimatch, 0 high/critical. Không audit fix --force và không tuyên bố audit sạch.
- npm audit --omit=dev: 0 vulnerabilities.
- npm run test:integration: runner chạy, 1 SKIP → Mongo integration NOT RUN.
- Secure cookie qua HTTPS staging: **MANUAL TEST REQUIRED**, chưa staging và không tự deploy.

## FILES CHANGED TRONG DAY 10

- backend/src/auth/repository.ts: profile/password/version/session query và index.
- backend/src/auth/security.ts (mới): validation, JSON, session resolve, rate/concurrency dùng chung.
- backend/src/auth/management.ts (mới): profile và session/password endpoints.
- backend/src/auth/handler.ts: auth/security reuse, versioned login.
- backend/src/app.ts: route /api/users, credential CORS và PATCH/DELETE.
- shared/types/account.ts: profile/session public contracts.
- src/services/account.ts (mới): credentialed request/error status; load profile/session.
- src/components/Auth/{AccountSettings.tsx (mới),AccountMenu.tsx,AuthProvider.tsx,context.ts}: account UI/state/refresh.
- src/index.css: layout account settings/forms/sessions.
- tests/account-management.test.mjs (mới), tests/helpers/authRepository.mjs: HTTP security/correctness/concurrency fake tests.
- tests/integration/auth-mongo.test.mjs (mới): isolated real Mongo suite (NOT RUN).
- scripts/benchmark-argon2.mjs (mới), package.json: bounded benchmark và test:integration/benchmark:auth commands.
- README.md, backend/README.md, docs/ACCOUNT_INTEGRATION_TESTS.md, docs/DAY_10_STATUS.md và 2 ảnh QA.
- Không thêm dependency/framework mới Day 10; argon2 của Day 9 giữ nguyên.

## KNOWN LIMITATIONS

- Chưa Mongo integration thực chạy và chưa HTTPS Secure-cookie staging; không có production deployment.
- Session list tối đa 100, chưa pagination/lastUsedAt hay thông tin thiết bị. Không thu thập fingerprint.
- Logout-others thu hồi các session tồn tại tại DB deletion; login hoàn tất sau đó có thể tạo phiên mới. Request đã xác thực trước thu hồi có thể hoàn tất, không hủy tác vụ đang chạy. Password/logout-all có generation barrier chống login snapshot cũ.
- Session generation cũ không cần xóa vật lý tức thì, TTL cleanup sau; không được coi document còn trong DB là phiên còn hiệu lực.
- Lỗi mạng sau thao tác có thể mang trạng thái chưa xác nhận; UI không giả thành công và cho tải lại/relogin.
- Các tài khoản chung browser origin/profile vẫn thấy cùng notes/history; logout không xóa IndexedDB. Chưa cloud sync/quota user.
- Chưa verification/OTP/reset email/OAuth/roles/payment. Chưa bảo đảm quyền sở hữu email.
- IP lấy từ socket; reverse proxy có thể gom rate limit. Cần trusted proxy/edge rate policy trước public deployment. Profile/session mutations nhẹ chưa có rate limiter riêng.

## DAY 11 RECOMMENDATIONS

1. Phân vùng IndexedDB theo user và guest, có kế hoạch dữ liệu cũ; không xóa/migrate âm thầm.
2. Thiết kế quota AI theo user, giữ AI key/token ở backend và regression SSE.
3. Người dùng cấu hình MongoDB test server riêng rồi chạy integration; kiểm tra HTTPS cookie ở staging khi có môi trường.
4. Đánh giá trusted proxy, rate limits và Argon2 trên server thật trước public deployment.

## FINAL VERDICT

**COMPLETE WITH LIMITATIONS** — MVP Day 10 triển khai và automated/browser fake checks đạt; Mongo integration NOT RUN và HTTPS staging MANUAL TEST REQUIRED được ghi rõ.

## Tham khảo

- MongoDB atomic writes/CAS: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
- OWASP Authentication: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
