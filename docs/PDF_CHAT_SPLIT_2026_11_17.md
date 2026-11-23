# Bố cục PDF / Hỏi AI — 17/11/2026

Yêu cầu: tham khảo chatpdf.ai, phần bên phải chỉ Hỏi AI; Dịch/Giải thích xuất hiện sau chọn chữ trên PDF, thanh chia co giãn/thu gọn được. Web lookup chatpdf.ai redirect sang trang rao bán GoDaddy, không xem được ứng dụng tại tên miền đó; triển khai theo mô tả trực tiếp của người dùng, không khẳng định sao chép giao diện site.

## Thay đổi

- ReaderSplitPane mới: kéo divider desktop trong25–75%, doubleclick reset55%; keyboard Left/Right2%, Home/End. Nút đóng/mở từng pane. Collapsed pane giữ mounted để không reset chat/PDF hoặc gọi lại AI. Mobile một cột, buttons collapse, handle drag ẩn.
- Bên phải luôn ChatPanel. Gỡ tabs Trợ lý/AI/Ghi chú; notes/history chuyển dialog riêng, vẫn scoped storage và không thay đổi schema.
- PdfSelectionActions mới trong vùng PDF, chỉ có khi đã chọn chữ; manual Dịch/Giải thích, excerpt và nút đóng. Chọn đoạn khác abort/unmount kết quả cũ; không tự chạy cho selection mới. Sau đóng có thể tô lại cùng đoạn để mở công cụ.
- Kết quả là vùng nổi phía dưới PDF (max55% chiều cao pane), cuộn độc lập; không nhúng vào chat. Chat vẫn dùng snapshot excerpt riêng và nút × xóa source khỏi câu hỏi như trước.
- AiPanel: hoãn bắt đầu request một microtask và kiểm tra active/abort để lần effect StrictMode bị hủy không gửi request trả phí. Không retry tự động, không đổi model/prompt/SSE/quota.

## QA đã chạy

Main App thật, PDF Test Case2, tài khoản/repository/provider giả tại origin5181. Không sửa .env hoặc ghi MongoDB thật, không gọi Google thật.

- Trước khi chọn chữ: không có panel Dịch/Giải thích, chat hiện sẵn.
- Chọn chữ: popup PDF và excerpt chat có nguồn; quota không tăng chỉ vì selection.
- Giải thích: kết quả chỉ trong PDF. Sau fix StrictMode, một click tăng1 lượt fixture (3→4, lần tiếp4→5); trước fix quan sát request lặp nên đã sửa.
- Đổi selection từ Năng sang Học: kết quả PDF cũ bị gỡ, không gọi thêm AI; chat cũ còn nguyên.
- Đóng popup rồi chọn lại cùng đoạn: popup mở lại, đã kiểm tra visible/hidden/visible.
- Kéo separator bằng pointer: aria-valuenow55→49; ArrowLeft55→53. Thu gọn PDF, thu gọn chat, mở lại: hội thoại và kết quả giữ nguyên.
- Notes/history dialog mở/đóng được, không đưa translation vào chat/history. Không tạo/migrate/xóa dữ liệu thật.
- Mobile390×844: collapse/reopen PDF, hidden splitter, document scrollWidth390 bằng viewport390. Reset viewport sau QA.
- Ảnh PDF_CHAT_SPLIT_2026_11_17.jpg là dữ liệu AI giả, không phải kết quả Gemini thật.

## File

src/components/PdfViewer/{ReaderSplitPane.tsx,PdfSelectionActions.tsx} mới; PdfViewer.tsx; src/components/Study/{StudySidebar.tsx,StudyToolsDialog.tsx mới}; src/components/AiPanel/{SelectionAssistant.tsx,AiPanel.tsx}; src/index.css; README và tài liệu/ảnh này. Các thay đổi trước trong working tree giữ nguyên, không commit/push/deploy.

Các hướng dẫn UI trước đó trong READING_CHAT_UI_2026_11_17.md và docs Day8–11 là lịch sử; bố cục hiện tại theo tài liệu này. Chưa lưu kích thước divider qua reload. PDF zoom lớn vẫn có thể cuộn ngang trong viewer, không làm toàn trang tràn ngang. Không có live Mongo/Gemini test trong scope UI.
