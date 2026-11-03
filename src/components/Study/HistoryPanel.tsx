import type { ChatArchive } from '../../services/storage/chatStore';
import { CopyButton } from './SaveEntryForm';
import AiResponse from '../AiPanel/AiResponse';
import { useState } from 'react';

function ArchiveNameEditor({ archive, onRename }: {
  archive: ChatArchive; onRename: (id: string, title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(archive.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!editing) return <button className="chat-rename" onClick={() => {
    setName(archive.title); setError(''); setEditing(true);
  }} aria-label={`Đổi tên ${archive.title}`}>Đổi tên</button>;
  return <form className="chat-rename-form" onSubmit={event => {
    event.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true); setError('');
    void onRename(archive.id, name).then(() => setEditing(false))
      .catch(() => setError('Không đổi tên được. Hãy thử lại.')).finally(() => setSaving(false));
  }}>
    <label>Tên đoạn chat<input autoFocus value={name} maxLength={100} disabled={saving}
      onChange={event => setName(event.target.value)} onKeyDown={event => {
        if (event.key === 'Escape' && !saving) { event.preventDefault(); setEditing(false); }
      }} /></label>
    <button disabled={saving || !name.trim()}>{saving ? 'Đang lưu…' : 'Lưu tên'}</button>
    <button type="button" disabled={saving} onClick={() => setEditing(false)}>Hủy</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

export default function HistoryPanel({ archives, loading, error, documentHash, onNavigate, onRename }: {
  archives: ChatArchive[]; loading: boolean; error: string; documentHash: string | null;
  onNavigate: (page: number) => void;
  onRename: (id: string, title: string) => Promise<void>;
}) {
  return <section className="history-panel" aria-label="Lịch sử hội thoại AI" data-testid="study-history">
    <p className="history-caption">Các cuộc hội thoại bạn đã lưu cho PDF này. Dịch và Giải thích là tác vụ tạm thời.</p>
    {!documentHash && <p>Hội thoại tạm chưa thể lưu lâu dài. Mở PDF để khôi phục hội thoại của tài liệu.</p>}
    {loading && <p role="status">Đang tải hội thoại…</p>}
    {error && <p role="alert">{error} Mở Trợ lý để thử tải lại.</p>}
    {!loading && !error && archives.length === 0 && <p>Chưa có hội thoại đã lưu. Trong Hỏi AI, bấm “Lưu đoạn chat vào lịch sử” để cất cuộc trò chuyện hiện tại.</p>}
    {[...archives].reverse().map(archive => <article className="history-item" key={archive.id}>
      <details>
        <summary>{archive.title}<small>{archive.turns.length} lượt hỏi · {new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short',
        }).format(archive.savedAt)}</small></summary>
    {archive.turns.map(turn => <article className="history-item" key={turn.id}>
      <details>
        <summary>{turn.question}<small>Trang {turn.selection.pageNumber} · {new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short',
        }).format(turn.createdAt)}</small></summary>
        <p><strong>Bạn: </strong>{turn.question}</p>
        <details><summary>Đoạn nguồn</summary><blockquote>{turn.selection.cleanedText}</blockquote></details>
        {turn.answer && <AiResponse action="ask" text={turn.answer} pageNumber={turn.selection.pageNumber} />}
        <small>{turn.status === 'ready' ? 'Đã hoàn tất' : turn.status === 'error' ? 'Yêu cầu chưa hoàn tất'
          : turn.status === 'stopped' ? 'Đã dừng · phản hồi chưa hoàn tất' : 'Đang nhận phản hồi…'}</small>
        <div className="study-actions">
          <button onClick={() => onNavigate(turn.selection.pageNumber)}>Đến trang {turn.selection.pageNumber}</button>
          <CopyButton text={turn.answer || turn.question} />
        </div>
      </details>
    </article>)}
      </details>
      <ArchiveNameEditor archive={archive} onRename={onRename} />
    </article>)}
  </section>;
}
