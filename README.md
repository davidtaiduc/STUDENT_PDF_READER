# StudyPDF AI / Student PDF Reader

Ứng dụng đọc PDF trên trình duyệt, chọn đoạn/trang và trao đổi với Gemini qua backend Node.js. Giao diện trung tính, điểm nhấn vàng cho đoạn chọn và nút gửi; PDF bên trái và chat AI bên phải, có thanh kéo điều chỉnh chiều rộng.

**Trạng thái hiện tại: 24/11/2026. Đăng nhập bắt buộc ở mọi đường vào trình đọc; có xóa tài khoản và dữ liệu, gateway production, quota chung và trang quyền riêng tư/điều khoản. Thư viện PDF/chat có sao lưu, đồng bộ tài khoản qua GridFS và OCR cục bộ. Ghi chú và API lịch sử cũ vẫn được gỡ.** Các báo cáo Day 9–11, CLOUD_EMAIL, PAGE_BASED_AI và CONVERSATIONS trong docs là lịch sử phát triển, không phải mô tả toàn bộ chức năng hiện tại. Khi tiếp quản, đọc AGENTS.md rồi xác nhận trong mã.

## Chức năng còn giữ

- Mở PDF local, render một trang, chuyển trang bằng nút hoặc nhập số trang, zoom/vừa chiều rộng, kéo/thu gọn hai khung.
- Thư viện lưu bản PDF trong IndexedDB `studypdf-library`, tách theo tài khoản/khách. Bấm tên PDF mở file đã lưu và tạo chat mới; mở rộng thư mục để chọn chat cũ. Chat trống không tạo mục lịch sử. PDF/chat tự động đồng bộ lên MongoDB theo tài khoản.
- Ba phạm vi AI: đoạn tô đen, trang hiện tại, nhóm trang tự chọn. Trang/nhóm trang cần Chuẩn bị ngữ cảnh, xem trước rồi Gửi. Dịch/Giải thích trên đoạn tô đen hiển thị trong chat AI.
- Chat nhiều lượt tự lưu cục bộ, stream, dừng/thử lại và sao chép. Mở rộng mục PDF để mở tiếp chat cũ; bấm tên PDF hoặc Đoạn chat mới để bắt đầu hội thoại trống. Đổi trang/zoom giữ nguyên tin nhắn.
- Đăng ký/đăng nhập, Argon2id, cookie session, đổi tên/mật khẩu, quản lý và thu hồi phiên.
- Xác minh email và đặt lại mật khẩu dùng Resend; link có hạn, một lần sử dụng. Reset thu hồi mọi phiên đăng nhập.
- Quota mặc định 30 lượt/user/ngày UTC và 5 lượt/phút; lease MongoDB điều phối slot AI giữa các instance.

## Đã xóa khỏi mã chạy

Giao diện ghi chú, archive/import/sync cũ, lưu/khôi phục vị trí đọc và các API `/api/study/*` đã gỡ. Thư viện mới dùng SHA-256 nhận diện PDF và lưu chat vào một database IndexedDB riêng; không khôi phục kho dữ liệu cũ. Backend không còn khởi tạo index hoặc truy cập collection `study_records`.

**Không xóa dữ liệu MongoDB hoặc IndexedDB cũ.** Dữ liệu trước đây vẫn có thể tồn tại trong database/profile nhưng ứng dụng không còn đọc/ghi chúng. Không thực hiện drop collection, xóa dữ liệu trình duyệt hoặc migration chỉ vì đọc tài liệu này.

## Chạy local

Yêu cầu Node >=22.18.0, npm và MongoDB truy cập được.

```powershell
npm ci
npm run dev
```

Lệnh ở gốc chạy cả backend và frontend. Backend dev dùng Node --watch để tải lại khi mã backend đổi. Sau khi cập nhật script npm hoặc .env, dừng Ctrl+C rồi chạy lại npm run dev. Mặc định frontend http://127.0.0.1:5173 và API http://127.0.0.1:3001.

Runtime đọc **.env thật tại gốc**, không đọc .env.example. Người dùng tự điền thông tin cơ bản/secret. Không tự sửa hoặc in khóa bí mật.

## Cấu hình .env

