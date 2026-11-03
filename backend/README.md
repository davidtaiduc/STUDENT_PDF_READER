# Backend

API Node.js cho Gemini và MongoDB. Chạy các lệnh từ thư mục gốc `student-pdf-reader`; dự án dùng chung một `package.json` và `package-lock.json` để quản lý phiên bản dependency.

```text
backend/
  src/
    index.ts              Khởi động, cấu hình runtime và dừng server
    app.ts                HTTP API, CORS, validation và streaming
    auth/                 Xác thực nội bộ và quyền gọi từ web local
    config/               Thiết lập DNS và đọc .env cho proxy web
    database/             Pool kết nối MongoDB
    services/
      ai/                 Gemini, prompts và phân loại lỗi nhà cung cấp
      usage/              Bộ đếm và chính sách hạn mức
  scripts/
    check-connection.mjs  Kiểm tra database và kết nối API
  tsconfig.json           Kiểm tra kiểu backend
```

- Chạy toàn ứng dụng: `npm run dev` tại gốc, frontend + backend chung terminal; Ctrl+C dừng cả hai.
- Chạy backend riêng: `npm run dev:backend` (`npm run server` vẫn dùng được).
- Production: `npm run server:production`.
- Kiểm tra kết nối: `npm run check:backend`.
- Kiểm tra kiểu: `npx tsc -p backend/tsconfig.json`.
- Test toàn dự án: `npm test`.

Backend đọc `.env` ở gốc qua lệnh npm. Không chuyển hoặc sao chép key vào frontend. Các kiểu dữ liệu, SSE và lỗi dùng chung nằm ở `shared/`; backend không import mã giao diện từ `src/`. Tests của frontend/backend và các luồng tích hợp nằm ở `tests/` tại gốc.

Hiện dùng mã xác thực nội bộ giữa máy chủ web và API; tài khoản người dùng chưa được triển khai. Chế độ dev local không giới hạn số lượt theo phút/ngày; chính sách production và giới hạn Google giữ nguyên.

Proxy Vite dùng `readProjectEnvironment` để đọc cùng `.env`, ưu tiên biến tiến trình và không lấy credential từ `.env.example`, `.env.local` hoặc file mode. Backend dùng cờ `--env-file-if-exists=.env`, không fallback sang file mẫu. Chỉ `VITE_AI_API_URL` là cấu hình tùy chọn được phép đưa vào frontend.
