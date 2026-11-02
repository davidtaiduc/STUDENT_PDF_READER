# Triển khai từ Git

Đã chuẩn bị workflow `.github/workflows/ci.yml`: khi push main hoặc mở pull request, GitHub sẽ kiểm tra file môi trường, npm ci, lint, test và build. Workflow chưa chạy trên GitHub vì chưa push; chưa có bước deploy. Tests dùng provider/database giả lập, không cần secrets CI hoặc gọi Gemini thật. Test dùng PDF riêng được skip nếu Git không chứa fixture. Lệnh `npm run check:secrets` kiểm tra các trường bí mật trong file mẫu và file .env bị Git theo dõi, chỉ in tên trường/file; đây là kiểm tra cơ bản, không phải bộ quét bí mật toàn bộ lịch sử Git.

Git remote local hiện trỏ tới `https://github.com/davidtaiduc/STUDENT_PDF_READER.git`, nhánh `main`. Các thay đổi phát triển gần đây chưa commit/push; không coi mã trên remote là bản mới nhất.

Đã kiểm tra trực tiếp tab Git URL của OneSite trong OnePortal ngày 02/11/2026: chỉ nhận repository GitHub/GitLab công khai và tải tệp tĩnh có sẵn, không chạy build. Đây chưa phải cấu hình CI/CD chạy frontend React và backend Node.js. Đưa repository Vite chưa build vào ô này không khởi động backend. Chưa xác nhận khả năng tự đồng bộ theo mỗi push.

Luồng triển khai toàn bộ dự án cần: mã local → repository Git → hosting hỗ trợ Node.js → kiểm thử/build → khởi động backend và phục vụ frontend qua HTTPS. Dự án yêu cầu Node >=22.18. MongoDB tiếp tục dùng database hiện có. Gói hosting và cách phục vụ frontend/proxy production cần được chọn trước khi viết cấu hình triển khai cụ thể; proxy hiện có trong Vite chỉ cho local. Không dùng `npm run server` development-unlimited cho hosting public; lệnh backend production là `npm run server:production`.

Trước khi commit/push, người dùng cần tự xóa API key và URI có mật khẩu khỏi `.env.example`, để các giá trị mẫu trống. Giữ bí mật trong `.env` đã bị Git ignore hoặc biến môi trường của hosting. Không đẩy `.env`, PDF cá nhân, node_modules hoặc log lên Git. Lượt kiểm tra này không commit, push, đăng ký dịch vụ hay xuất bản website.
