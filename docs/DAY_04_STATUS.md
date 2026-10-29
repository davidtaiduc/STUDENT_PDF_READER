# DAY 04 STATUS

Date: 2026-10-30

Implemented floating toolbar (Giải thích / Dịch / Hỏi AI), viewport clamping,
offscreen hiding, bottom AI panel, selected cleaned text, question input,
mock loading/response/error/retry, and panel close/reopen through selection.
New selections replace the active excerpt and reset the response/question.
Panel captures the excerpt when keyboard focus clears the native selection.
Scope changes (file/page/zoom) unmount the assistant and cancel pending timers.
No real AI, streaming, OCR, storage, commit or push.

## TEST PDF INVENTORY

- Test Case 1: FOUND
- Test Case 2: FOUND
- Test Case 3: FOUND
- Test Case 4: FOUND
- Test Case 5: FOUND
- Test Case 6: FOUND

All six files are present under Kiểm thử/. Browser testing used Test Case 1.pdf.

## Validation

- PASS: npm run build (outside sandbox; asset sync requires filesystem access).
- PASS: npm run lint.
- PASS: 11 existing cleanup/context/ordering tests.
- PASS: real-PDF selection shows toolbar and all three actions open their modes.
- PASS: multiline selection replaces excerpt in an already open panel.
- PASS: question entry retains excerpt; mock submission produces a response.
- PASS: loading, simulated error, retry, successful explanation response.
- PASS: close panel; open again from toolbar.
- PASS: toolbar clears with native selection collapse during question input.
- PASS: zoom to 130% and page navigation reset assistant; fresh selections work.
- PASS: responsive toolbar/panel observed at 390 x 844; viewport override reset.
- MANUAL TEST REQUIRED: exhaustive top/bottom/left/right edge placement,
  long selections, file replacement during loading, and Test Cases 2–6.
- KNOWN LIMITATION: mock responses are placeholders, not actual explanations
  or translations. PDF retains horizontal scrolling on narrow screens.

Development server: http://127.0.0.1:5173 (session started for this task).
Preview: DAY_04_PREVIEW.jpg.
