import type { DocumentRecord, StudyDraft, StudyEntry } from "../../types/study.ts";

let connection: Promise<IDBDatabase> | null = null;

function openStore(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open("student-pdf-reader", 1);
    let failed = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("documents", { keyPath: "hash" });
      const entries = db.createObjectStore("entries", { keyPath: "id" });
      entries.createIndex("documentHash", "documentHash");
    };
    request.onblocked = () => { failed = true; reject(new Error("Hãy đóng các tab StudyPDF cũ rồi thử lại.")); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (failed) { db.close(); return; }
      db.onversionchange = () => { db.close(); connection = null; };
      resolve(db);
    };
  });
  connection = connection.catch((error) => { connection = null; throw error; });
  return connection;
}

/** Resolve only after commit: request success alone does not mean durable save. */
async function run<T>(store: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Không thể lưu dữ liệu trong trình duyệt."));
    try {
      const request = operation(tx.objectStore(store));
      request.onsuccess = () => { result = request.result; };
    } catch (error) { tx.abort(); reject(error); }
  });
}

export async function putDocument(record: DocumentRecord): Promise<void> {
  await run("documents", "readwrite", (store) => store.put(record));
}

export function getDocument(hash: string): Promise<DocumentRecord | undefined> {
  return run("documents", "readonly", (store) => store.get(hash));
}

export function createStudyEntry(documentHash: string, draft: StudyDraft): StudyEntry {
  if (!/^[a-f0-9]{64}$/.test(documentHash)) throw new Error("Tài liệu chưa có mã nhận diện hợp lệ.");
  if (!Number.isInteger(draft.pageNumber) || draft.pageNumber < 1) throw new Error("Số trang không hợp lệ.");
  if (!draft.selectedText.trim() || draft.selectedText.length > 12000) throw new Error("Chọn đoạn văn từ 1 đến 12.000 ký tự để lưu.");
  if (!["note", "translate", "explain", "ask"].includes(draft.action)) throw new Error("Loại mục lưu không hợp lệ.");
  if (draft.note.length > 10000 || draft.result.length > 50000 || (draft.question?.length ?? 0) > 2000) throw new Error("Nội dung lưu quá dài.");
  if (draft.action === "note" ? !draft.note.trim() : !draft.result.trim()) throw new Error("Chưa có nội dung để lưu.");
  return { ...draft, note: draft.note.trim(), id: crypto.randomUUID(), documentHash, timestamp: Date.now() };
}

export async function saveEntry(documentHash: string, draft: StudyDraft): Promise<StudyEntry> {
  const record = createStudyEntry(documentHash, draft);
  await run("entries", "readwrite", (store) => store.put(record));
  return record;
}

export async function listEntries(documentHash: string): Promise<StudyEntry[]> {
  const records: StudyEntry[] = await run("entries", "readonly", (store) => store.index("documentHash").getAll(documentHash));
  return records.sort((a, b) => b.timestamp - a.timestamp);
}

async function changeEntry(documentHash: string, id: string, change: (entry: StudyEntry, store: IDBObjectStore) => void) {
  const db = await openStore();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("entries", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Không cập nhật được mục đã lưu."));
    const store = tx.objectStore("entries");
    const request = store.get(id);
    request.onsuccess = () => {
      try {
        const record: StudyEntry | undefined = request.result;
        if (!record || record.documentHash !== documentHash) throw new Error("Mục lưu không thuộc tài liệu này.");
        change(record, store);
      } catch (error) { tx.abort(); reject(error); }
    };
  });
}

export async function updateEntryNote(documentHash: string, id: string, note: string) {
  if (note.length > 10000) throw new Error("Ghi chú tối đa 10.000 ký tự.");
  await changeEntry(documentHash, id, (entry, store) => {
    if (entry.action === "note" && !note.trim()) throw new Error("Ghi chú không được để trống.");
    store.put({ ...entry, note: note.trim() });
  });
}

export async function deleteEntry(documentHash: string, id: string) {
  await changeEntry(documentHash, id, (entry, store) => { store.delete(entry.id); });
}
