import type { PdfSelection } from '../../types/selection.ts';
import type { AiErrorCode } from '../../../shared/ai/errors.ts';

export type ChatExcerpt = Pick<PdfSelection, 'pageNumber' | 'cleanedText' | 'context'>;
export interface ChatTurn {
  id: string; question: string; answer: string; model: string; createdAt: number;
  selection: ChatExcerpt;
  status: 'loading' | 'streaming' | 'ready' | 'stopped' | 'error';
  error?: { message: string; code: AiErrorCode; retryable: boolean; retryAt: number };
}
export interface ChatArchive { id: string; title: string; savedAt: number; turns: ChatTurn[]; }
interface ConversationRecord { documentHash: string; turns: ChatTurn[]; archives?: ChatArchive[]; }
let connection: Promise<IDBDatabase> | null = null;
function openChat(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('student-pdf-reader-chat', 1);
    let failed = false;
    request.onupgradeneeded = () => request.result.createObjectStore('conversations', { keyPath: 'documentHash' });
    request.onerror = () => reject(request.error);
    request.onblocked = () => { failed = true; reject(new Error('Hãy đóng tab StudyPDF cũ rồi mở lại.')); };
    request.onsuccess = () => {
      const db = request.result;
      if (failed) { db.close(); return; }
      db.onversionchange = () => { db.close(); connection = null; };
      resolve(db);
    };
  }).catch(error => { connection = null; throw error; });
  return connection;
}
async function access<T>(hash: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Tài liệu chưa sẵn sàng để lưu hội thoại.');
  const db = await openChat();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('conversations', mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Không lưu được hội thoại.'));
    try {
      const request = operation(tx.objectStore('conversations'));
      request.onsuccess = () => { result = request.result; };
    } catch (error) { tx.abort(); reject(error); }
  });
}
export async function loadChat(hash: string): Promise<ChatTurn[]> {
  const record = await access<ConversationRecord | undefined>(hash, 'readonly', store => store.get(hash));
  return (record?.turns ?? []).map(turn => ({ ...turn,
    status: turn.status === 'loading' || turn.status === 'streaming' ? 'stopped' : turn.status }));
}
export async function saveChat(hash: string, turns: ChatTurn[]): Promise<void> {
  await updateConversation(hash, record => ({ ...record, turns }));
}

export async function loadChatArchives(hash: string): Promise<ChatArchive[]> {
  const record = await access<ConversationRecord | undefined>(hash, 'readonly', store => store.get(hash));
  return record?.archives ?? [];
}

async function updateConversation(hash: string, change: (record: ConversationRecord) => ConversationRecord): Promise<ConversationRecord> {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Tài liệu chưa sẵn sàng để lưu hội thoại.');
  const db = await openChat();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('conversations', 'readwrite');
    let result: ConversationRecord;
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Không lưu được hội thoại.'));
    const store = tx.objectStore('conversations');
    const request = store.get(hash);
    request.onsuccess = () => {
      try {
        result = change(request.result ?? { documentHash: hash, turns: [] });
        store.put(result);
      } catch (error) { tx.abort(); reject(error); }
    };
  });
}

/** Archive and clear the draft in ONE transaction: never clear before commit. */
export async function archiveChat(hash: string, turns: ChatTurn[]): Promise<ChatArchive[]> {
  if (!turns.length || turns.some(turn => turn.status === 'loading' || turn.status === 'streaming')) {
    throw new Error('Hãy đợi phản hồi hoàn tất hoặc dừng trước khi lưu hội thoại.');
  }
  const archive: ChatArchive = { id: crypto.randomUUID(), title: '', savedAt: Date.now(), turns };
  const record = await updateConversation(hash, record => ({
    ...record, turns: [], archives: [...(record.archives ?? []), { ...archive, title: `Đoạn chat ${(record.archives?.length ?? 0) + 1}` }],
  }));
  return record.archives ?? [];
}

export async function renameChatArchive(hash: string, id: string, title: string): Promise<ChatArchive[]> {
  const name = title.trim();
  if (!name || name.length > 100) throw new Error('Tên đoạn chat cần từ 1 đến 100 ký tự.');
  const record = await updateConversation(hash, record => {
    if (!record.archives?.some(archive => archive.id === id)) throw new Error('Không tìm thấy đoạn chat trong tài liệu này.');
    return { ...record, archives: record.archives.map(archive => archive.id === id ? { ...archive, title: name } : archive) };
  });
  return record.archives ?? [];
}
