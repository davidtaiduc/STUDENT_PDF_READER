# StudyPDF backend

Node.js HTTP API cho tài khoản, email, session và Gemini/quota. Xem [README gốc](../README.md) để chạy/cấu hình.

Từ 23/11/2026 đã gỡ toàn bộ API ghi chú/lịch sử `/api/study/*`, storage handler và index study_records. Không xóa collection/dữ liệu cũ. MongoDB lưu tài khoản, phiên, email token, counters/lease AI và thư viện mới qua GridFS (`library_heads_v1`, `library_archives_v1.files/chunks`).

Backend đọc .env thật ở gốc. npm run dev ở gốc chạy frontend và backend; dev:backend dùng Node --watch. Server production vẫn cần HTTPS/reverse proxy và cấu hình credential nội bộ phù hợp. Không đưa secret vào client.


Thư viện: `GET/HEAD/PUT /api/library/archive`, đọc cookie session, kiểm tra Origin cho PUT; không nhận userId làm quyền truy cập. `If-Match` bắt buộc để cập nhật, header `X-Library-Owner` tùy chọn ràng buộc tài khoản client dự kiến. Tối đa 544MiB và 120s/lượt; stream GridFS, tối đa 2 upload/instance. Chỉ thay head khi upload thành công và revision còn khớp; xóa blob upload lỗi/xung đột, giữ head cũ. Không đọc/migrate `study_records`. Thư viện offline/sao lưu vẫn hoạt động khi backend mất kết nối.

Integration: `tests/integration/library-mongo.test.mjs` cần MONGODB_TEST_URI và MONGODB_TEST_ALLOW_WRITE=isolated-tests. Tạo database có tiền tố spr_lib_test_ ngẫu nhiên và chỉ dọn database đó. Không dùng tài khoản ứng dụng thật để QA.
