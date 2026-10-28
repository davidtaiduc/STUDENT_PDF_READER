import { useRef } from "react";

interface PdfToolbarProps {
  currentPage: number;
  totalPages: number;
  scale: number;
  onOpenFile: (file: File) => void;
  onPrev: () => void;
  onNext: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export default function PdfToolbar({
  currentPage,
  totalPages,
  scale,
  onOpenFile,
  onPrev,
  onNext,
  onZoomIn,
  onZoomOut,
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
      <span className="toolbar-text">
        Trang {hasPdf ? currentPage : 0} / {totalPages}
      </span>
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
    </div>
  );
}
