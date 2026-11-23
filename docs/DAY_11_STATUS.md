# DAY 11 STATUS — 04/11/2026

Triển khai trực tiếp trên working tree hiện tại, giữ các thay đổi Day 9/10 chưa commit. Không branch/commit/push/deploy, không đổi .env thật, không kết nối MongoDB ứng dụng để test.

## INDEXEDDB ISOLATION

- Guest: scope guest, ghi chú thủ công có CRUD và vùng chat/history riêng. Guest không gọi Gemini.
- User A/B: scope user:<authenticated ObjectId>; scoped composite keys ở cả notes/documents/chat. Storage API yêu cầu scope, update/delete kiểm tra cả scope và document/record.
- Account switching: keyed sidebar clear UI và abort stream; PDF vẫn mở, không đổi SHA-256. Đăng xuất không xóa database. BroadcastChannel chỉ gửi signal để server revalidate; không gửi token hay nhận client userId làm bằng chứng.
- Async safety: data callbacks guard active/mounted, captured scope và owner-keyed component; load/autosave cũ chỉ truy cập namespace cũ. Checking/unavailable không phải guest; UI che dữ liệu chờ xác nhận. Background poll 60 giây, focus/visible revalidate có khóa scope.
- Legacy preservation: DB v1 stores/records giữ nguyên; upgrade v2 chỉ thêm scoped stores/indexes/import marker. Không source deletion hay auto assignment.
- Migration policy: API guest-only cần xác nhận, atomic từng DB, marker idempotent, add không overwrite, conflict abort; retry giữ nguồn. **UI import chưa triển khai**; người dùng cần chủ động review/backup/thao tác theo docs/DAY_11_DATA_MIGRATION.md.
- Privacy: logical isolation, không mã hóa/bảo mật tuyệt đối trước người có browser profile/DevTools hoặc JS độc hại cùng origin.

## AI QUOTA

- Per-user identity: ObjectId từ live session sau expiry/generation/revocation checks, không từ body/header/query/email.
- Daily limit: USER_DAILY_REQUEST_LIMIT default30, áp dụng cả dev local. Đã bỏ quotaPolicy dev-unlimited cũ.
- Minute limit: USER_MINUTE_REQUEST_LIMIT default5; attempt spam guard USER_AI_ATTEMPTS_PER_MINUTE default30, không dùng quota Gemini làm guard duy nhất.
- Atomic updates: ai_user_usage_v1, _id=userId và unique userId; một conditional pipeline update cả day/minute counter hoặc không counter nào. Không read-then-increment, không yêu cầu multi-document transaction.
- UTC reset: bucket UTC trên server, resetAt là mốc 00:00 UTC tiếp theo (07:00 GMT+7). Restart không reset quota.
- Quota API: GET /api/usage/me, session-only principal, public dailyLimit/dailyUsed/dailyRemaining/resetAt/minuteLimit. Query tùy ý userId không được dùng để chọn account.
- UI display: loading/error/exhausted/refresh, quota owner mới bắt đầu loading riêng; lỗi mạng không dùng used=0. Refresh khi SSE meta và request kết thúc.
- Charge policy: một lượt sau validation/auth và acquire slot, trước SSE meta/provider. Reject/auth/validation/slot full/quota hết không charge. Stop/provider lỗi sau chấp nhận vẫn charge; retry là request mới; không refund, không client idempotency.

## AI SECURITY

- Session verification: user cần session thật, expired/revoked/guest bị từ chối trước provider/quota.
- Internal token: giữ AI_ACCESS_TOKEN ở backend/Vite proxy loopback; bearer một mình không bypass session/quota. AI/access yêu cầu cả internal auth và user, usage chỉ cần user.
- Gemini key protection: không thay Gemini key/model/prompt; không secret trong bundle hoặc JSON.
- CSRF/CORS: POST AI bắt buộc Origin allowlist + JSON; credentials include, no wildcard. Giữ cookie HttpOnly/Secure/SameSite/Path của Day9/10, no-store/nosniff.
- SSE: giữ meta/text/done/error, không buffer toàn bộ; automated first-frame-before-completion PASS.
- Stop/Retry: abort/cancel provider và release slot, accepted stop tính1, retry tính lượt mới; HTTP fake automated PASS.
- Concurrency: ai_runtime_v1 shared Mongo lease guard MAX_CONCURRENT_REQUESTS default3 cho cùng DB/config, deadline180s/lease210s/release finally. Process active guard chỉ bổ sung. Crash có thể giữ slot tới210s, cần đồng hồ đồng bộ. Không giả RAM counter là global.

