# DAY 02 — Text Selection

## Mục tiêu của ngày
Cho phép người dùng bôi đen text trong PDF và lấy được dữ liệu selection đủ chính xác để làm đầu vào cho toolbar và AI ở các ngày sau.

## Phạm vi cần hoàn thiện
- Bắt sự kiện selection trong vùng PDF.
- Lấy selected text.
- Xác định `pageNumber`.
- Lấy `DOMRect` / bounding box của selection.
- Xác định selection thuộc trang nào.
- Không lấy text ngoài PDF viewer.
- Xử lý selection rỗng.
- Xử lý chọn nhiều dòng.
- Xử lý selection thay đổi liên tục.
- Clear selection state khi người dùng click ra ngoài nếu phù hợp.
- Chuẩn bị kiểu dữ liệu selection dùng chung.

## Kiểu dữ liệu gợi ý
```ts
interface PdfSelection {
  text: string;
  pageNumber: number;
  rect: DOMRect;
}
```

## Không làm trong Day 02
- Không cleanup text sâu.
- Không lấy context trước/sau.
- Không gọi AI.
- Không tạo floating toolbar hoàn chỉnh.
- Không lưu history.
- Không OCR.

## File gợi ý
- `src/hooks/usePdfSelection.ts`
- `src/types/selection.ts`
- `src/components/PdfViewer/PdfPage.tsx`
- `src/components/PdfViewer/PdfViewer.tsx`

## Acceptance Criteria
- [ ] Có thể bôi đen text trong PDF.
- [ ] Lấy đúng selected text.
- [ ] Lấy đúng page number.
- [ ] Lấy được bounding rect.
- [ ] Selection ngoài PDF không bị nhận nhầm.
- [ ] Selection rỗng không tạo state lỗi.
- [ ] Chọn nhiều dòng không crash.
- [ ] Zoom không làm selection logic hỏng.
- [ ] Build pass.
- [ ] Lint pass.

## Manual Test
- Chọn 1 từ.
- Chọn 1 câu.
- Chọn nhiều dòng.
- Chọn text sau khi zoom.
- Chọn text ở trang đầu và trang cuối.
- Chọn text ngoài viewer để kiểm tra app có bỏ qua không.

## Prompt kiểm thử cuối ngày
Hãy đọc `docs/DAY_02.md`, `git diff` và các file selection liên quan.

Chạy:
- `npm run build`
- `npm run lint`

Kiểm tra:
- selected text
- pageNumber
- bounding rect
- selection rỗng
- selection ngoài PDF
- selection sau zoom

Không thêm feature mới.
Không commit, không push.

Trả về `DAY 02 STATUS` và đánh dấu từng Acceptance Criteria là PASS / FAIL / MANUAL TEST REQUIRED.
