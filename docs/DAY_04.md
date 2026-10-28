# DAY 04 — Floating Toolbar & AI Panel

## Mục tiêu của ngày
Biến selection thành trải nghiệm tương tác: khi người dùng bôi đen text, hiện toolbar nổi và panel AI bên dưới.

## Phạm vi cần hoàn thiện
- Floating toolbar đặt gần vùng selection.
- Toolbar có 3 action:
  - Giải thích
  - Dịch
  - Hỏi AI
- Bottom AI panel.
- Hiển thị selected text.
- Hiển thị action đang chọn.
- Loading state.
- Error state.
- Đóng/mở panel.
- Selection mới cập nhật panel đúng.
- Toolbar không che quá nhiều nội dung PDF.
- UI responsive cơ bản.
- Chưa cần gọi AI thật: có thể dùng mock response.

## File gợi ý
- `src/components/SelectionToolbar/SelectionToolbar.tsx`
- `src/components/AiPanel/AiPanel.tsx`
- `src/types/ai.ts`
- `src/App.tsx` hoặc state store phù hợp

## Không làm trong Day 04
- Không OpenAI/Ollama thật.
- Không streaming thật.
- Không IndexedDB.
- Không notes/history.
- Không OCR.

## Acceptance Criteria
- [ ] Selection làm toolbar xuất hiện.
- [ ] Toolbar nằm gần selection.
- [ ] Có 3 action đúng.
- [ ] Click action mở/cập nhật AI panel.
- [ ] Selected text hiển thị đúng.
- [ ] Loading state hoạt động.
- [ ] Error state hoạt động.
- [ ] Selection mới cập nhật UI đúng.
- [ ] Toolbar đóng khi selection bị clear.
- [ ] Build pass.
- [ ] Lint pass.

## Manual Test
- Selection gần mép trên.
- Selection gần mép dưới.
- Selection gần mép trái/phải.
- Selection sau zoom.
- Selection nhiều dòng.
- Chuyển trang rồi tạo selection mới.

## Prompt kiểm thử cuối ngày
Hãy đọc `docs/DAY_04.md`, kiểm tra toolbar và AI panel.

Chưa gọi AI thật.
Dùng mock nếu cần.

Chạy:
- `npm run build`
- `npm run lint`

Kiểm tra positioning, state, loading/error và selection mới.

Không thêm feature ngoài Day 04.
Không commit, không push.

Trả về `DAY 04 STATUS`.