| Biến | Vai trò |
|---|---|
| GEMINI_API_KEY | Khóa Gemini, chỉ backend |
| GEMINI_MODEL | Model được backend cấu hình |
| MONGODB_URI / MONGODB_DB | Kết nối/database tài khoản, session và quota |
| AI_ACCESS_TOKEN | Credential nội bộ được proxy local thêm phía server, không đưa vào frontend |
| ALLOWED_ORIGINS | Danh sách origin frontend chính xác, cách nhau dấu phẩy |
| HOST / PORT | API host/port; mặc định loopback/3001 |
| USER_DAILY_REQUEST_LIMIT / USER_MINUTE_REQUEST_LIMIT | Quota từng user, mặc định 30/5 |
| MAX_CONCURRENT_REQUESTS | Slot AI dùng chung, mặc định 3 |
| USER_AI_ATTEMPTS_PER_MINUTE | Chống spam trước khi trừ quota |
| MONGODB_DNS_SERVERS | Cấu hình DNS tùy môi trường nếu cần |
| RESEND_API_KEY / MAIL_FROM | Khóa dịch vụ và địa chỉ gửi email |
| APP_PUBLIC_URL | Origin frontend của link email; thuộc ALLOWED_ORIGINS; HTTPS khi online |
| VITE_AI_API_URL | URL API public khi build; local thường để trống; tuyệt đối không đặt secret ở biến VITE_* |

.env.example chỉ là mẫu, các secret phải để trống. Thiếu cấu hình email thì thao tác email báo lỗi nhưng không gỡ chức năng AI/tài khoản khác. Cần dùng địa chỉ gửi được Resend cho phép.

## Luồng dữ liệu và ranh giới AI

1. File PDF -> ArrayBuffer -> PDF.js worker/CMaps/font/WASM local. Tính SHA-256 để lưu PDF/chat trên IndexedDB; tự động tải bản thư viện lên MongoDB theo tài khoản; giữ bản local làm bộ đệm khi mất mạng.
2. Tô đen lấy excerpt và ngữ cảnh gần; trang/nhóm trang chỉ getTextContent cho các trang được user chỉ định. Chuẩn bị ngữ cảnh không gọi provider.
3. Chỉ Gửi/Dịch/Giải thích gọi `/api/ai`. Session hợp lệ + token nội bộ + Origin allowlist + quota/slot phải qua trước khi gọi Gemini.
4. Backend stream SSE meta/text/error/done, không buffer toàn bộ phản hồi.
5. Chat tự lưu vào IndexedDB sau thay đổi; trước khi chuyển PDF/chat sẽ lưu ngay, dừng phản hồi đang chạy và giữ phần đã nhận. Nếu lưu thất bại, hiển thị lỗi và chặn chuyển để tránh mất chat. Mỗi chat có revision để tránh ghi đè giữa các tab. Trường API `history` chỉ là tối đa 6 cặp hỏi/đáp trong phiên, tổng 6.000 ký tự, làm ngữ cảnh cho câu hỏi tiếp; không phải chức năng lưu lịch sử.

Mỗi lượt tối đa 5 trang/12.000 ký tự, câu hỏi 2.000 ký tự. Context trước/sau tối đa 650 ký tự mỗi phía. Không có trần số trang tài liệu theo gói sản phẩm; guard bộ nhớ 150MiB/file, tổng thư viện tối đa 512MiB mỗi tài khoản trên trình duyệt, canvas 16 triệu pixel/mỗi chiều <=8192. Chỉ vẽ trang hiện tại, hủy render và giải phóng canvas cũ.

PDF scan có OCR cục bộ Anh/Việt: chọn trang hoặc nhóm trang, bật Nhận dạng chữ PDF scan rồi Chuẩn bị ngữ cảnh. OCR không gọi Gemini; chỉ chữ đã kiểm tra được gửi khi bấm Gửi. Không RAG/vector DB, tự tóm tắt toàn PDF hay admin dashboard.

## Backend và bảo mật

- `/api/health`, `/api/access`, `/api/usage/me`, `/api/ai`.
- `/api/auth/*` và `/api/users/*`: tài khoản, profile, session, email verification và password recovery.
- `/api/study/*` trả 404; thư viện mới dùng `GET/HEAD/PUT /api/library/archive`, cookie session, Origin và phiên bản ETag. Snapshot gồm PDF/chat lưu bằng GridFS, tách theo user.
- Password Argon2id, session token ngẫu nhiên chỉ lưu hash, cookie HttpOnly/SameSite=Lax; Secure ở production. Kiểm tra sessionVersion để thu hồi mọi phiên khi đổi/reset mật khẩu.
- Mutation kiểm tra Origin/JSON/body size. Không nhận userId client làm danh tính xác thực.
- Email token ngẫu nhiên 32 byte, chỉ hash lưu DB, reset 30 phút/verify 24 giờ; link fragment bỏ khỏi URL khi mở, POST để tiêu thụ. Chưa bắt buộc xác minh email để login/AI.
- MongoDB có users, sessions, auth limits, AI usage/lease; thư viện mới có library_heads_v1 và library_archives_v1.files/chunks. study_records cũ không sử dụng.

