# Giữ PDF ổn định khi thay đổi kích thước

Nguyên nhân: `PdfViewer` đặt mức zoom trong React key của `PdfPage`, khiến mỗi lần ResizeObserver cập nhật zoom đều hủy component/canvas. Hiệu ứng render cũng xóa canvas ngay trước khi PDF.js hoàn thành trang mới.

Thay đổi:

- Key chỉ đổi khi tài liệu hoặc trang đổi, không đổi khi zoom.
- Giữ canvas và text layer hoàn tất cùng một surface; scale tạm surface này để phản hồi ngay khi kích thước thay đổi.
- Gộp các lần thay đổi liên tục trong 120ms trước khi render bản sắc nét.
- Vẽ canvas/text layer mới ngoài DOM, thay đồng thời khi cả hai đã sẵn sàng. Hủy các lượt render lỗi thời và giải phóng surface cũ sau khi thay.
- Không đổi API, backend hoặc dữ liệu chat. Đây là thay đổi vòng đời render PDF, bổ sung cho lần chỉnh giao diện trước đó.

Kiểm tra: lint, build, 101/101 unit tests và 9/9 Playwright đạt. Bài kiểm tra bổ sung kéo thanh chia 24 bước, thu gọn/mở lại AI, theo dõi mutation để phát hiện canvas trống, kiểm tra số lần thay surface được gộp và xác nhận chọn chữ sau resize. AI trong kiểm thử là dữ liệu giả.
