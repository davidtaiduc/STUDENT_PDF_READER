# DAY 01 — PDF Viewer Foundation

## Mục tiêu của ngày
Xây nền móng cho trình đọc PDF trong trình duyệt. Cuối ngày, người dùng phải mở được PDF local, đọc, chuyển trang và zoom ổn định bằng PDF.js.

## Phạm vi cần hoàn thiện
- Vite + React + TypeScript chạy ổn định.
- Cài và cấu hình `pdfjs-dist`.
- PDF.js worker hoạt động đúng, không dùng fake worker.
- Mở được file PDF local từ máy.
- Render PDF bằng canvas.
- Hỗ trợ HiDPI / Retina.
- Có text layer để người dùng bôi đen text.
- Chuyển trang trước / sau.
- Zoom trong khoảng 50%–300%.
- Chỉ render một trang tại một thời điểm.
- PDF tiếng Việt hiển thị đúng.
- PDF scan vẫn render được dưới dạng hình ảnh.
- Không có TypeScript error.
- `npm run build` pass.
- `npm run lint` pass.

## Không làm trong Day 01
- AI / LLM.
- Ollama.
- OpenAI.
- OCR.
- IndexedDB.
- Notes / History.
- Floating toolbar.
- Translation / Explain / Ask AI.
- Backend.
- Login / Wallet / Payment.

## File chính cần kiểm tra
- `src/lib/pdf.ts`
- `src/components/PdfViewer/PdfViewer.tsx`
- `src/components/PdfViewer/PdfPage.tsx`
- `src/components/PdfViewer/PdfToolbar.tsx`
- `src/index.css`
- `src/App.tsx`

## Acceptance Criteria
- [ ] PDF loading: PASS
- [ ] PDF worker: PASS
- [ ] Canvas render: PASS
- [ ] Text layer: PASS
- [ ] Page navigation: PASS
- [ ] Zoom: PASS
- [ ] Vietnamese PDF: PASS
- [ ] Scanned PDF renders: PASS
- [ ] TypeScript build: PASS
- [ ] Lint: PASS
- [ ] No major console errors: PASS

## Manual Test
- Mở một PDF tiếng Việt.
- Mở một PDF hai cột.
- Mở một paper có công thức.
- Mở một PDF scan.
- Thử zoom: 50%, 100%, 200%, 300%.
- Thử Prev ở trang 1 và Next ở trang cuối.
- Thử bôi đen text sau khi zoom.

## Prompt kiểm thử cuối ngày
Hãy đọc `docs/DAY_01.md`, `git status`, `git diff` và các file source liên quan.

Chạy:
- `npm run build`
- `npm run lint`

Chỉ kiểm thử đúng phạm vi Day 01.
Không thêm tính năng mới.
Không commit, không push.

Cuối cùng trả về:
`DAY 01 STATUS`

Đánh dấu từng Acceptance Criteria là:
- PASS
- FAIL
- MANUAL TEST REQUIRED

Liệt kê lỗi tìm thấy, file liên quan và cách sửa đề xuất.

