# Session handoff

Date: 2026-10-28
Project: E:\New folder\student-pdf-reader
Scope: Day 1 PDF viewer foundation only.

Implemented: restored truncated PdfViewer, added missing main entry point,
latest-request guards/loading-task cleanup, isolated render DOM with cancellation,
HiDPI canvas and TextLayer scale variables, zoom bounds, local PDF.js resources,
responsive UI and test checklist.

Validation: install (offline, scripts disabled), build and lint pass; development
server starts and initial UI loads. Real PDF fixtures are absent; runtime worker,
selection alignment, Vietnamese/scan/long-PDF checks await manual verification.

Git: directory is not a Git repository. No init/branch/commit/push performed.
Original files and unified diff retained under this Codex chat workspace.

Active development server: http://127.0.0.1:5173 (started by this chat).
Stop this session's server when user says finished for today; do not stop unrelated node processes.

## Selection fix verification
- Added standalone PDF.js --scale-round-x/y defaults and explicit overlay stacking/hit testing.
- Tested D:/May in/Windows 8_Notice.pdf in browser (actual folder name has Vietnamese accents).
- TextLayer contains 25 spans; one canvas is mounted.
- Mouse drag returns selected text; highlight visible over rendered text.
- Selection also works after zoom from 120% to 130%.
- Browser console: no errors/warnings captured during this test.
- Build and lint: PASS.

## Report PDF selection regression (2026-10-29)
Reproduced on D:/Tai lieu in/Bao Cao Cong Nghe Visual Report.pdf, page 1, 120%.
Before: dragging the first paragraph slightly into the right margin selected 890
characters extending into the following table. After: same drag selected 197
characters near the pointer (two lines), without jumping to the table.
Reverse drag across the left margin also stayed within the nearby paragraph.
Zoom 120 -> 130 -> 120: one end-of-content guard remained, no console errors.

PdfPage now uses the official PDF.js TextLayerBuilder, which wraps TextLayer
and adds end-of-content / selection stabilization and copy normalization.
Its event listeners are aborted and builder cancelled during effect cleanup.
No AI, floating toolbar, OCR, or selection-to-AI integration added.
Build and lint: PASS. Complex table/cross-column reading order still depends
on the source PDF; not all page layouts are certified by this regression.
