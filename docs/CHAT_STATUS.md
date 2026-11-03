# Hội thoại Hỏi AI — 03/11/2026

Điều hướng mới: hai tab Trợ lý/AI ngang nhau; Lịch sử chuyển lên nút riêng bên phải tiêu đề.
StudySidebar điều khiển view chat và mở/đóng Lịch sử; SelectionAssistant giữ mounted cả hai view.
Browser fixture xác nhận mở AI, nhập draft, mở rồi đóng Lịch sử vẫn ở AI và draft còn nguyên.
75 tests/lint/build đạt. Không đổi storage/API. Ảnh ASSISTANT_AI_TABS_PREVIEW.png.

## Bố cục đoạn chọn và tác vụ (mới nhất)

Đã bỏ SelectionToolbar ở đầu panel. Luồng mới: xem đoạn tô đen → nút Dịch/Giải thích/Hỏi AI
ngay dưới đoạn → kết quả tạm bên dưới. Chọn nội dung/nguồn khác reset request và bỏ kết quả cũ,
hủy stream nếu còn chạy; không gọi mới. Key dựa trên nội dung/page/context/source nên mất highlight
khi focus, đổi zoom hoặc thay object hình học không tự reset. Hội thoại chat vẫn được giữ riêng.
Browser fixture xác nhận chọn mới hiện `A = B`, oldAnswers=0, tổng generate vẫn 1 sau một lần bấm Dịch.
75 tests/lint/build đạt. Ảnh EXCERPT_ACTIONS_PREVIEW.png. Quy tắc giữ kết quả tạm cũ ở ghi chú trước đã được thay thế.

Dịch/Giải thích không còn tự chạy khi có selection mới. SelectionAssistant chỉ chụp request
trong handler bấm nút, gắn id cho mỗi lần chạy; thay selection không thay request đang render.
AiPanel giữ mounted khi chuyển sang chat để tránh effect gọi AI lại khi quay về.
Browser fixture đếm generate: bấm Dịch → 1 call; đổi source → vẫn 1; bấm Giải thích → 2;
đổi source và chuyển qua chat/quay lại → vẫn 2. Không gọi Google thật. 75 tests/lint/build đạt.

Tên phiên mới mặc định là `Đoạn chat 1`, `Đoạn chat 2`, … theo số phiên đã lưu của PDF.
Người dùng bấm Đổi tên trong Lịch sử, nhập tên rồi Lưu tên; Hủy/Escape không ghi dữ liệu.
Tên được trim, không rỗng, tối đa 100 ký tự. Rename kiểm tra ID thuộc đúng PDF và chỉ sửa title,
không thay nội dung hay bản nháp; tên đã đổi vẫn được giữ qua autosave/archive tiếp theo.
Không tự đổi tên các phiên cũ. 75 tests/lint/build đạt (thêm test đánh số, rename, ownership, giới hạn tên).

## Lưu thành phiên và bắt đầu chat mới (quy ước mới nhất)

Nút **Lưu đoạn chat vào lịch sử** ghi nguyên transcript thành `ChatArchive`
`{id,title,savedAt,turns}` trong `archives` của record PDF, và xóa `turns` bản nháp
trong cùng một transaction. Không đổi version/schema object store; record cũ mặc định archives=[].
`saveChat` nay read-modify-write để giữ nguyên archives khi auto-save bản nháp mới.
UI chỉ dọn transcript sau transaction commit; nút bị khóa khi streaming/đang lưu, chống bấm lặp.
Autosave đang chờ được hủy trước lưu phiên; lỗi archive giữ nguyên transcript cho thử lại.
Chat mới có context rỗng, không tự gửi phiên đã cất lên Google.
Lịch sử nhóm theo phiên mới nhất trước, mở từng phiên để xem các lượt; count là số phiên.

74 tests, lint/build đạt. Test mới xác nhận archive + clear nguyên tử, abort giữ nguyên draft,
autosave tiếp theo không xóa archive, cô lập PDF và không lưu phiên rỗng/đang stream.
Browser mock: lưu phiên 3 lượt, khung chat về 0 lượt, Lịch sử thành 1 phiên có đủ 3 câu;
reload vẫn giữ phiên; câu hỏi mới được gửi với 0 lượt ngữ cảnh trước đó. Không gọi Gemini thật.
Các phần bên dưới ghi lại các bước triển khai trước, có quy ước count/lưu đã được thay thế ở trên.

## Lịch sử chỉ chứa chat

Tab Lịch sử đọc snapshot trực tiếp từ ChatPanel (bao gồm dữ liệu đã khôi phục từ IndexedDB),
hiển thị câu hỏi/câu trả lời/trang nguồn/trạng thái. Count là số lượt chat, cập nhật cả khi stream.
ChatPanel vẫn mounted khi xem Lịch sử để không abort stream. Dịch/Giải thích không có nút lưu;
đã bỏ các form lưu thủ công chat/đoạn chọn khỏi UI. Lịch sử vẫn có Copy và đến trang nguồn.
Không xóa database ghi chú cũ; chỉ ngừng đọc nó trong Lịch sử mới. Schema chat không đổi.
72 tests, lint và build đạt sau thay đổi.

## Sửa hiển thị đoạn PDF trong ô hỏi

