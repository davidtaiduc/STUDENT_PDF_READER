import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { TextLayerBuilder } from "pdfjs-dist/web/pdf_viewer.mjs";

interface PdfPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

type Surface = { element: HTMLDivElement; width: number; dispose: () => void };

export default function PdfPage({ pdf, pageNumber, scale }: PdfPageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef<Surface | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    visibleRef.current?.dispose();
    visibleRef.current = null;
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let cancelled = false;
    let committed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayerBuilder | null = null;
    const surface = document.createElement("div");
    surface.className = "pdf-page-surface";
    const canvas = document.createElement("canvas");
    surface.append(canvas);
    const dispose = () => {
      textLayer?.cancel();
      surface.remove();
      canvas.width = 0;
      canvas.height = 0;
    };

    async function prepare() {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        wrap!.style.width = `${viewport.width}px`;
        wrap!.style.height = `${viewport.height}px`;
        // Reuse the completed surface while the splitter moves. Canvas and text
        // layer share one transform, keeping selection aligned with the page.
        const previous = visibleRef.current;
        if (previous) previous.element.style.transform = `scale(${viewport.width / previous.width})`;
        const draw = async () => {
          try {
            if (cancelled) return;
            const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(16_000_000 / (viewport.width * viewport.height)), 8192 / viewport.width, 8192 / viewport.height);
            surface.style.width = `${viewport.width}px`;
            surface.style.height = `${viewport.height}px`;
            surface.style.setProperty("--scale-factor", String(scale));
            surface.style.setProperty("--user-unit", String(page.userUnit));
            surface.style.setProperty("--total-scale-factor", String(scale * page.userUnit));
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
            textLayer = new TextLayerBuilder({ pdfPage: page });
            surface.append(textLayer.div);
            await textLayer.render({ viewport, images: undefined });
            if (cancelled) return;
            const old = visibleRef.current;
            wrap!.replaceChildren(surface);
            visibleRef.current = { element: surface, width: viewport.width, dispose };
            committed = true;
            old?.dispose();
            setError(null);
          } catch (err) {
            if (!cancelled) report(err);
          }
        };
        // Coalesce rapid resize/zoom updates; first paint remains immediate.
        if (previous) timer = setTimeout(() => { void draw(); }, 120);
        else await draw();
      } catch (err) {
        if (!cancelled) report(err);
      }
    }
    function report(err: unknown) {
      if (err instanceof Error && err.name === "RenderingCancelledException") return;
      console.error(`PDF page ${pageNumber}:`, err);
      setError("Không hiển thị được trang này. Hãy thử trang khác hoặc mở lại PDF.");
    }
    void prepare();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (!committed) {
          renderTask?.cancel();
        textLayer?.cancel();
        void (renderTask?.promise ?? Promise.resolve()).catch(() => {}).then(dispose);
      }
    };
  }, [pdf, pageNumber, scale]);

  return <>
    {error && <p className="hint error" role="alert">{error}</p>}
    <div className="pdf-page" data-page-number={pageNumber} ref={wrapRef} aria-label={`Trang PDF ${pageNumber}`} />
  </>;
}
