# Ghi chú và lịch sử học tập

1. Mở một PDF tại cùng địa chỉ ứng dụng bạn đã dùng trước đó.
2. Bôi đen đoạn cần ghi nhớ. Trong bảng bên phải, nhập ghi chú rồi chọn
   **Lưu ghi chú**. Không cần chạy AI để lưu ghi chú.
3. Sau khi AI trả lời hoàn tất, chọn **Lưu kết quả** để giữ bản dịch, giải thích
   hoặc câu trả lời. Có thể thêm ghi chú trước khi lưu. Mỗi lần lưu là một mục
   riêng; nút Đã lưu ngăn bấm lặp khi nội dung chưa thay đổi.
4. Mở **Lịch sử**, bung một mục để xem đoạn gốc, kết quả, ghi chú và thời gian.
   **Đến trang** mở trang PDF tương ứng; **Sao chép** lấy nội dung ra clipboard.
5. **Sửa ghi chú** cập nhật ghi chú của mục. **Xóa mục** cần xác nhận lần hai.

Tải lại trang không xóa dữ liệu. Bạn cần tự mở lại PDF; app nhận ra nội dung
theo SHA-256. Đổi tên file vẫn nhận đúng lịch sử. Hai PDF khác nội dung dù cùng
tên sẽ có lịch sử riêng. File PDF không được lưu lại trong cơ sở dữ liệu.

Ứng dụng lưu metadata tài liệu, đoạn chọn, ghi chú, kết quả AI, câu hỏi, model
và thời gian trong IndexedDB của trình duyệt hiện tại. Chỉ các mục bạn bấm lưu
mới xuất hiện trong lịch sử; kết quả đang stream hoặc đã dừng chưa thể lưu.
Nút Sao chép vẫn dùng được với kết quả nhận được một phần.

Mỗi mục giới hạn đoạn chọn 12.000 ký tự, ghi chú 10.000, kết quả 50.000 và câu hỏi
2.000 ký tự. Thời gian hiển thị theo múi giờ Bangkok (UTC+7).

Lịch sử gắn với trình duyệt/profile và địa chỉ ứng dụng. `localhost` và
`127.0.0.1`, hoặc hai cổng khác nhau, có vùng lưu trữ riêng. Dùng lại đúng địa chỉ
http://127.0.0.1:5173 để xem dữ liệu đã lưu tại đó. Xóa dữ liệu website, đổi profile
hoặc dùng chế độ riêng tư có thể làm mất lịch sử. Chưa có xuất bản sao lưu hoặc
đồng bộ đám mây.

Nếu lưu trữ bị chặn hoặc hết dung lượng, ứng dụng hiển thị thông báo. Bạn vẫn
có thể đọc PDF và sao chép nội dung; tab Lịch sử có nút Thử tải lại.
