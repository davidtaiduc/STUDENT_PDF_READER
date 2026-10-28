# Day 1 verification

Build: PASS. Lint: PASS. npm install --offline --ignore-scripts: PASS.
Dev server: PASS. Initial UI and disabled controls: PASS in in-app browser.
Actual PDF acceptance remains UNVERIFIED: no test PDFs supplied in this repo.
Do not treat a successful build as proof of runtime worker/render/selection behavior.

Run the following in Chrome or Edge, with DevTools Console and Network open.
Place your real documents in test-pdfs/ if useful; do not commit private documents.

## two-column.pdf
- [ ] Opens via Open PDF; correct page count; canvas visible.
- [ ] Previous disabled on page 1; next disabled on final page.
- [ ] Zoom 50% through 300%, 10% steps; bound buttons disabled.
- [ ] Exactly one .pdf-page, canvas and .textLayer are mounted.
- [ ] Text spans exist; mouse selection follows visible words in both columns.
- [ ] Recheck selection after zoom and page changes; check HiDPI display.
- [ ] Network loads local pdf.worker*.mjs; DevTools Sources shows worker thread.
- [ ] No "Setting up fake worker" warning, resource 404 or console error.

## latex-paper.pdf
- [ ] Formula, mathematical symbols and fonts visible.
- [ ] Any requested /pdfjs/standard_fonts/, /pdfjs/cmaps/ or /pdfjs/wasm/ assets load.

## vietnamese.pdf
- [ ] Accents and Vietnamese characters render correctly.
- [ ] Selected/copied text matches displayed Vietnamese (subject to PDF encoding).

## scanned.pdf
- [ ] Image renders and zoom/navigation work.
- [ ] No text selection expected for image-only scan; no OCR is implemented.

## Long PDF (100-300 pages)
- [ ] Only current page rendered; navigation remains usable.
- [ ] Rapid page and zoom changes produce no canvas reuse/cancellation errors.

## Lifecycle and errors
- [ ] Open A then B quickly: only B wins, including when A is still loading.
- [ ] Reopen same file; successful document replaces previous one.
- [ ] Open invalid/corrupt/password PDF: visible error; another PDF still opens.
- [ ] Repeated file changes do not accumulate live document workers.
- [ ] At narrow viewport toolbar wraps and page scrolls horizontally/vertically.

## Visual Report selection regression
- [x] Reproduced page 1 right-margin selection jumping into the table before fix.
- [x] Same drag after TextLayerBuilder fix stays in the nearby two text lines.
- [x] Reverse drag into left margin stays in nearby paragraph.
- [x] Zoom 120 -> 130 -> 120 retains selection guard; no console errors captured.
- [ ] Manually explore all remaining pages, table cells and cross-column selections.