## Cấu trúc chính

- src/components/PdfViewer: đọc PDF, điều khiển, splitter, thanh chọn chữ.
- src/components/AiPanel: ReaderAssistant, ChatPanel, chọn ngữ cảnh/hiển thị AI, CopyButton và quota.
- src/components/Auth và src/services/auth/account: tài khoản/email/session.
- src/services/pdf, src/hooks, src/utils: text layer và ngữ cảnh PDF.
- src/services/library/store.ts: PDF Blob, SHA-256, các đoạn chat và revision trong IndexedDB; archive.ts xuất/nhập, cloud.ts đồng bộ snapshot qua API.
- src/services/ownerScope.ts: nhận diện phiên hiện tại, không lưu dữ liệu.
- backend/src/auth: tài khoản, email và chính sách proxy.
- backend/src/services/ai, usage: Gemini, prompts, quota/lease.
- backend/src/database: pool MongoDB và index auth/quota.
- shared/ai và shared/types: hợp đồng AI, context limits/errors/SSE và tài khoản.

Không còn src/components/Study, src/services/storage hoặc backend/src/study trong mã nguồn.

## Kiểm tra và triển khai

```powershell
npm run lint
npm test
npm run build
npm run check:secrets
```

Các test ghi chú/lịch sử đã bỏ cùng tính năng; không so số lượng test mới với mốc 123 cũ để kết luận hồi quy. Giữ kiểm thử auth/email/session/quota/AI/PDF, thêm test các route study đã trả 404. Mongo integration chỉ chạy với MONGODB_TEST_URI riêng và MONGODB_TEST_ALLOW_WRITE=isolated-tests; không dùng DB ứng dụng.

Build sinh dist, không tự khởi động API. OneSite ZIP chỉ phục vụ frontend tĩnh; proxy local thêm credential không nằm trong dist. Triển khai online cần Node runtime, HTTPS và web/API gateway phù hợp. Có CI kiểm tra khi push/PR; chưa có deploy tự động. Không tự đăng ký hosting, push Git hoặc publish.

Mọi thông báo còn nhắc ghi chú/lịch sử trong docs cũ là trạng thái lịch sử. Không khôi phục những phần đã gỡ nếu chưa có yêu cầu mới của người dùng.

Kiểm tra mở rộng thư viện: 101/101 test local, lint/build và kiểm thử GridFS trên database thử riêng đạt. QA giao diện đã chạy OCR trên PDF chỉ có ảnh, tiếp tục AI giả bị ngắt, đổi tên PDF/chat, xóa/khôi phục chat, đồng bộ MongoDB thử, mobile và cập nhật tên giữa hai tab. Không gửi tài liệu người dùng tới Gemini trong QA này.

### Thư viện PDF và chat cục bộ

Bấm tên PDF luôn mở đoạn chat mới, không tự mở chat gần nhất. Mũi tên cạnh PDF mở danh sách “Đoạn chat 1, 2, ...”; chọn một chat để xem và hỏi tiếp. Nút “Đoạn chat mới” giữ chat hiện tại trong thư mục rồi bắt đầu chat trống. PDF cùng nội dung chỉ có một mục dù đổi tên file.

Thư viện có bản cục bộ trong profile trình duyệt và bản trên MongoDB sau khi bấm Đồng bộ tài khoản. Thiết bị khác đăng nhập cùng tài khoản sẽ tự nhận và hợp nhất thay đổi. Có tự đồng bộ nền; không mã hóa đầu cuối. Đăng xuất chỉ tách giao diện theo user, không xóa dữ liệu trên máy. Xóa dữ liệu trang web/chế độ riêng tư hoặc trình duyệt thu hồi dung lượng có thể làm mất thư viện. Backend `/api/study/*` vẫn trả 404. Không đọc/migrate dữ liệu ghi chú/lịch sử cũ.

