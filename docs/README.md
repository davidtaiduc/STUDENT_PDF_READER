# Tài liệu Student PDF Reader

Đọc [README chính](../README.md) và [AGENTS.md](../AGENTS.md) trước khi tiếp quản. README chính là bản đồ kiến trúc, lệnh chạy và hợp đồng dữ liệu hiện tại. Các tài liệu Day là lịch sử phát triển, không phải cấu hình runtime mới nhất.

## Tài liệu hiện tại

- [Backend](../backend/README.md), [Shared](../shared/README.md): ranh giới và cấu trúc mã.
- [Gemini setup](GEMINI_SETUP.md): cấu hình `.env`, AI và MongoDB.
- [Study storage](STUDY_STORAGE.md): ghi chú/lịch sử IndexedDB.
- [PDF navigation](PDF_NAVIGATION_FIX.md): giữ bài giải khi chuyển trang/zoom, sửa số trang trực tiếp.
- [AI migration status](GEMINI_MIGRATION_STATUS.md): nhật ký cập nhật Gemini; đọc mục mới trước mục cũ.
- [Git/hosting](GIT_HOSTING.md): CI đã chuẩn bị, giới hạn Preview tĩnh và phần triển khai còn thiếu.
- [PDF suite](TEST_PDF_SUITE.md): quy tắc fixture; kiểm kê lại file thật, PDF riêng không có trong Git.

## Tài liệu lịch sử

Ollama không còn là runtime AI. Các đề cập Ollama, floating toolbar hoặc `server/` trong kế hoạch Day phản ánh thiết kế cũ; không tự khôi phục chúng. Khi dùng checklist cũ, đối chiếu README và mã hiện tại rồi điều chỉnh phạm vi test.

## Roadmap
- Day 01: PDF Viewer Foundation
- Day 02: Text Selection
- Day 03: Selection Cleanup & Context
- Day 04: Floating Toolbar & AI Panel
- Day 05: AI Integration & Streaming
- Day 06: Local Storage, Notes & History
- Day 07: QA, Polish & Deploy
