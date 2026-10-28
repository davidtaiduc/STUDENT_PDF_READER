# DAY 03 — Selection Cleanup & Context

## Mục tiêu của ngày
Biến text thô lấy từ PDF thành text sạch, dễ đọc và phù hợp để gửi cho AI; đồng thời lấy thêm ngữ cảnh xung quanh selection.

## Phạm vi cần hoàn thiện
- Chuẩn hóa Unicode.
- Loại khoảng trắng thừa.
- Nối dòng giữa câu.
- Xử lý từ bị gạch nối cuối dòng.
- Không phá các từ hợp lệ như `state-of-the-art`.
- Loại ký tự điều khiển / rác cơ bản.
- Giữ dấu tiếng Việt đúng.
- Lấy context trước selection khoảng 500–800 ký tự.
- Lấy context sau selection khoảng 500–800 ký tự.
- Không để context quá lớn.
- Cố gắng tránh dính cột bên cạnh trong PDF hai cột.
- Tách logic cleanup khỏi UI.

## File gợi ý
- `src/utils/normalizePdfSelection.ts`
- `src/utils/extractSelectionContext.ts`
- `src/types/selection.ts`

## Input / Output mẫu
Input:
```text
Machine learn-
ing is a sub-
field of artificial
intelligence.
```

Output:
```text
Machine learning is a subfield of artificial intelligence.
```

## Không làm trong Day 03
- Không gọi AI.
- Không tạo prompt AI hoàn chỉnh.
- Không OCR.
- Không lưu notes/history.

## Acceptance Criteria
- [ ] Line break cleanup hoạt động.
- [ ] Hyphen cuối dòng được xử lý hợp lý.
- [ ] Không phá hyphen hợp lệ giữa từ.
- [ ] Multiple spaces được chuẩn hóa.
- [ ] Unicode normalization đúng.
- [ ] Tiếng Việt không mất dấu.
- [ ] Context trước/sau lấy được.
- [ ] Context không quá lớn.
- [ ] PDF hai cột không bị dính text nghiêm trọng.
- [ ] Build pass.
- [ ] Lint pass.

## Bộ PDF test
- Sách hai cột.
- Paper LaTeX.
- PDF tiếng Việt.
- PDF có bảng.
- PDF scan: xác nhận chưa hỗ trợ text selection.

## Prompt kiểm thử cuối ngày
Hãy đọc `docs/DAY_03.md` và các utility liên quan.

Chạy build và lint.

Tạo test cases nhỏ cho:
- line break
- hyphen cuối dòng
- `state-of-the-art`
- multiple spaces
- tiếng Việt
- context trước/sau

Không thêm AI.
Không refactor lớn.
Không commit, không push.

Trả về `DAY 03 STATUS`.
