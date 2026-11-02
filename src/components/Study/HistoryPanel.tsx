import { useState } from "react";
import { actionLabels } from "../../types/ai";
import type { StudyEntry } from "../../types/study";
import { CopyButton } from "./SaveEntryForm";

function HistoryItem({ entry, onNavigate, onUpdate, onDelete }: {
  entry: StudyEntry; onNavigate: (page: number) => void;
  onUpdate: (id: string, note: string) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(entry.note);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const perform = (operation: () => Promise<void>) => {
    setBusy(true); setError("");
    void operation().then(() => { setEditing(false); setConfirmDelete(false); })
      .catch(() => setError("Không cập nhật được. Hãy thử lại."))
      .finally(() => setBusy(false));
  };
  return <article className="history-item">
    <details>
      <summary>{entry.action === "note" ? "Ghi chú" : actionLabels[entry.action]} · Trang {entry.pageNumber}
        <small>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }).format(entry.timestamp)}</small>
      </summary>
      <blockquote>{entry.selectedText}</blockquote>
      {entry.question && <p><strong>Câu hỏi: </strong>{entry.question}</p>}
      {entry.result && <div className="ai-answer">{entry.result}</div>}
      {entry.note && !editing && <p className="saved-note"><strong>Ghi chú: </strong>{entry.note}</p>}
      {entry.model && <small>Model: {entry.model}</small>}
      <div className="study-actions">
        <button onClick={() => onNavigate(entry.pageNumber)}>Đến trang {entry.pageNumber}</button>
        <CopyButton text={entry.result || entry.note || entry.selectedText} />
        <button disabled={busy} onClick={() => { setNote(entry.note); setEditing(true); }}>Sửa ghi chú</button>
      </div>
      {editing && <form onSubmit={(event) => { event.preventDefault(); perform(() => onUpdate(entry.id, note)); }}>
        <label>Chỉnh sửa ghi chú<textarea value={note} maxLength={10000} rows={3} onChange={(event) => setNote(event.target.value)} /></label>
        <button disabled={busy || (entry.action === "note" && !note.trim())}>Lưu thay đổi</button>
        <button type="button" disabled={busy} onClick={() => setEditing(false)}>Hủy</button>
      </form>}
      {confirmDelete ? <div className="delete-confirm">
        <p>Xóa mục đã lưu này? Thao tác không thể hoàn tác.</p>
        <button disabled={busy} onClick={() => perform(() => onDelete(entry.id))}>Xác nhận xóa</button>
        <button disabled={busy} onClick={() => setConfirmDelete(false)}>Giữ lại</button>
      </div> : <button className="delete-entry" disabled={busy} onClick={() => setConfirmDelete(true)}>Xóa mục</button>}
      {error && <p role="alert">{error}</p>}
    </details>
  </article>;
}

export default function HistoryPanel({ entries, loading, error, documentHash, onReload, onNavigate, onUpdate, onDelete }: {
  entries: StudyEntry[]; loading: boolean; error: string; documentHash: string | null;
  onReload: () => void; onNavigate: (page: number) => void;
  onUpdate: (id: string, note: string) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  return <section className="history-panel" aria-label="Lịch sử tài liệu" data-testid="study-history">
    <p className="history-caption">Ghi chú và kết quả bạn đã lưu cho PDF này. Dữ liệu chỉ nằm trong trình duyệt hiện tại.</p>
    {loading && entries.length > 0 && <p role="status">Đang cập nhật lịch sử…</p>}
    {!documentHash ? <p>Mở một PDF để xem lịch sử của tài liệu.</p>
      : loading && entries.length === 0 ? <p role="status">Đang tải lịch sử…</p>
        : error ? <div><p role="alert">{error}</p><button onClick={onReload}>Thử tải lại</button></div>
          : entries.length === 0 ? <p>Chưa có mục nào. Chọn một đoạn để lưu ghi chú hoặc kết quả AI.</p>
            : entries.map((entry) => <HistoryItem key={entry.id} entry={entry} onNavigate={onNavigate} onUpdate={onUpdate} onDelete={onDelete} />)}
  </section>;
}
