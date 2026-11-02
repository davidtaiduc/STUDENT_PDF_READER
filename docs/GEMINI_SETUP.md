# Gemini + MongoDB

Luồng: trình duyệt → Node.js `/api/ai` → Gemini. MongoDB lưu bộ đếm giới hạn AI; không chạy mã backend và không thay thế Node.js. PDF được mở tại trình duyệt. Chỉ đoạn chọn (tối đa 12.000 ký tự), tối đa 650 ký tự ngữ cảnh mỗi phía và câu hỏi được gửi tới Google. Kết quả AI có thể sai.

## Chạy local

Yêu cầu Node.js >=22.18 và quyền kết nối tới MongoDB đã có của bạn. Không cần tạo database server local mới.

1. `npm.cmd install`
2. Sao chép `.env.example` thành `.env` nếu chưa có. Không ghi đè cấu hình đã điền. Backend đọc `.env`; `.env.local` cũ không được backend nạp nữa. Biến môi trường hệ thống/hosting được ưu tiên hơn file.
3. Điền `GEMINI_API_KEY` lấy từ Google AI Studio; giữ key trên server. Không dùng biến `VITE_GEMINI_API_KEY`.
4. Điền `MONGODB_URI` của database đã có (`mongodb://...` hoặc `mongodb+srv://...`). Đặt `MONGODB_DB` đúng tên database cần dùng; mặc định `student_pdf_reader`. Không gửi URI có mật khẩu vào chat. Nếu dùng Atlas, cấp quyền kết nối cho IP của máy chạy backend và quyền đọc/ghi database ứng dụng.
5. `AI_ACCESS_TOKEN` là mã nội bộ giữa máy chủ web và backend, không phải mã người dùng nhập. File `.env` đã được chuẩn bị có sẵn mã ngẫu nhiên. Giữ mã này trên server; không đặt vào biến VITE hoặc bundle.
6. Terminal 1: `npm.cmd run server`. Chờ thông báo backend sẵn sàng.
7. Terminal 2: `npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
8. Mở http://127.0.0.1:5173, mở PDF và chọn Dịch/Giải thích để chạy ngay; Hỏi AI cần nhập câu hỏi rồi bấm Gửi. Không có bước nhập mã. Vite local proxy tự gửi thông tin xác thực tới backend, chỉ cho kết nối loopback với host/origin local phù hợp. Trình duyệt không nhận mã nội bộ.

`npm run server` chạy chế độ phát triển local: bỏ hạn mức số lượt theo phút/ngày và không đọc/tăng bộ đếm MongoDB, kể cả khi bộ đếm cũ đã hết. Không cần sửa `.env`. Chế độ này yêu cầu HOST loopback và không chạy khi NODE_ENV=production. Giới hạn Google API, độ dài đoạn chọn, timeout và số yêu cầu đồng thời vẫn áp dụng. `npm run server:production` giữ hạn mức cấu hình trong `.env`; dùng lệnh này cho triển khai ngoài local.

Lỗi Gemini được phân loại theo mã lỗi và metadata chính thức: giới hạn tốc độ, hết quota ngày, dịch vụ tạm lỗi và cấu hình/số dư cần kiểm tra. HTTP 429 không đủ thông tin được mô tả trung lập, không tự kết luận hết quota ngày. Thời gian chờ lấy từ Retry-After/RetryInfo; nếu lỗi có thể thử lại nhưng không có thời gian, dùng khoảng nghỉ đề xuất tối thiểu 5 giây. UI đếm ngược và khóa nút Thử lại trong lúc chờ; không tự gửi lại yêu cầu trả phí. Lỗi không thể xử lý bằng thử lại ngay sẽ không hiển thị nút đó. Phản hồi nhà cung cấp chỉ dùng để phân loại, không gửi raw message, prompt hoặc secret xuống UI.

Backend cần MongoDB truy cập được để khởi động. Thiếu Gemini key vẫn chạy backend và kiểm tra kết nối được, riêng AI trả 503. Lỗi database trong lúc chạy trả 503 và không gọi Gemini. Giới hạn mặc định toàn ứng dụng: 100 yêu cầu/ngày UTC, 10/phút, tối đa 3 yêu cầu đồng thời mỗi tiến trình. Mỗi lượt thử được tính kể cả khi hủy hoặc Gemini lỗi; đây là giới hạn yêu cầu, không phải trần chi phí Google. Giới hạn tài khoản Google có thể thấp hơn. Collection `gemini_usage_v1` chỉ lưu khóa khoảng thời gian, count, expiresAt với TTL; cần quyền tạo index. Không lưu PDF, prompt hoặc phản hồi vào MongoDB.

Sau khi điền/sửa `.env`, khởi động lại backend rồi chạy `npm.cmd run check:backend`. Lệnh này kiểm tra MongoDB, `/api/health` và mã truy cập `/api/access`, không gọi Google hoặc tiêu thụ hạn mức AI. Trên header web có trạng thái kết nối máy chủ và nút Kiểm tra. Health chỉ xác nhận key được cấu hình, chưa xác nhận Google chấp nhận key.

Nếu DNS hệ thống báo `querySrv ECONNREFUSED` nhưng DNS công cộng tra được cluster, có thể tự thêm `MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8` vào `.env`. Tùy chọn này chỉ đổi resolver của tiến trình backend/check, không đổi DNS Windows. Không cần đặt nếu DNS hiện tại hoạt động. Chỉ `.env` được backend đọc; `.env.example` là file mẫu, không điền bí mật vào đó.

## Chuẩn bị tài khoản người dùng

`backend/src/database/mongo.ts` quản lý một pool kết nối chung cho các repository. `backend/src/auth/appToken.ts` tách xác thực khỏi route và trả principal cho handler/hạn mức. Hiện xác thực kết nối máy chủ web bằng mã nội bộ (`kind: app`); chưa có đăng ký, đăng nhập hoặc phiên user. Khi phát triển tài khoản, thêm repository users/sessions, bộ xác thực phiên và giới hạn theo user; không dùng mã nội bộ để phân biệt tài khoản. Ghi chú IndexedDB vẫn theo thiết bị; đồng bộ theo user cần API riêng và kiểm tra quyền sở hữu mỗi mục trước khi triển khai.

API dùng Interactions, `store:false`, stream văn bản; model mặc định `gemini-3.5-flash-lite`, đổi bằng `GEMINI_MODEL` trên server. Thiết lập này không thay thế chính sách xử lý dữ liệu của Google. Lịch sử cũ vẫn ở IndexedDB; MongoDB chưa đồng bộ tài khoản hay ghi chú.

## Đưa lên hosting

OneSite hiện chỉ chứa frontend tĩnh. Cần một nơi chạy Node.js liên tục và database mà backend truy cập được. `localhost` trên hosting chỉ chính máy hosting, không trỏ về PC của bạn.

Luồng không nhập mã hiện được xác minh trên máy chủ web local. Proxy local không phải gateway công khai và không cấp credential cho kết nối ngoài loopback hoặc origin khác. Bản OneSite cũ chưa được cập nhật. Trước khi đưa luồng này lên online cần triển khai lớp truy cập server phù hợp; không nhúng mã nội bộ vào frontend và không bỏ xác thực của API trực tiếp.

- Trên backend: cài dependencies, đặt các biến môi trường server, chạy `npm run server:production`; platform có thể đặt `HOST=0.0.0.0`, `PORT` theo yêu cầu. Dùng HTTPS qua reverse proxy/platform, giới hạn kết nối và timeout đọc request ở proxy. Không công khai cổng MongoDB; dùng xác thực database khi triển khai mạng.
- Đặt `ALLOWED_ORIGINS` đúng origin website, ví dụ `https://p-22yyl3eqofjagyfo.vibepages.net`, không wildcard.
- Trước khi build frontend, tự đặt `VITE_AI_API_URL` trong `.env` hoặc biến tiến trình với URL HTTPS thật của lớp truy cập API production; chạy `npm.cmd run build:static`. Lệnh đọc `.env`, không đọc `.env.example`. Không đặt access token hoặc API key trong biến VITE; không chỉ trỏ browser thẳng vào API nội bộ rồi bỏ qua yêu cầu xác thực.
- ZIP **nội dung dist** rồi tải lên phiên bản OneSite mới. Không ZIP mã server, `.env`, `.env.local`, node_modules hoặc PDF cá nhân. Bản ZIP/Preview cũ chưa tự đổi sang Gemini.
- Khi thêm tài khoản, xác thực từng người dùng và áp dụng hạn mức riêng. CORS không thay thế xác thực. Nếu xoay mã nội bộ AI_ACCESS_TOKEN, khởi động lại cả backend và máy chủ web.

Kiểm tra: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. Các bài test Gemini dùng mock, không tốn quota Google. Chỉ xác nhận kết nối thật sau khi có API key và MongoDB hoạt động.

Tài liệu chính thức: https://ai.google.dev/gemini-api/docs/interactions-overview và https://ai.google.dev/gemini-api/docs/api-key.
