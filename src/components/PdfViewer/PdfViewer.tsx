import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { pdfjsLib, pdfAssetBase } from "../../lib/pdf";
import PdfPage from "./PdfPage";
import PdfToolbar from "./PdfToolbar";
import { usePdfSelection } from "../../hooks/usePdfSelection";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const STEP = 0.1;
const round1 = (n: number) => Math.round(n * 10) / 10;

export default function PdfViewer() {
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const requestRef = useRef(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [documentVersion, setDocumentVersion] = useState(0);

  const viewerRef = useRef<HTMLDivElement>(null);
  const selectionScope = `${documentVersion}-${pdf?.fingerprints[0] ?? "empty"}-${currentPage}-${scale}`;
  const selection = usePdfSelection(viewerRef, selectionScope);

  async function handleOpenFile(file: File) {
    const request = ++requestRef.current;
    setDocumentVersion(request);
    const previousTask = loadingTaskRef.current;
    loadingTaskRef.current = null;
    setPdf(null);
    setLoading(true);
    setError(null);
    setFileName(file.name);
    try {
      await previousTask?.destroy();
      if (request !== requestRef.current) return;
      const data = await file.arrayBuffer();
      if (request !== requestRef.current) return;
      const task = pdfjsLib.getDocument({
        data,
        cMapUrl: `${pdfAssetBase}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${pdfAssetBase}standard_fonts/`,
        wasmUrl: `${pdfAssetBase}wasm/`,
      });
      loadingTaskRef.current = task;
      const document = await task.promise;
      if (request !== requestRef.current) return;
      setPdf(document);
      setCurrentPage(1);
      setScale(1.2);
    } catch (err) {
      if (request !== requestRef.current) return;
      console.error("PDF loading failed:", err);
      const failedTask = loadingTaskRef.current;
      loadingTaskRef.current = null;
      if (failedTask) void failedTask.destroy().catch(console.error);
      setError("Không mở được PDF. File có thể bị hỏng hoặc yêu cầu mật khẩu. Hãy thử file khác.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }

  useEffect(() => () => {
    ++requestRef.current;
    const task = loadingTaskRef.current;
    loadingTaskRef.current = null;
    if (task) void task.destroy().catch(console.error);
  }, []);

  const totalPages = pdf?.numPages ?? 0;
  return (
    <div className="viewer">
      <PdfToolbar currentPage={currentPage} totalPages={totalPages} scale={scale}
        onOpenFile={(file) => { void handleOpenFile(file); }}
        onPrev={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
        onZoomIn={() => setScale((value) => Math.min(MAX_SCALE, round1(value + STEP)))}
        onZoomOut={() => setScale((value) => Math.max(MIN_SCALE, round1(value - STEP)))} />
      <div className="document-name" title={fileName}>{fileName || "PDF chỉ được xử lý trên máy của bạn"}</div>
      <div className="viewer-scroll" ref={viewerRef} aria-busy={loading}>
        {loading && <p className="hint" role="status">Đang mở PDF…</p>}
        {error && <p className="hint error" role="alert">{error}</p>}
        {!loading && !error && !pdf && <p className="hint">Chọn “Mở PDF” để bắt đầu đọc tài liệu.</p>}
        {pdf && <PdfPage key={`${pdf.fingerprints[0]}-${currentPage}-${scale}`} pdf={pdf} pageNumber={currentPage} scale={scale} />}
      </div>
      <section className="selection-summary" aria-label="PDF selection" data-testid="pdf-selection">
        {selection ? <>
          <strong>{"Trang "}{selection.pageNumber}{" / "}{selection.text.length}{" k\u00fd t\u1ef1"}</strong>
          <p className="selection-text" data-testid="selected-text">{selection.text}</p>
          <small data-testid="selection-rect">
            x: {selection.rect.x.toFixed(1)}, y: {selection.rect.y.toFixed(1)},
            {" w: "}{selection.rect.width.toFixed(1)}, h: {selection.rect.height.toFixed(1)}
          </small>
        </> : <span>{"B\u00f4i \u0111en ch\u1eef trong PDF \u0111\u1ec3 xem l\u1ef1a ch\u1ecdn."}</span>}
      </section>
    </div>
  );
}
