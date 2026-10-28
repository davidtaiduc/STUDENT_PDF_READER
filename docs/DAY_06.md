# DAY 06 — Local Storage, Notes & History

## Mục tiêu của ngày
Lưu dữ liệu học tập local-first để khi người dùng mở lại cùng PDF, app nhận ra tài liệu và hiển thị lịch sử/ghi chú cũ.

## Phạm vi cần hoàn thiện
- Hash PDF bằng SHA-256.
- Không dùng tên file làm ID chính.
- IndexedDB cho dữ liệu local.
- Lưu document metadata.
- Lưu selected text.
- Lưu translation.
- Lưu explanation.
- Lưu note.
- Lưu timestamp.
- History panel đơn giản.
- Mở lại cùng PDF theo hash và load dữ liệu cũ.
- Nút Copy.
- Nút Save.
- Nếu kịp: highlight đơn giản.

## Data gợi ý
```ts
interface DocumentRecord {
  hash: string;
  name: string;
  size: number;
  pageCount: number;
  lastOpenedAt: number;
}
```

History item nên có:
- documentHash
- pageNumber
- selectedText
- action
- result
- timestamp

## Không làm trong Day 06
- Không cloud sync.
- Không account.
- Không Supabase.
- Không payment.
- Không OCR.

## Acceptance Criteria
- [ ] Tính được SHA-256 của PDF.
- [ ] Cùng file cho cùng document ID.
- [ ] File khác cùng tên không bị nhầm.
- [ ] IndexedDB lưu được dữ liệu.
- [ ] Mở lại PDF load được history.
- [ ] Save note hoạt động.
- [ ] Copy hoạt động.
- [ ] Không mất dữ liệu sau refresh.
- [ ] Build pass.
- [ ] Lint pass.

## Manual Test
- Mở PDF A, lưu note.
- Reload.
- Mở lại PDF A.
- Kiểm tra note/history.
- Đổi tên PDF A rồi mở lại: hash vẫn nhận đúng.
- Tạo PDF B cùng tên: không được nhận nhầm.

## Prompt kiểm thử cuối ngày
Hãy đọc `docs/DAY_06.md` và các module IndexedDB/hash/history.

Chạy build + lint.

Kiểm tra:
- SHA-256
- document identity
- IndexedDB CRUD
- reload persistence
- cùng tên nhưng khác file
- copy/save note

Không thêm cloud sync/account.
Không commit, không push.

Trả về `DAY 06 STATUS`.
