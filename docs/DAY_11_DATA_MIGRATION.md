# Day 11 — dữ liệu local và legacy

## Schema v2

student-pdf-reader v1 có documents(hash) và entries(id,index documentHash). student-pdf-reader-chat v1 có conversations(documentHash), gồm draft và archives. Records cũ không có ownerScope, nên không thể xác định tài khoản sở hữu từ schema.

Upgrade lên v2 chỉ tạo stores scoped_documents([ownerScope,hash]), scoped_entries([ownerScope,id], index ownerDocument=[ownerScope,documentHash]), scoped_conversations([ownerScope,documentHash]) và legacy_imports trong mỗi DB. Giữ nguyên mọi store và record cũ, không chạy copy trong onupgradeneeded. Không đổi hash PDF.

Scope hợp lệ: guest hoặc user:<24 hex Mongo user id>. Storage service yêu cầu scope tường minh; không có default guest. Frontend lấy scope từ trạng thái session đã được server xác nhận. Đây là logical namespace, không encryption/security boundary chống DevTools hoặc same-origin malware.

## Chính sách mặc định

- Không xóa dữ liệu cũ, không gán cho user đang login hoặc tài khoản vừa tạo.
- Legacy records không hiện trong các scoped queries. Thấy danh sách mới trống không có nghĩa là dữ liệu nguồn đã bị xóa.
- Vùng guest cũng bắt đầu riêng; dữ liệu cũ không âm thầm trở thành guest.
- Đăng xuất chuyển vùng sau xác nhận backend, không xóa IndexedDB. User khác không đọc/đổi/xóa records bằng ID ngoài scope qua các luồng ứng dụng.
- Checking/offline chưa xác nhận: khóa sidebar, không đoán guest. PDF local vẫn đọc được.

## Import có chủ đích

Day 11 có **API import, chưa có nút UI**. Không chạy import thay người dùng. Khi người dùng đã review/backup và chủ động muốn nhận legacy vào guest, hai API trong src/services/storage/legacy.ts là:

- importLegacyStudyToGuest('IMPORT_LEGACY_TO_GUEST')
- importLegacyChatToGuest('IMPORT_LEGACY_TO_GUEST')

Không nhận tham số userId hoặc user scope: các hàm này chỉ import vào guest, không nhận dữ liệu cho tài khoản. Không tự chuyển từ guest sang user.

Mỗi API dùng một readwrite transaction gồm stores nguồn, đích và marker trong cùng DB. Chỉ copy records không có ownerScope; add() không overwrite. Đích xung đột thì toàn bộ import của DB đó abort, nguồn/đích/marker không đổi. Nếu có conflict, người dùng cần review và backup hai phía; không xóa hay ghi đè tự động để giải quyết.

Marker guest-v1 chỉ commit cùng dữ liệu copy. Gọi lại sau thành công trả alreadyImported=true, không copy lặp kể cả reload. Lỗi/abort trước commit không để lại marker; có thể retry. Hai database không có transaction chung: import notes thành công nhưng chat lỗi thì retry chat, import notes sẽ skip nhờ marker. Không tuyên bố atomic xuyên hai DB.

Sau import, các store nguồn vẫn nguyên vẹn. Không có bước xóa legacy trong Day 11. Import mới chỉ là một lần chụp dữ liệu legacy, không liên tục theo dõi các bản app cũ. Đóng các tab app cũ khi bị blocked upgrade; không dùng bản cũ để sửa dữ liệu song song.

## Kiểm thử đã chạy

fake-indexeddb tạo schema v1 và legacy source thật trong bộ test, sau đó upgrade v2:

- Source records còn nguyên, không tự hiện trong guest/A/B.
- Scoped note/metadata/chat CRUD riêng, delete/update ID sai scope bị chặn.
- Fresh module đọc lại đúng scope (reload), state checking/offline không thành guest.
- Write/read cũ giữ namespace đã chụp, không chuyển sang scope mới.
- Import không xác nhận bị từ chối; ép abort transaction thì rollback dữ liệu và marker; retry thành công, gọi lại idempotent; nguồn không bị xóa.

Đây là test database RAM-only, không đọc/sửa IndexedDB profile thật của người dùng. Browser QA riêng origin 5181 có guest/A/B notes, archives và quota fixture; không migrate/import dữ liệu của origin ứng dụng 5173.
