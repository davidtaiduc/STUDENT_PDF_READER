import { useEffect, useState } from "react";
import type { PdfSelection } from "../../types/selection";
import type { StudyDraft, StudyEntry } from "../../types/study";
import { deleteEntry, listEntries, saveEntry, updateEntryNote } from "../../services/storage/studyStore";
import SelectionAssistant from "../AiPanel/SelectionAssistant";
import HistoryPanel from "./HistoryPanel";

export default function StudySidebar({ documentHash, selection, fileName, onNavigate }: {
  documentHash: string | null; selection: PdfSelection | null;
  fileName: string; onNavigate: (page: number) => void;
}) {
  const [view, setView] = useState<"assistant" | "history">("assistant");
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ hash: string; revision: number; entries: StudyEntry[]; error: string } | null>(null);
  useEffect(() => {
    if (!documentHash) return;
    let active = true;
    void listEntries(documentHash).then((entries) => {
      if (active) setSnapshot({ hash: documentHash, revision, entries, error: "" });
    }).catch(() => {
      if (active) setSnapshot({ hash: documentHash, revision, entries: [], error: "Không đọc được dữ liệu đã lưu. Kiểm tra quyền lưu trữ và dung lượng trình duyệt." });
    });
    return () => { active = false; };
  }, [documentHash, revision]);
  const current = snapshot?.hash === documentHash ? snapshot : null;
  const entries = current?.entries ?? [];
  const onSave = documentHash && !current?.error ? async (draft: StudyDraft) => {
    await saveEntry(documentHash, draft);
    setRevision((n) => n + 1);
  } : null;
  return <aside className="assistant-sidebar" aria-label="Dịch và ghi chú" data-selection-controls>
    <header className="assistant-header">
      <h1>Dịch & trợ lý AI</h1>
      <p title={fileName}>{fileName || "Chọn đoạn văn bên trái để bắt đầu."}</p>
    </header>
    <nav className="study-tabs" aria-label="Không gian học tập">
      <button aria-pressed={view === "assistant"} onClick={() => setView("assistant")}>Trợ lý</button>
      <button aria-pressed={view === "history"} onClick={() => setView("history")}>Lịch sử ({entries.length})</button>
    </nav>
    {current?.error && view === "assistant" && <p className="storage-warning" role="status">{current.error} Mở Lịch sử để thử tải lại.</p>}
    <div className="assistant-view" hidden={view !== "assistant"}>
      {/* The parent resets this sidebar only when opening a document. Page/zoom
          changes clear the native highlight, but retain the active lesson. */}
      <SelectionAssistant selection={selection} onSave={onSave} />
    </div>
    {view === "history" && <HistoryPanel documentHash={documentHash} entries={entries}
      loading={!!documentHash && (!current || current.revision !== revision)} error={current?.error ?? ""}
      onReload={() => setRevision((n) => n + 1)} onNavigate={onNavigate}
      onUpdate={async (id, note) => { if (documentHash) { await updateEntryNote(documentHash, id, note); setRevision((n) => n + 1); } }}
      onDelete={async (id) => { if (documentHash) { await deleteEntry(documentHash, id); setRevision((n) => n + 1); } }} />}
  </aside>;
}
