# StudyPDF AI - Day 1

Vite + React + TypeScript PDF viewer. Local files are processed in the browser.
No AI requests, OCR, backend, persistence, or selection event handlers.

## Run (PowerShell)

```powershell
Set-Location 'E:\New folder\student-pdf-reader'
npm.cmd install
npm.cmd run build
npm.cmd run lint
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://127.0.0.1:5173 in Chrome/Edge. Stop with Ctrl+C.
If a development server is already running on port 5173, use it instead of starting another.

## Implementation

- src/main.tsx: React StrictMode entry point.
- src/components/PdfViewer/PdfViewer.tsx: document loading, latest-request guard,
  loading-task destruction, current page, zoom, loading and errors.
- PdfPage.tsx: one page, HiDPI canvas, TextLayer, cancellation and isolated DOM
  per render effect (including StrictMode replay).
- PdfToolbar.tsx: previous/next bounds, zoom 50%-300% in 10% steps.
- src/lib/pdf.ts: bundled module worker and local PDF.js resources.
- public/pdfjs: CMaps, standard fonts, WASM and upstream license files copied
  from the installed pdfjs-dist package. Refresh these when upgrading pdfjs-dist.
- src/index.css: text-layer scale/alignment and responsive scrolling layout.

See TEST_CASES.md. No sample PDFs are bundled or fabricated.