`ChatExcerptPreview` hiển thị nguyên văn source ngay trên ô nhập, không chỉ số trang.
Đoạn chọn giữ lại khi người dùng click Hỏi AI/gõ câu hỏi/đổi trang. Chat cũng chạy được
ở chế độ tạm nếu documentHash null; thông báo không tự lưu thay vì render khung trống.
Không thay backend hoặc hook PDF selection trong bản sửa này.

QA trên giao diện thật tại port5177 với Test Case 2.pdf và API mock: tô đen `Năng`,
mở Hỏi AI, focus/gõ vào ô hỏi vẫn hiện `Năng`, nút Gửi được bật; gửi thành công,
đổi sang trang2 vẫn giữ đoạn nguồn trang1 và nhận xong phản hồi. Không gọi Google thật.
72 tests, lint, build PASS. Ảnh `PDF_CHAT_EXCERPT_PREVIEW.png`.

Hỏi AI đã chuyển từ một response bị thay thế sau mỗi câu hỏi sang transcript nhiều lượt.
`ChatPanel` được giữ mounted khi chuyển tác vụ, ghi snapshot local theo PDF SHA-256;
`SelectionAssistant` có nút Mở hội thoại đã lưu, dùng được ngay sau mở PDF mà không cần chọn chữ mới.
Muốn gửi câu hỏi mới vẫn cần một đoạn chọn (hoặc đoạn đã giữ lại trong phiên).

## Dữ liệu và ranh giới

- IndexedDB riêng `student-pdf-reader-chat` v1, `conversations` keyPath documentHash.
- Một transcript/PDF, mọi lượt giữ question, answer source, model, createdAt, đoạn nguồn/số trang và trạng thái/lỗi.
- Không lưu HTML, file PDF, secret hoặc hình học DOMRect; không thay schema `student-pdf-reader` cũ.
- Snapshot mỗi 500ms và flush khi unmount; IndexedDB transaction commit mới là thành công.
- Reload không tự gọi AI: loading/streaming được phục hồi thành stopped, giữ partial text đã lưu.
- Lỗi đọc không ghi đè dữ liệu cũ và chặn gửi đến khi tải được; lỗi ghi cho phép thử lưu lại.
- Chỉ local theo origin/profile. Xóa site data làm mất chat; chưa có user/cloud sync, nhiều phiên/PDF hay xóa hội thoại.
- Không chỉnh đồng thời cùng PDF ở nhiều tab: snapshot cuối có thể ghi đè snapshot trước.

## Hội thoại gửi Google

`POST /api/ai` nhận optional history `{question,answer}[]` cho ask. Client chỉ chọn các lượt ready,
tối đa 6 cặp/6.000 ký tự tổng, mỗi field tối đa 2.000 ký tự. Dữ liệu cũ vẫn giữ đầy đủ local.
Backend kiểm tra lại, loại các field role lạ, chuyển vào conversationHistory trong JSON user content.
Không cho client thêm system role; không đổi delimiter prompt hoặc Gemini adapter.
Translate/Explain không dùng history. Không có auto retry, cooldown vẫn áp dụng cho chat.
Retry giữ lượt lỗi/dừng cũ và thêm lượt mới để không mất nội dung.

## Kiểm chứng

- 69/69 tests PASS, lint/build PASS; 5 test mới về persistence, cô lập tài liệu, interrupted restore,
  giới hạn context/role injection, prompt data và HTTP validation trước quota/provider.
- Browser fixture riêng port5177, API mock port3007; không gọi Google/MongoDB và không sửa IndexedDB thật port5173.
- Đã gửi hai câu: lượt hai nhận 1 lượt context, lượt một vẫn hiển thị.
- Đổi nguồn trang1→2 giữ transcript; reload khôi phục cả hai lượt hoàn tất.
- Đã dừng stream, câu hỏi/partial answer còn nguyên và có nút Thử lại.
- Chưa kiểm thử Gemini live hoặc lặp toàn bộ PDF thật trong thay đổi này; prompt serialization được mock HTTP xác nhận.
- Mã fixture nằm trong tmp/ bị ignore. Ảnh minh chứng `CHAT_PREVIEW.png`.

Không commit/push/deploy; không đổi .env.

## Bổ sung nhận diện tô đen kết quả AI

`readAiSelection` chỉ nhận selection có hai đầu nằm trong cùng `.ai-answer` của sidebar,
được gắn số trang nguồn từ AiPanel/ChatPanel/HistoryPanel. Pointer-up hoặc key-up chụp
văn bản và tối đa 650 ký tự ngữ cảnh mỗi phía; không tự gọi API khi bôi đen.
SelectionAssistant giữ request đang hiển thị tách với vùng chọn mới, tránh remount/abort
chỉ vì người dùng tô đen. Khi bấm tác vụ mới, dùng đoạn AI đã chụp; chọn lại PDF sẽ bỏ ưu tiên AI.

Browser fixture đã xác nhận: chọn `Câu hỏi: Chậm` trong chat hiện banner 13 ký tự;
bấm Dịch gửi đúng source này thay vì `V = IR`; đổi lại nguồn PDF `A = B` xóa banner
và dùng nguồn PDF mới. Lint/build đạt; regression renderer thêm kiểm tra marker trang nguồn.
Không thay readPdfSelection hoặc chính sách backend. Công thức KaTeX dùng native browser selection;
chưa chuẩn hóa riêng việc sao chép công thức phức tạp thành LaTeX source.
