# Giao diện đọc PDF và chat AI — 17/11/2026

Người dùng chọn ưu tiên cải thiện giao diện đọc PDF/chat; chưa triển khai Day12 import legacy trong phiên này.

## Thay đổi

- Header sidebar và header chat gọn hơn; thông tin về hội thoại/dữ liệu gửi Google nằm trong details có thể mở bằng bàn phím.
- Nút Lưu vào lịch sử vẫn archive toàn bộ đoạn chat như trước, giữ accessible label cũ.
- Ô nhập/nút gửi đặt cạnh nhau; giữ excerpt và nút × xóa lựa chọn. Preview dài có vùng cuộn riêng, không cắt mất dữ liệu lưu hoặc đoạn gửi AI.
- Chat có thêm chiều cao cho tin nhắn; đo DOM tại1280×720 được250px ở trường hợp QA. Trên390×844 sau điều chỉnh đo261px. Kích thước thực tế tùy nội dung quota/preview/các mục đang mở.
- Nút chuyển trang và zoom được nhóm riêng để xuống hàng cùng nhau trên màn hình nhỏ. Giữ inline page counter, keyboard Enter/Escape và fit width.
- Mobile xếp PDF/trợ lý theo chiều dọc với trợ lý đủ cao, workspace có thể cuộn. Trên390px, document.scrollWidth bằng viewport390px; zoom PDF vẫn có thể cuộn ngang bên trong viewer.

## Kiểm tra

- Kiểm tra nền trước sửa:104/104 tests, lint/secrets PASS.
- QA dùng main App thật, fake repositories/provider tại127.0.0.1:5181, tài khoản giả và Test Case2.pdf. Không MongoDB thật, không Gemini thật.
- Đã mở PDF, chọn chữ, gửi câu hỏi, xem Markdown/LaTeX nhiều đoạn, quota refresh; nhảy trang bằng số nhập và zoom vẫn giữ chat.
- Đã kiểm tra responsive390×844 và lưu archive rồi mở Lịch sử(1). Đã reset viewport sau QA.
- Ảnh desktop READING_CHAT_2026_11_17.jpg, mobile READING_CHAT_MOBILE_2026_11_17.jpg. Phản hồi AI trong ảnh là dữ liệu giả kiểm thử giao diện.
- Chạy lại npm test, npm run lint, npm run build, npm run check:secrets sau thay đổi; kết quả được báo trong cuộc trò chuyện. Cảnh báo bundle lớn có từ trước, không xử lý dependency trong thay đổi UI này.

## File trong phạm vi phiên này

src/components/AiPanel/ChatPanel.tsx, src/components/PdfViewer/PdfToolbar.tsx, src/index.css, README.md, tài liệu này và2ảnh QA. Các thay đổi Day9–11 chưa commit khác được giữ nguyên.

Không sửa .env, không đổi backend/auth/quota/storage/SSE/prompt, không branch/commit/push/deploy. Không thêm dependency hoặc test chỉ lặp lại CSS.
