# PDF TEST SUITE

Đây là bộ PDF kiểm thử cố định của project Student PDF Reader.

## Quy tắc bắt buộc

Mọi kiểm thử liên quan đến PDF phải sử dụng các PDF thật trong thư mục:

`Kiểm thử/`

Không tự sinh PDF test thay thế nếu file test thật tồn tại.

Hiện tại bộ kiểm thử gồm 6 file:

- `Kiểm thử/Test Case 1.pdf`
- `Kiểm thử/Test Case 2.pdf`
- `Kiểm thử/Test Case 3.pdf`
- `Kiểm thử/Test Case 4.pdf`
- `Kiểm thử/Test Case 5.pdf`
- `Kiểm thử/Test Case 6.pdf`

Nếu extension thực tế khác `.pdf`, hãy sử dụng đúng filename tìm thấy trong thư mục.

## Khi bắt đầu test

Trước tiên phải kiểm tra thư mục `Kiểm thử/`.

Báo cáo:

TEST PDF INVENTORY

Test Case 1: FOUND / MISSING
Test Case 2: FOUND / MISSING
Test Case 3: FOUND / MISSING
Test Case 4: FOUND / MISSING
Test Case 5: FOUND / MISSING
Test Case 6: FOUND / MISSING

Không được đoán nội dung file nếu chưa đọc hoặc chưa mở được file.

## Quy tắc PASS / FAIL

Chỉ sử dụng:

- PASS
- FAIL
- MANUAL TEST REQUIRED
- KNOWN LIMITATION

Không được đánh dấu PASS chỉ vì code nhìn có vẻ đúng.

Nếu không thể thao tác trình duyệt để xác nhận hành vi UI, phải ghi:

`MANUAL TEST REQUIRED`

## Phạm vi theo từng ngày

### Day 1
Kiểm tra:
- PDF loading
- PDF worker
- canvas
- text layer
- page navigation
- zoom
- PDF tiếng Việt
- PDF scan

### Day 2
Kiểm tra:
- text selection
- selected text
- pageNumber
- bounding rect
- multiline selection
- empty selection
- outside-PDF selection
- selection sau zoom

### Day 3
Kiểm tra:
- line break cleanup
- end-line hyphen
- preserve valid hyphen
- Unicode normalization
- tiếng Việt
- ký hiệu toán
- context trước/sau
- context limit
- reading order / two-column behavior

### Day 4+
Tiếp tục sử dụng chính 6 PDF này làm regression test.

Không sửa, đổi tên hoặc xóa các file trong `Kiểm thử/`.