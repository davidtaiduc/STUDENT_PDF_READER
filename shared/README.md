# Shared

Mã thuần dùng chung giữa frontend và backend:

- `types/`: hợp đồng dữ liệu AI và trạng thái backend.
- `ai/errors.ts`: mã lỗi, dữ liệu lỗi và thời gian chờ.
- `ai/sse.ts`: đọc stream SSE, xử lý UTF-8 và hủy yêu cầu.

Không đặt secret, kết nối database, lệnh gọi Gemini, giao diện React hoặc mã phụ thuộc Node.js vào thư mục này. Prompts và tích hợp nhà cung cấp thuộc `backend/src/services/ai/`.
