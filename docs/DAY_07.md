# DAY 07 — QA, Polish & Deploy

## Mục tiêu của ngày
Hoàn thiện MVP đủ ổn định để đưa cho 5–10 người dùng thật sử dụng thử.

## Phạm vi cần hoàn thiện
- Chạy toàn bộ build/lint/test.
- Test PDF loading.
- Test worker.
- Test text layer.
- Test selection.
- Test cleanup/context.
- Test toolbar.
- Test AI panel.
- Test Ollama streaming.
- Test notes/history.
- Test PDF dài 100–300 trang.
- Test PDF hai cột.
- Test PDF tiếng Việt.
- Test paper có công thức.
- Test PDF scan để xác nhận limitation.
- Kiểm tra console errors.
- Sửa UI nhỏ.
- Responsive cơ bản.
- Viết hướng dẫn sử dụng ngắn.
- Deploy bản web.
- Chuẩn bị form feedback.

## Luồng MVP cuối cùng
```text
Mở PDF
→ bôi đen
→ Giải thích / Dịch / Hỏi AI
→ kết quả stream ở panel
→ lưu local
→ mở lại PDF vẫn thấy dữ liệu cũ
```

## Không làm trong Day 07
- Không OCR.
- Không region image selection.
- Không Anki.
- Không account.
- Không wallet/payment.
- Không `.exe`.
- Không Tauri/Electron.
- Không dịch toàn bộ PDF.
- Không mở rộng scope nếu chưa cần.

## Acceptance Criteria
- [ ] Build: PASS
- [ ] Lint: PASS
- [ ] PDF viewer: PASS
- [ ] Text selection: PASS
- [ ] Selection cleanup: PASS
- [ ] Context extraction: PASS
- [ ] Toolbar: PASS
- [ ] AI panel: PASS
- [ ] Ollama integration: PASS
- [ ] Streaming: PASS
- [ ] Local history: PASS
- [ ] Notes: PASS
- [ ] Long PDF: PASS
- [ ] Two-column PDF: PASS / KNOWN LIMITATION DOCUMENTED
- [ ] Vietnamese PDF: PASS
- [ ] Formula PDF: PASS / KNOWN LIMITATION DOCUMENTED
- [ ] Scanned PDF: KNOWN LIMITATION DOCUMENTED
- [ ] No critical console errors
- [ ] User guide ready
- [ ] Deploy ready

## Tester Feedback cần thu thập
- Dịch hay Giải thích được dùng nhiều hơn?
- Toolbar có dễ dùng không?
- Selection có thường bị sai không?
- AI trả lời có đủ nhanh không?
- Người dùng có lưu note/history không?
- Họ có muốn OCR/chọn vùng ảnh không?
- Họ có muốn desktop app không?

## Prompt kiểm thử cuối ngày
Hãy đọc toàn bộ:
- `docs/DAY_01.md` đến `docs/DAY_07.md`
- `git status`
- `git diff`
- các module chính của project

Chạy:
- `npm run build`
- `npm run lint`
- test script nếu có

Kiểm thử toàn bộ MVP theo acceptance criteria của Day 07.

Không thêm tính năng mới.
Chỉ sửa bug có thể tái hiện hoặc lỗi blocking.
Không commit, không push.

Trả về báo cáo:

PROJECT CHECK STATUS

Build:
Lint:
Tests:
PDF Viewer:
Selection:
Cleanup:
Context:
Toolbar:
AI:
Streaming:
Storage:
Notes:
Performance:
Security:

Sau đó:
- ISSUES FOUND
- MANUAL TESTS REQUIRED
- FINAL VERDICT: READY / READY WITH MINOR ISSUES / NOT READY