Mỗi chat trong thư viện có nút ✎ đổi tên (1–100 ký tự) và × xóa với bước xác nhận. Xóa chat đang mở chuyển sang chat mới và giữ PDF. Kho lưu giữ dấu xóa không kèm nội dung để ngăn autosave từ tab cũ khôi phục chat đã xóa.


## Thư viện, sao lưu và đồng bộ (24/11/2026)

- Mỗi PDF/chat có nút đổi tên và xóa; xóa PDF xóa các chat con, file đang đọc được đóng. Thao tác xóa có xác nhận.
- **Sao lưu và đồng bộ → Xuất bản sao lưu** tải file `.studypdf` gồm PDF và chat, không có mật khẩu/API key. File không được mã hóa.
- **Nhập bản sao lưu** kiểm tra cấu trúc, dung lượng và SHA-256 của tất cả PDF trước khi ghi trong một transaction. Có thể khôi phục mục đã xóa. Chat khác nội dung được giữ thêm thành bản khôi phục; nhập lặp cùng bản không nhân bản vô hạn.
- **Đồng bộ tài khoản** tải snapshot máy chủ, hợp nhất, rồi PUT snapshot mới với `If-Match`. Tài khoản khác/phiên hết hạn bị từ chối. `X-Library-Owner` ngăn đổi tài khoản giữa lượt đồng bộ. Xung đột ETag trả 409, giữ dữ liệu local và cho thử lại. Xóa từ thiết bị khác không tự sống lại khi sync; chỉnh sửa đồng thời khác nội dung giữ bản khôi phục. Đồng bộ chạy nền sau đăng nhập và thay đổi thư viện; nút Đồng bộ tài khoản dùng để yêu cầu chạy lại ngay.
- Giới hạn: 150MiB/PDF, tổng PDF 512MiB, manifest tối đa 32MiB, archive tối đa 544MiB, 200 PDF và 2.000 chat/archive. Khách dùng thư viện/sao lưu local; đồng bộ cần đăng nhập.
- OCR dùng Tesseract.js 7, worker/WASM và mô hình eng/vie đóng gói trong public/ocr. Chạy npm ci hoặc npm run predev:frontend để chuẩn bị tài nguyên; build tự copy. OCR chỉ nhận dạng các trang đã chỉ định, có progress/hủy và cache trong phiên. Công thức/chữ mờ có thể sai, người dùng kiểm tra xem trước. Không lưu ảnh scan hoặc OCR trên dịch vụ bên thứ ba.
- Nút **Tiếp tục phản hồi** xuất hiện khi đã có chữ nhưng phản hồi bị ngắt. Gửi một lượt hỏi mới kèm đoạn cuối phản hồi trước, không tự gọi lại và vẫn tính quota bình thường. Không bảo đảm provider sẽ luôn nối chính xác; nội dung đã nhận được giữ riêng.

Chi tiết API, định dạng và kiểm thử: [LIBRARY_SYNC_OCR_2026_11_24.md](docs/LIBRARY_SYNC_OCR_2026_11_24.md).


### Kiểm thử giao diện

Trang giới thiệu: /gioi-thieu.html. Quy trình, phạm vi và ảnh trước/sau nằm trong [báo cáo giao diện](docs/ui-redesign-2026-11-24/README.md). Chạy `npm run test:visual` sau khi cài Chromium theo hướng dẫn trong báo cáo.


## Hoàn thiện trước dùng thử công khai (24/11/2026)