## DATABASE INTEGRATION

- Test DB: **NOT RUN**, chưa MONGODB_TEST_URI riêng. npm run test:integration chạy và báo **2 SKIP**, không phải integration PASS.
- Indexes: chuẩn bị unique user quota userId, attempt TTL; shared lease dùng unique _id mặc định, không TTL drop cả lease document. Legacy global gemini_usage_v1 giữ nguyên, không dùng để tính quota mới.
- Concurrent quota: integration suite chuẩn bị 30 request cạnh tranh, unique violation, A/B, UTC, fresh-pool persistence; pipeline expression unit evaluator PASS nhưng không thay thế Mongo thật.
- Session expiry/revoke: HTTP fake PASS; live-Mongo session gate suite đã viết, NOT RUN.
- Persistence: fake service/repository recreation và fresh IndexedDB module PASS; new Mongo client suite NOT RUN.
- Driver failures: fail closed, response không raw connection details. Test cleanup chỉ generated studypdf_test_<32 hex>; không production URI fallback.

## PRODUCTION READINESS

- Trusted proxy: chưa bật trust proxy; vẫn socket IP, không tin X-Forwarded-For/forwarded host/proto từ client. Cần trusted web gateway/HTTPS đúng topology, không expose Vite dev proxy hay internal bearer.
- Distributed rate limits: auth và AI attempts/quota Mongo; shared leases Mongo. Require same DB/config và clock sync. Usage/profile read edge limits chưa triển khai; email chưa verify nên chưa chống multi-account abuse/cost budget toàn project.
- Argon2 concurrency: giữ m65536 KiB/t3/p1, cap2 expensive operations/process + Mongo auth budgets. Benchmark bounded Day11 trên Windows Node22.23.2: hash mean98.42ms, verify98.46ms (3 samples), pair of2 hashes118.82ms (2 batches). Khoảng128MiB configured hash memory cho cap2, không phải RSS đo được; chưa load test/staging sizing.
- HTTPS cookie test: **MANUAL TEST REQUIRED**, chưa staging, không tự deploy.

## REGRESSION

- PDF: browser mở/render Test Case2, selection, page1→2, zoom107→120%, ghi chú vẫn giữ. PDF bytes không gửi backend, hash không đổi.
- AI: backend SSE + provider-error policy, quota exhaustion, concurrent A/B, abort và retry automated PASS; **không gọi Gemini thật trong Day11**.
- Notes: browser guest/A/B tạo notes riêng, logout khôi phục guest, login A khôi phục note A; sửa lỗi mất selected excerpt khi focus sang textarea.
- History: browser A/B có archive riêng, login A và reload/open PDF khôi phục archive/draft A, không thấy B/guest. Dịch/Giải thích vẫn temporary, notes nằm tab riêng.
- Account/session: bộ regression Day9/10 PASS. Quota không làm đổi Argon2 hoặc session architecture.

## MANUAL BROWSER CHECKLIST

QA origin riêng 127.0.0.1:5181, fake auth/usage repositories và fake provider, không keys/DB thật. Fixture quota2/day để thử hết lượt; runtime default30 không bị thay.

| Trường hợp | Thực chạy |
|---|---|
| Guest tạo/lưu note | PASS |
| Guest history riêng | Storage automated PASS; UI guest history rỗng, không tạo AI chat khi guest |
| Guest→A, A không thấy guest | PASS |
| A tạo note/chat/archive | PASS |
| A logout, A data biến mất, guest note trở lại | PASS |
| B không thấy A, B tạo note/chat/archive | PASS |
| B→logout→A, khôi phục note/history A | PASS |
| Reload login A rồi mở lại cùng PDF | PASS |
| Backend offline khi khôi phục session | PASS, sidebar khóa, không guest/quota0 giả |
| Legacy records profile thật | NOT RUN; schema1→2/source preservation có automated fake-indexeddb PASS |
| A/B gọi AI/quota độc lập | Browser fake PASS, không live Gemini/Mongo |
| Hết quota bị backend chặn | Browser fake PASS, count vẫn2 |
| Stop/Retry/concurrent A/B | Automated HTTP fake PASS; không lặp đủ thao tác thủ công |
| Session expiry/revocation | Automated HTTP fake PASS, live-Mongo suite NOT RUN |
| Không thấy dữ liệu sai user khi chuyển | Quan sát browser PASS và keyed state/code guards; không có phép đo mọi frame flash |

