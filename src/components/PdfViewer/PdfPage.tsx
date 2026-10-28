import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { TextLayerBuilder } from "pdfjs-dist/web/pdf_viewer.mjs";

interface PdfPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

export default function PdfPage({ pdf, pageNumber, scale }: PdfPageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // Each effect owns its DOM: cancelled renders never reuse a live canvas.
    const canvas = document.createElement("canvas");
    const textDiv = document.createElement("div");
    textDiv.className = "textLayer";
    wrap.replaceChildren(canvas, textDiv);
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayerBuilder | null = null;
    const selectionController = new AbortController();

    async function renderPage() {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled || !wrap) return;
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        wrap.style.width = `${viewport.width}px`;
        wrap.style.height = `${viewport.height}px`;
        wrap.style.setProperty("--scale-factor", String(scale));
        wrap.style.setProperty("--user-unit", String(page.userUnit));
        wrap.style.setProperty("--total-scale-factor", String(scale * page.userUnit));
        canvas.width = Math.ceil(viewport.width * dpr);
        canvas.height = Math.ceil(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D is unavailable");
        renderTask = page.render({ canvas, canvasContext: context, viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
        await renderTask.promise;
        if (cancelled) return;
        // The official builder wraps TextLayer and stabilizes selection when
        // dragging through whitespace, including Chromium end-of-content handling.
        textLayer = new TextLayerBuilder({
          pdfPage: page,
          abortSignal: selectionController.signal,
        });
        textDiv.replaceWith(textLayer.div);
        await textLayer.render({ viewport, images: undefined });
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === "RenderingCancelledException")) return;
        console.error(`PDF page ${pageNumber}:`, err);
        setError("Không hiển thị được trang này. Hãy thử trang khác hoặc mở lại PDF.");
      }
    }
    void renderPage();
    return () => {
      cancelled = true;
      selectionController.abort();
      renderTask?.cancel();
      textLayer?.cancel();
      canvas.remove();
      textLayer?.div.remove();
      textDiv.remove();
    };
  }, [pdf, pageNumber, scale]);

  return <>
    {error && <p className="hint error" role="alert">{error}</p>}
    <div className="pdf-page" data-page-number={pageNumber} ref={wrapRef} aria-label={`Trang PDF ${pageNumber}`} />
  </>;
}
