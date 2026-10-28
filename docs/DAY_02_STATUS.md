# DAY 02 STATUS

Implemented per docs/DAY_02.md. Scope: raw PDF selection only.

## Acceptance

| Criterion | Status |
| --- | --- |
| Select PDF text | PASS |
| Capture selected text | PASS |
| Correct PDF page number | PASS |
| Bounding rectangle | PASS |
| Ignore selection outside PDF | PASS |
| Empty selection safe | PASS |
| Multiline selection does not crash | PASS |
| Selection after zoom | PASS |
| Build | PASS |
| Lint | PASS |

## Evidence and limits

Tested in the in-app Chromium browser with the user's four-page Vietnamese
Visual Report PDF. A single word matched native Selection.toString() exactly.
A three-line selection captured 305 characters matching the browser selection;
its bounding box was x=337.1, y=350.2, w=591.5, h=50.0 CSS pixels.
Selected text after zoom 120% -> 130% still matched the native selection.
Selecting in the AI Assistant outside the PDF cleared the captured state.
Page 4 selection returned pageNumber=4 (independent of printed page labels).
Page changes cleared the old snapshot. A single click collapsed the range and
returned null state. No console errors/warnings observed during those tests.
A document-version key invalidates selection even when reopening the same PDF.

Coordinates use viewport CSS pixels; scroll/resize schedule a fresh reading.
Selection updates are coalesced with requestAnimationFrame. Both endpoints
must belong to the same text layer inside the viewer. Raw text is preserved;
trim is used only to detect an empty/whitespace-only selection.

Manual testing on the user's standalone Chrome/Edge remains recommended for
keyboard selection, unusual PDFs and complex columns. No claim is made about
semantic reading order or normalized text: those remain out of Day 2 scope.

## Files

- src/types/selection.ts: shared PdfSelection with rect and fragment rects.
- src/hooks/usePdfSelection.ts: validated range reader and lifecycle/event hook.
- PdfPage.tsx: data-page-number marker.
- PdfViewer.tsx: scoped state and selection preview.
- src/index.css: bounded, scrollable preview styling.

No AI, OCR, context extraction, deep text cleanup, floating toolbar or history.
No branch, commit or push performed.

## Repeat checks (PowerShell)

```powershell
Set-Location 'E:\New folder\student-pdf-reader'
npm.cmd run build
npm.cmd run lint
```

Use the existing http://127.0.0.1:5173 development server, reload and open the
PDF. Select a word, sentence and multiple lines; check the preview, page and
rectangle. Zoom and select again; navigate to the last page; select outside
PDF and click to collapse the selection.

## Test Case 6 follow-up
- Confirmed subtitle exists as the last text-layer span despite its visual position near the top.
- Before fix Ctrl+A selected the application, correctly rejected as outside PDF.
- Ctrl+A while focused in the PDF text layer now selects only the current page.
- Test Case 6 page 1: 1366 captured characters; target subtitle included;
  captured text equals native Selection.toString(); bounding union encloses subtitle.
- Geometry now measures selected text-node fragments, excluding element/container
  rectangles such as PDF.js endOfContent guards.
- Selecting a word in the subtitle still matches native text with a small rect.
- Build/lint: PASS. Visual-order drag normalization remains outside Day 2 scope.

## Visual-order follow-up
Selected text now repairs displaced wide blocks using text-fragment coordinates.
Raw browser text remains available as PdfSelection.rawText; text is the display
value. Text-layer DOM and native highlight behavior are unchanged. This is a
conservative wide-block repair, not complete semantic layout reconstruction.

Test Case 6: subtitle appears immediately below title, before publication metadata.
Verified no non-whitespace characters lost/added compared with native selection.
Single-word and multiline selections still equal native text; bounds remain valid.
Ctrl+A after zoom also yields correct subtitle order. Outside selection is ignored,
and changing pages clears state. No console errors in these checks.
Five pure regression tests cover displaced subtitle, word/partial selection,
normal lines, two-column order and table cells. All pass; build/lint pass.
Complex real-world column/table layouts beyond this sample remain to be explored.