Ảnh: DAY_11_QUOTA_PREVIEW.png, DAY_11_ISOLATION_PREVIEW.png, DAY_11_OFFLINE_PREVIEW.png. Browser test chỉ origin QA, không đọc/sửa legacy IndexedDB thật tại origin ứng dụng5173.

## TEST RESULTS

- npm test: **PASS 104/104**.
- npm run lint: PASS.
- npm run build: PASS frontend/backend typecheck + Vite; còn warning JS>500KiB (~1.320MB minified).
- npm run check:secrets: PASS.
- git diff --check: PASS.
- npm audit: 12 moderate thuộc nhánh công cụ ESLint/typescript-eslint/minimatch, 0 high/critical; không nói audit sạch, không audit fix --force.
- npm audit --omit=dev: 0 vulnerabilities.
- MongoDB integration: **NOT RUN**, runner2SKIP.
- Argon2 bounded benchmark: đã chạy, kết quả phía trên.

## FILES CHANGED TRONG DAY 11

- backend/src/{app.ts,index.ts,database/mongo.ts}: session principal cho AI/usage, CSRF, quota/spam/lease wiring, startup indexes, health limited.
- backend/src/services/usage/{userQuota.ts,slots.ts,attempts.ts} mới; quota.ts giữ counter auth nhưng bỏ global quota helper cũ; quotaPolicy.ts dev-unlimited bị gỡ.
- shared/types/usage.ts mới; .env.example thêm user limit defaults, không sửa .env thật.
- src/services/storage/{ownerScope.ts,legacy.ts} mới; studyStore.ts/chatStore.ts scoped v2 CRUD.
- src/components/Auth/{useOwnerScope.ts mới,AuthProvider.tsx,AccountMenu.tsx,AccountSettings.tsx}: scope và auth revalidation, thay thông báo privacy cũ.
- src/components/Study/{StudySidebar.tsx,NotesPanel.tsx mới}: scoped remount, note CRUD.
- src/components/PdfViewer/PdfViewer.tsx: private metadata theo scope, selection reset theo owner.
- src/components/AiPanel/{ChatPanel.tsx,SelectionAssistant.tsx,UsageStatus.tsx mới}, src/services/ai/gemini.ts: scope, guest guard, quota UI/events, credentials include, abort/refresh.
- src/index.css: compact quota và notes form.
- tests/{owner-storage,user-quota}.test.mjs mới; tests/helpers/{userUsage,pipelineDatabase}.mjs mới; tests/integration/user-quota-mongo.test.mjs mới.
- Existing indexeddb/chat/backend/gemini/error/quota-policy tests cập nhật contract bắt buộc scope/session/Origin.
- README.md, backend/README.md, ACCOUNT_INTEGRATION_TESTS.md, DAY_11_{STATUS,DATA_MIGRATION,SECURITY_REVIEW}.md và 3 ảnh QA.
- Không dependency/framework mới Day11; không commit/push hoặc release ZIP mới.

## KNOWN LIMITATIONS

Mongo integration thật NOT RUN; HTTPS staging MANUAL TEST REQUIRED; chưa multi-instance/load/cost test. Legacy import chỉ API, chưa UI; giữ source và không tự import. Unsaved note draft có thể mất khi scope revalidation dựng lại; chat snapshot crash window500ms vẫn có. IndexedDB không mã hóa; không cloud sync. Chưa có email verification/reset/OAuth, guest→user transfer, per-project spend guard hoặc public deployment. Request đã được xác thực/chấp nhận có thể hoàn tất sau khi phiên bị thu hồi; quota retry không idempotent trên các request mới. Đồng hồ/concurrency lease và trusted-proxy yêu cầu được ghi ở security review.

## DAY 12 RECOMMENDATIONS

1. Người dùng cấu hình MongoDB test server riêng để chạy integration và kiểm tra điều kiện replica/standalone thực tế.
2. UI legacy preview/import có xác nhận/backup và kế hoạch guest→user có chủ đích, không tự chuyển dữ liệu.
3. Theo yêu cầu sản phẩm, thiết kế verification/reset và chống multi-account abuse/spend budget, chưa triển khai tự động.
4. QA HTTPS và trusted gateway khi có staging; đo tải/quota/concurrency trên server thật trước public deploy.

## FINAL VERDICT

**COMPLETE WITH LIMITATIONS** — implementation và104 automated checks/browser fake QA đạt; các kiểm tra Mongo thật/HTTPS và UI import còn thiếu được ghi rõ.
