import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { pdfjsLib, pdfAssetBase } from "../../lib/pdf";
import PdfPage from "./PdfPage";
import PdfToolbar from "./PdfToolbar";
import { usePdfSelection } from "../../hooks/usePdfSelection";
import SelectionAssistant from "../AiPanel/SelectionAssistant";

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

  function fittedScale(pageWidth: number) {
    const root = viewerRef.current;
    if (!root || !pageWidth) return 1.2;
    const style = getComputedStyle(root);
    const available = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.floor(available / pageWidth * 100) / 100));
  }

  function handleFitWidth() {
    const page = viewerRef.current?.querySelector<HTMLElement>(".pdf-page");
    if (page?.offsetWidth) setScale(fittedScale(parseFloat(page.style.width) / scale));
  }

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
      const firstPage = await document.getPage(1);
      if (request !== requestRef.current) return;
      setPdf(document);
      setCurrentPage(1);
      setScale(Math.min(1.2, fittedScale(firstPage.getViewport({ scale: 1 }).width)));
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
    <div className="reader-workspace">
      <section className="viewer" aria-label="Tài liệu PDF">
      <PdfToolbar currentPage={currentPage} totalPages={totalPages} scale={scale}
        onOpenFile={(file) => { void handleOpenFile(file); }}
        onPrev={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
        onZoomIn={() => setScale((value) => Math.min(MAX_SCALE, round1(value + STEP)))}
        onZoomOut={() => setScale((value) => Math.max(MIN_SCALE, round1(value - STEP)))}
        onFitWidth={handleFitWidth} />
      <div className="document-name" title={fileName}>{fileName || "PDF chỉ được xử lý trên máy của bạn"}</div>
      <div className="viewer-scroll" ref={viewerRef} aria-busy={loading}>
        {loading && <p className="hint" role="status">Đang mở PDF…</p>}
        {error && <p className="hint error" role="alert">{error}</p>}
        {!loading && !error && !pdf && <p className="hint">Chọn “Mở PDF” để bắt đầu đọc tài liệu.</p>}
        {pdf && <PdfPage key={`${pdf.fingerprints[0]}-${currentPage}-${scale}`} pdf={pdf} pageNumber={currentPage} scale={scale} />}
      </div>
      </section>
      <SelectionAssistant key={selectionScope} selection={selection} />
    </div>
  );
}
