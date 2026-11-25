# Đưa StudyPDF lên hosting Node.js

## Mô hình đã chuẩn bị

Một origin HTTPS → Nginx → gateway Node cổng 8080 → API riêng trên loopback cổng 3001 → MongoDB/Gemini/Resend. `npm start` chạy gateway và backend; frontend được phục vụ từ `dist`. Không dùng Vite dev server để public. `AI_ACCESS_TOKEN` chỉ được gateway thêm phía server, không nằm trong bundle. Host tĩnh/OneSite/Vercel chỉ chứa frontend không đủ cho mô hình này nếu chưa có backend/gateway tương đương.

## Chuẩn bị

1. Node >=22.18, `npm ci`, `npm run lint`, `npm test`, `npm run build`, `npm run check:secrets`.
2. Tự điền secret trong `.env` hoặc biến môi trường hosting; không đưa file này vào Git/image. Không dùng `.env.example` làm runtime.
3. `ALLOWED_ORIGINS=https://ten-mien-cua-ban`, `APP_PUBLIC_URL=https://ten-mien-cua-ban`, `VITE_AI_API_URL=` (cùng origin). Khi đổi biến build, build lại.
4. MongoDB có tài khoản quyền tối thiểu trên database ứng dụng; Resend có tên miền gửi được xác minh, MAIL_FROM thuộc tên miền đó.
5. `PORT=8080`, `API_PORT=3001`, `WEB_HOST=127.0.0.1`; Nginx cùng máy dùng `TRUST_PROXY=loopback`. Chỉ public cổng 443/80 cần thiết, không public MongoDB/API 3001/gateway 8080.
6. `npm run check:readiness -- --production` phải đạt. Script chỉ hiện tên biến, không in giá trị.

## Chạy

- Thử tiến trình: `npm start`. Dùng systemd mẫu `deployment/studypdf.service` cho VPS Linux; tài khoản `studypdf`, đường dẫn Node, thư mục và quyền đọc env cần khớp máy thực tế. File `/etc/studypdf.env` chỉ chủ dịch vụ đọc được.
- Hoặc build Docker: `docker build -t studypdf:VERSION .`; chạy với `--env-file /duong-dan-rieng/studypdf.env -p 127.0.0.1:8080:8080`. Dockerfile không cài dev dependencies trong runtime và không copy .env. Chưa kiểm chứng image thực tế khi môi trường phát triển không có Docker.
- Gắn `deployment/nginx-location.conf` vào server HTTPS đã có domain/chứng chỉ; kiểm tra `nginx -t` rồi reload. Mẫu là location include, không tự cấp chứng chỉ hoặc DNS. Gateway không tự cung cấp TLS.
- Kiểm tra `/api/health` trả 200, tài khoản, email link đúng hostname, AI stream đến từng phần, tải/đồng bộ thư viện. Cookie production Secure nên phải kiểm thử đăng nhập qua HTTPS.

Nginx tắt buffering để SSE trả dần và đặt timeout dài hơn thời hạn AI. Tham khảo [tài liệu proxy Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html). Tên miền gửi email cần xác minh theo [Resend Domains](https://resend.com/docs/dashboard/domains/introduction).

## Giới hạn và chi phí

Mặc định 30 lượt/user/ngày UTC, 5 lượt/phút, 3 slot đồng thời và 500 lượt tiếp nhận AI chung/ngày. `GLOBAL_DAILY_AI_LIMIT` là trần tiếp nhận bảo thủ: một lượt được giữ trước khi kiểm tra quota user, nên yêu cầu bị chặn ở bước sau cũng có thể chiếm ngân sách chung. Không phải trần tiền tuyệt đối; mỗi lượt dùng số token khác nhau. Đặt thêm cảnh báo/ngân sách tại nhà cung cấp khi tài khoản hỗ trợ. Không tự retry provider. Các biến đều cho phép người vận hành tự cấu hình số nguyên dương.

## Quan sát và khôi phục

Theo dõi `/api/health` từ dịch vụ giám sát bên ngoài, log khởi động/lỗi đã được lược bỏ nội dung riêng tư, trạng thái 429/503 và dashboard provider. Không log request body, Authorization, cookie, email-token URL hoặc nội dung PDF/chat. Mẫu đã có restart-on-failure và Docker healthcheck; chưa đăng ký dịch vụ giám sát cho người dùng.

Phát hành mỗi phiên bản vào thư mục/image riêng; giữ phiên bản trước. Build/test trước, chuyển `current`, restart, healthcheck. Nếu lỗi, chuyển lại phiên bản cũ và restart. Không cần rollback schema phá hủy cho thay đổi hiện tại.

Backup MongoDB bằng công cụ nhà cung cấp/mongodump tới kho riêng có mã hóa và phân quyền. Backup gồm users/sessions/quota và GridFS/head; cần snapshot nhất quán. Thử restore vào database thử riêng, không ghi đè dữ liệu đang chạy. Công bố lịch giữ bản backup trước public; loại trừ/áp dụng lại dấu xóa tài khoản khi khôi phục backup để không phục hồi tài khoản đã xóa.

## Xóa tài khoản

DELETE `/api/users/me` cần cookie, Origin hợp lệ, mật khẩu và cụm xác nhận. Tài khoản bị vô hiệu hóa/ẩn thông tin ngay. Bộ dọn chạy lúc khởi động và mỗi phút, lặp lại các dấu xóa để thu hồi phiên và dọn upload đến muộn. Không tự xóa dữ liệu của tài khoản đang hoạt động. File sao lưu đã xuất, bản trên thiết bị khác và backup vận hành cần xử lý riêng. Chỉ mã opaque/thời điểm xóa được giữ trong tombstone kỹ thuật để chặn ghi muộn.

## Kiểm tra ngoài môi trường local

`npm run test:integration` yêu cầu MONGODB_TEST_URI riêng và MONGODB_TEST_ALLOW_WRITE=isolated-tests. Các test tạo database ngẫu nhiên rồi dọn đúng database đó. Không trỏ vào database ứng dụng. Playwright WebKit không thay thế kiểm thử Safari trên iPhone thật. Trước công khai, người vận hành cần điền danh tính/kênh liên hệ và chính sách backup trong trang quyền riêng tư/điều khoản.

## Render (Docker)
Set PORT=10000, API_PORT=3001, WEB_HOST=0.0.0.0. PORT takes precedence over WEB_PORT for the public gateway. Health check: /api/health. Set ALLOWED_ORIGINS and APP_PUBLIC_URL to the actual HTTPS service URL without trailing slash. Configure secrets in Render environment variables; .env is intentionally absent from the image.
