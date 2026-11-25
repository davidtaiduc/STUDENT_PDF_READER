# Giao diện StudyPDF — 24/11/2026

Giữ React, CSS toàn cục và PDF.js hiện có. Chỉ sửa lớp trình bày và một số nhóm JSX; không đổi backend, API, hooks, sự kiện hay hợp đồng props.

## Thay đổi

- Token chung tại `public/theme.css`, font Be Vietnam Pro và Literata tự lưu tại `public/fonts/`, kèm giấy phép OFL.
- Thanh trên căn giữa tên PDF, trạng thái kết nối dạng chấm có tooltip; menu tài khoản native popover hỗ trợ bàn phím.
- Nền bàn đọc xám, trang PDF có bóng nhẹ; chữ hỗ trợ tối thiểu 13px; điểm nhấn vàng cho lựa chọn và nút gửi.
- Trạng thái chat trống hướng dẫn chọn đoạn PDF. Focus rõ, tôn trọng reduced motion.
- Trang giới thiệu độc lập `/gioi-thieu.html`, liên kết đến trình đọc hiện có; không thay đổi định tuyến đăng nhập/email.
- Mobile cuộn trang để hiển thị đầy đủ phần chat và ô nhập.

## Kiểm thử

Playwright: 8/8 đạt ở chiều rộng thực 1920, 1280 và 390px; kiểm tra kích thước PNG, tràn ngang, cỡ chữ/tương phản của văn bản được hiển thị, focus, menu, dialog, chọn đoạn và câu trả lời AI giả. Đây là kiểm tra tự động có phạm vi, không phải chứng nhận toàn bộ WCAG.

Máy chủ kiểm thử dùng tài khoản và AI giả, không đọc `.env`, không gửi PDF tới Gemini và không kết nối MongoDB. Baseline được lấy từ Git tại `b17c449`; có thể đặt `UI_BASELINE_REF` để đổi mốc. PDF dùng `Kiểm thử/Test Case 9.pdf` nếu có, nếu không tự tạo mẫu tối giản.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\tmp\playwright-browsers"
npx playwright install chromium
npm run test:visual
```

Các cổng 3019, 5181 và 5182 phải trống. Playwright tự khởi động và dừng máy chủ kiểm thử. Chromium là trình duyệt được kiểm tra trong đợt này.

## Ảnh trước / sau

| Chiều rộng | Trước | Sau | Giới thiệu |
| --- | --- | --- | --- |
| 1920px | [Trước](before-1920.png) | [Sau](after-1920.png) | [Giới thiệu](introduction-1920.png) |
| 1280px | [Trước](before-1280.png) | [Sau](after-1280.png) | [Giới thiệu](introduction-1280.png) |
| 390px | [Trước](before-390.png) | [Sau](after-390.png) | [Giới thiệu](introduction-390.png) |

Trạng thái bổ sung: [Menu tài khoản](account-menu-1920.png), [Chọn đoạn](selection-1920.png), [Chat AI giả](chat-1920.png).


Cập nhật sau đợt thiết kế: yêu cầu đăng nhập đã áp dụng cho cả root `/`. Chức năng xóa tài khoản, quota chung và gateway production được bổ sung riêng, không thuộc phạm vi visual-only ban đầu. Xem `../READINESS_2026_11_24.md` để biết kiểm thử mới nhất. Có thể đặt `$env:UI_BROWSER='firefox'` hoặc `'webkit'` trước `npm run test:visual`; cần cài engine bằng Playwright. Ảnh của các engine đó nằm trong thư mục con tương ứng.
