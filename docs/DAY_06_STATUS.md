# DAY 06 STATUS

Date: 2026-11-02

Implemented SHA-256 PDF identity before PDF.js transfers the input buffer;
IndexedDB v1 documents/entries stores with a documentHash index; document
metadata; explicit saved notes and completed AI results; history by document;
copy, note editing, delete confirmation and page navigation from saved items.
Preserved the requested left-PDF/right-assistant layout. History remains mounted
across page/zoom changes; switching documents scopes storage and UI to the new ID.
Result/question/model/selected text/page/timestamp are stored as plain data.
Writes report success only after transaction completion. Storage failures display
messages instead of breaking PDF reading or AI use. No extra dependencies added.

## TEST PDF INVENTORY

Test Cases 1–6: FOUND. Additional Test Case 7: FOUND.
Browser checks used real Test Case 5 and a byte-identical renamed copy, plus a copy
of Test Case 6 bearing the name Test Case 5.pdf. Copies are in ignored
test-pdfs/day06-20261102/. Original files under Kiểm thử/ were not changed.

## Validation

- PASS: npm run build, npm run lint, npm test (24 tests).
- PASS: SHA-256 known digest and input-buffer retention.
- PASS: real PDF byte identity is unchanged by filename; different PDF bytes with
  the same filename yield different IDs (automated and browser checks).
- PASS: entry validation and preservation of Vietnamese, formulas, document ID,
  action, page, result, question/model and timestamp (automated).
- PASS: save selected-text note through actual IndexedDB; note count updates.
- PASS: edit note, reload app, reopen original PDF, recover edited text.
- PASS: renamed PDF restores that note; different-content PDF with the same name
  shows an empty separate history, then original restores its own entries.
- PASS: copy selected text and copy real translation match clipboard contents.
- PASS: real qwen3:8b translation, explanation and question/answer saved through UI.
- PASS: reload/reopen restores all four records (note + three AI action types).
- PASS: history remains while changing PDF pages; saved-page button navigates back.
- PASS: delete confirmation appears; Giữ lại cancels it and all records remain.
- PASS: final browser console error snapshot empty.

The four test records remain under real Test Case 5 for review. The real-fixture
unit test skips when local ignored PDFs are absent from a fresh checkout.

## Remaining coverage / limitations

- MANUAL TEST REQUIRED: complete delete/commit flow, storage quota/permission
  failures, concurrent tabs/version changes and mobile notes/history interaction.
- KNOWN LIMITATION: storage is browser/profile/origin-local, can be cleared or
  evicted, and has no cloud sync or export/backup. Reload requires manually
  reopening the PDF; its bytes are not persisted.
- KNOWN LIMITATION: no permanent PDF highlight/range restoration; history opens
  the saved page. Optional highlight scope was not implemented.
- KNOWN LIMITATION: AI may still over-explain surrounding context; math/code
  extraction and the Day 5 quality limitations remain unchanged.

Guide: [STUDY_STORAGE.md](STUDY_STORAGE.md). Preview: DAY_06_PREVIEW.jpg.
Vite remains running at http://127.0.0.1:5173, started this session.
No commit, push, publication or cloud integration performed.
