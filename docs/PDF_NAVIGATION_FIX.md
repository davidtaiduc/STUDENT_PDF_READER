# Giữ bài giải khi thao tác PDF — 02/11/2026

Nguyên nhân: StudySidebar gắn key của SelectionAssistant với selectionScope, vốn thay đổi theo trang và zoom. React unmount toàn bộ trợ lý, hủy stream và xóa nội dung đang xem. Đã bỏ key này và prop phụ thuộc viewport. Sidebar vẫn reset theo documentVersion khi mở tài liệu khác. Hook bôi đen tiếp tục xóa selection DOM cũ khi đổi trang/zoom; SelectionAssistant giữ bản trích dẫn đã chụp cùng bài giải, câu hỏi và ghi chú.

Số trang hiện tại trong toolbar được chỉnh trực tiếp, không thêm một ô nhảy trang riêng. Enter chuyển trang, rời ô cũng xác nhận số hợp lệ, Escape khôi phục số hiện tại. Số rỗng, không nguyên hoặc ngoài 1..totalPages được báo lỗi; không chuyển trang sai. Prev/Next cập nhật lại số hiển thị. Trạng thái chưa mở PDF vô hiệu hóa input.

## Kiểm tra

- 51 test sẵn có và lint qua; build TypeScript/frontend/backend qua.
- Browser với Test Case 5 và provider stream giả lập: phản hồi tiếp tục qua Next, zoom, nhập số trang và Fit Width; bộ đếm requests/cancellations giữ nguyên so với mốc sau khi bắt đầu phản hồi (không tạo thêm AI call do điều hướng).
- Bài giải hoàn tất và ghi chú chưa lưu giữ nguyên khi đổi trang/zoom. Không ghi thêm ghi chú test vào database.
- Nhập 0 bị báo phạm vi; Escape khôi phục số trang hiện tại.
- Mở Test Case 8 (441 trang) reset trợ lý của tài liệu cũ; nhập 221 và 441 chuyển đúng trang, nút Next disabled ở trang cuối. Nhập 442 không đổi trang và báo 1..441.
- UI fixture chạy loopback riêng ở 5174, không gọi Google hoặc ghi MongoDB. Ảnh kiểm thử: PDF_NAVIGATION_PREVIEW.png.

Không đổi `.env`, backend hoặc bản OneSite đã xuất trước đây.