- Root `/` và các CTA đều yêu cầu tài khoản; link xác minh/reset vẫn mở được từ màn hình đăng nhập.
- Quản lý tài khoản → Xóa tài khoản: xác nhận mật khẩu/cụm từ, vô hiệu hóa mọi phiên, xóa thông tin cá nhân và thư viện local của tài khoản. Bộ dọn định kỳ dọn GridFS/session/quota của các tài khoản đã đánh dấu xóa; giữ tombstone kỹ thuật để chống ghi muộn. Thiết bị khác và file đã xuất không tự xóa.
- GLOBAL_DAILY_AI_LIMIT mặc định 500 lượt tiếp nhận/ngày UTC là ngân sách bảo thủ toàn ứng dụng, bên cạnh hạn mức user. Không phải giới hạn tiền chính xác. Yêu cầu bị chặn ở bước quota user sau khi giữ ngân sách có thể vẫn chiếm lượt chung.
- `npm run build` rồi `npm start` chạy frontend build và API qua gateway cùng origin. WEB_HOST/WEB_PORT mặc định loopback/8080, PORT vẫn là API nội bộ. HTTPS do reverse proxy quản lý.
- [Hướng dẫn triển khai và khôi phục](deployment/README.md), Dockerfile, mẫu Nginx/systemd. Các mẫu chưa được triển khai lên hosting.
- `npm run check:readiness` kiểm tra cấu hình local; thêm `-- --production` để yêu cầu HTTPS. Không in secret và không tự sửa `.env`.
- `npm run check:live-ai` thực sự gọi Gemini với đoạn tổng hợp, có thể phát sinh phí; không chạy trong CI. `npm run check:live-email -- email-duoc-phep` gửi hai email thật tới tài khoản có sẵn, thay liên kết verify/reset cũ bằng liên kết mới; không đổi mật khẩu. Chỉ chạy với địa chỉ đã được chủ sở hữu cho phép. Báo cáo trong tmp không chứa token/secret.
- Kiểm thử tích hợp đọc MONGODB_TEST_URI riêng; chạy `node --env-file-if-exists=.env --experimental-strip-types --test tests/integration/*.test.mjs` sau khi tự cấu hình MONGODB_TEST_ALLOW_WRITE=isolated-tests. Không dùng URI database ứng dụng.
- [Báo cáo xác minh hiện tại](docs/READINESS_2026_11_24.md) phân biệt kiểm thử thật, giả lập và các phần chưa thể xác nhận.


## Luồng AI (25/11/2026)

Dịch chỉ dịch đoạn chọn sang tiếng Việt; Giải thích chỉ làm rõ nội dung/đề bài, không tự giải đáp số. Hai nút cần đoạn chọn và không nhận chỉ thị từ lịch sử chat. Chat `ask` làm theo câu hỏi, được dùng kiến thức ngoài PDF, tự giải khi đủ dữ kiện dù sách không có đáp án; phân biệt dữ kiện tài liệu với lời giải AI đề xuất, không bịa trang/nguồn.

Chat không bắt buộc chọn chữ: selectedText rỗng được chấp nhận riêng cho ask. Có lựa chọn Không kèm PDF; khi chọn trang/nhóm trang vẫn phải Chuẩn bị ngữ cảnh trước khi gửi. Không tự lấy nội dung PDF chưa chuẩn bị. Câu hỏi chung không hiển thị nguồn trang giả. Chat trong PDF vẫn lưu theo thư viện như trước; chat chưa gắn PDF lưu riêng theo tài khoản trong mục Chat không gắn PDF, có thể mở lại sau khi tải lại trang hoặc chuyển PDF. Không nới lỏng đăng nhập, quota, slot hoặc giới hạn dữ liệu.


## OCR theo vùng (25/11/2026)

- Kéo chuột trái trên lớp chữ PDF để tô đen như trước. Giữ chuột phải và kéo trên trang để khoanh vùng; thả chuột sẽ OCR chỉ vùng này trên máy, không gọi AI.
- Canvas OCR chỉ chứa vùng cắt theo tọa độ tương đối trang, tối đa khoảng 4 triệu pixel và mỗi chiều <=8192; không tạo ảnh scan toàn trang cho thao tác này. Độc lập với zoom/DPR.
- Chữ nhận dạng trở thành đoạn chọn, có Dịch/Giải thích và có thể gửi trong chat; luôn kiểm tra kết quả vì OCR có thể sai. Ngôn ngữ hiện có Anh, Việt, Anh+Việt. Đổi ngôn ngữ rồi bấm Nhận dạng lại vùng.
- Hủy bằng nút Hủy OCR vùng hoặc Esc. Đổi trang/PDF/zoom sẽ hủy việc nhận dạng đang chạy và không đưa kết quả cũ sang trang khác. Kéo vùng mới hủy yêu cầu vùng trước.
- Máy không dùng chuột phải: bật Chọn vùng OCR rồi kéo trái/chạm-kéo. Giữ Shift khi nhấp phải để dùng menu trình duyệt (tùy trình duyệt).
- OCR toàn trang/nhóm trang trong thiết lập ngữ cảnh vẫn là thao tác riêng, chỉ chạy khi người dùng bật OCR và bấm Chuẩn bị ngữ cảnh; kéo phải không dùng luồng này.


