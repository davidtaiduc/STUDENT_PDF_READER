import { useId, useState } from "react";
import type { SaveStudyEntry, StudyDraft } from "../../types/study";

export function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState("");
  return <span className="copy-control">
    <button onClick={async () => {
      try { await navigator.clipboard.writeText(text); setStatus("Đã sao chép."); }
      catch { setStatus("Không sao chép được. Hãy bôi đen và sao chép thủ công."); }
    }}>Sao chép</button>
    <small role="status">{status}</small>
  </span>;
}

export default function SaveEntryForm({ draft, onSave }: {
  draft: Omit<StudyDraft, "note">; onSave: SaveStudyEntry | null;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  return <form className="save-entry-form" onSubmit={(event) => {
    event.preventDefault();
    if (!onSave || saving || saved) return;
    setSaving(true); setStatus("");
    void onSave({ ...draft, note }).then(() => { setSaved(true); setStatus("Đã lưu trên máy. Xem trong Lịch sử."); })
      .catch((error: unknown) => setStatus(error instanceof DOMException
        ? "Không lưu được. Hãy kiểm tra dung lượng và quyền lưu trữ của trình duyệt."
        : error instanceof Error ? error.message : "Không lưu được. Hãy kiểm tra dung lượng trình duyệt."))
      .finally(() => setSaving(false));
  }}>
    <label htmlFor={id}>Ghi chú {draft.action === "note" ? "cho đoạn đã chọn" : "(tùy chọn)"}</label>
    <textarea id={id} value={note} maxLength={10000} rows={3} onChange={(event) => { setNote(event.target.value); setSaved(false); setStatus(""); }} placeholder="Viết điều bạn muốn ghi nhớ…" />
    <button disabled={!onSave || saving || saved || (draft.action === "note" && !note.trim())}>
      {saving ? "Đang lưu…" : saved ? "Đã lưu" : draft.action === "note" ? "Lưu ghi chú" : "Lưu kết quả"}
    </button>
    {!onSave && <small>Chức năng lưu chưa sẵn sàng. Bạn vẫn có thể sao chép văn bản.</small>}
    <p role="status">{status}</p>
  </form>;
}
