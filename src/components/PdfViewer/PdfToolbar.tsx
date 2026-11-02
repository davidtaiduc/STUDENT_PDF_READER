import { useRef, useState } from "react";

interface PdfToolbarProps {
  currentPage: number;
  totalPages: number;
  scale: number;
  onOpenFile: (file: File) => void;
  onPrev: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
}

function PageNumber({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (page: number) => void;
}) {
  const [value, setValue] = useState(String(totalPages ? currentPage : 0));
  const [error, setError] = useState("");
  const commit = (restoreInvalid: boolean) => {
    const page = /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
    if (!Number.isSafeInteger(page) || page < 1 || page > totalPages) {
      setError(`Nhập số trang từ 1 đến ${totalPages}.`);
      if (restoreInvalid) setValue(String(currentPage));
      return;
    }
    setValue(String(page)); setError("");
    if (page !== currentPage) onPageChange(page);
  };
  return <span className="page-number-control">
    <span className="toolbar-text page-indicator">
      <label>Trang <input aria-label="Số trang" type="text" inputMode="numeric" maxLength={10}
        value={value} disabled={!totalPages} aria-invalid={!!error} aria-describedby={error ? 'page-number-error' : undefined}
        title="Nhập số trang rồi nhấn Enter" style={{ width: `${Math.max(2, String(totalPages).length, value.length)}ch` }}
        onFocus={event => event.currentTarget.select()}
        onChange={event => { setValue(event.target.value); setError(""); }}
        onBlur={() => { if (totalPages) commit(true); }}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); commit(false); }
          if (event.key === 'Escape') { event.preventDefault(); setValue(String(currentPage)); setError(""); }
        }} /></label>
      <span> / {totalPages}</span>
    </span>
    {error && <span id="page-number-error" className="page-number-error" role="alert">{error}</span>}
  </span>;
}

export default function PdfToolbar({
  currentPage,
  totalPages,
  scale,
  onOpenFile,
  onPrev,
  onNext,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onFitWidth,
}: PdfToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasPdf = totalPages > 0;

  return (
    <div className="toolbar" role="toolbar" aria-label="Điều khiển PDF">
      <button onClick={() => inputRef.current?.click()}>Mở PDF</button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onOpenFile(file);
          e.target.value = ""; // cho phép chọn lại cùng một file
        }}
      />

      <span className="toolbar-sep" />

      <button aria-label="Trang trước" onClick={onPrev} disabled={!hasPdf || currentPage <= 1}>
        ←
      </button>
      <PageNumber key={`${currentPage}-${totalPages}`} currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      <button aria-label="Trang sau" onClick={onNext} disabled={!hasPdf || currentPage >= totalPages}>
        →
      </button>

      <span className="toolbar-sep" />

      <button aria-label="Thu nhỏ" onClick={onZoomOut} disabled={!hasPdf || scale <= 0.5}>
        −
      </button>
      <span className="toolbar-text">{Math.round(scale * 100)}%</span>
      <button aria-label="Phóng to" onClick={onZoomIn} disabled={!hasPdf || scale >= 3}>
        +
      </button>
      <button onClick={onFitWidth} disabled={!hasPdf}>Vừa chiều rộng</button>
    </div>
  );
}