## Sửa OCR và lưu chat không gắn PDF (25/11/2026)

- Đoạn được OCR có nút Sửa chữ OCR. Sửa trong ô nhập rồi Lưu chữ đã sửa để áp dụng; bỏ trống bị từ chối, tối đa 12.000 ký tự. Khi đang sửa chưa lưu, cả Gửi và shortcut Dịch/Giải thích đều không gửi. Hủy giữ nguyên bản đã áp dụng; chọn vùng khác không dùng nhầm bản sửa cũ. Các lượt gửi chỉ dùng cleanedText đã sửa, giữ cờ OCR để khi mở lại vẫn nhận biết nguồn.
- Chat không gắn PDF xuất hiện riêng trong sidebar, có Chat mới, mở lại, đổi tên và xóa có xác nhận. Chat trống không tạo mục. Mở PDF lưu/flush chat hiện tại trước khi chuyển; tải lại trang bắt đầu chat trống, lịch sử mở từ sidebar.
- Dùng cùng IndexedDB và owner/revision/tombstone như thư viện, không localStorage. Một container kind=general, ID dành riêng và payload rỗng phân nhóm chat; không phải file PDF và không xuất hiện trong danh sách PDF. Archive version 1 có optional kind, kiểm tra chỉ chấp nhận container general với ID dành riêng và size=0. Backup/đồng bộ hiện có bao gồm cả chat chung; các archive PDF cũ vẫn nhập được. Bản ứng dụng cũ có thể không nhập được archive mới có chat chung.
- Xóa tài khoản chặn thêm lượt lưu muộn cho owner đã xóa, kể cả thông báo giữa các tab; không tạo lại container general sau thao tác xóa.


## MongoDB thật và đồng bộ tự động (25/11/2026)

- Tài khoản vẫn ghi trực tiếp MongoDB qua API đăng ký/đăng nhập. PDF và toàn bộ chat (kể cả chat không gắn PDF) lưu tự động vào GridFS theo user. Không dùng database giả trong runtime, không thay .env thật.
- Khi đăng nhập: kiểm tra phiên bản máy chủ, tải/hợp nhất nếu cần, rồi đẩy phần thư viện local của đúng tài khoản chưa có trên máy chủ. Không tự chuyển dữ liệu khách hoặc tài khoản khác sang user hiện tại.
- Tự lưu sau khoảng hai giây yên lặng; không tải cả thư viện lên theo từng token AI, không ngắt AI đang trả lời hoặc OCR đang sửa. Khi có mạng lại, quay lại tab hoặc mỗi phút khi tab hiển thị, ứng dụng kiểm tra và đồng bộ lại. Nếu đổi tài khoản/đăng xuất, hủy yêu cầu cũ.
- HEAD/ETag và chữ ký canonical của manifest tránh download/upload không đổi. If-Match chống ghi đè phiên bản mới; bản chat xung đột được giữ thêm thành bản khôi phục. Metadata thời gian mở/counter/revision được hợp nhất để tránh vòng lặp sync giữa thiết bị.
- Trạng thái riêng trong trình đọc: chờ lưu, đang đồng bộ, đã đồng bộ MongoDB hoặc lỗi sẽ thử lại. Chỉ báo đã đồng bộ khi server xác nhận hoặc HEAD và chữ ký khớp bản đã xác nhận. Bản trên trình duyệt là bộ đệm, không đồng nghĩa đã lên máy chủ.
- Bộ sưu tập chính: users/sessions cho tài khoản; library_heads_v1 và library_archives_v1.files/chunks cho snapshot PDF/chat. Snapshot gồm dữ liệu PDF thật, không chỉ đường dẫn file trên máy. Kiến trúc hiện vẫn dùng snapshot trọn thư viện khi có thay đổi; với thư viện lớn cần cân nhắc API incremental sau này.
- `public/privacy.html`, trang giới thiệu và lời nhắc dữ liệu đã cập nhật về tự động lưu trên máy chủ. Sao lưu xuất/nhập vẫn hoạt động. Dữ liệu AI chỉ gửi Gemini khi người dùng chủ động Gửi/Dịch/Giải thích; lưu MongoDB không tự gọi AI.

AI_MAX_OUTPUT_TOKENS: backend generation budget, default 8192 (previously 2048). Increase cautiously: higher output budgets can increase token use/cost. This does not eliminate upstream outages. Unclear recognized math must be confirmed instead of silently changing coefficients.
