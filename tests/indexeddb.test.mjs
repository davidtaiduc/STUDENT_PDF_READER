import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { putDocument, getDocument, saveEntry, listEntries, updateEntryNote, deleteEntry } from '../src/services/storage/studyStore.ts';

// This factory is RAM-only: no browser profile or real user records are touched.
globalThis.indexedDB = new IDBFactory();
after(() => { delete globalThis.indexedDB; });
const docA = 'a'.repeat(64), docB = 'b'.repeat(64);
const note = {pageNumber:2, selectedText:'Tiếng Việt ∫ f(x) dx', action:'note', result:'', note:'Ghi nhớ'};

test('metadata and history use content hash across a rename', async () => {
  await putDocument({hash:docA,name:'original.pdf',size:100,pageCount:3,lastOpenedAt:1});
  const saved = await saveEntry(docA,note);
  await putDocument({hash:docA,name:'renamed.pdf',size:100,pageCount:3,lastOpenedAt:2});
  assert.equal((await getDocument(docA)).name,'renamed.pdf');
  assert.equal((await getDocument(docA)).lastOpenedAt,2);
  assert.deepEqual((await listEntries(docA)).find(e=>e.id===saved.id),saved);
  assert.deepEqual(await listEntries(docB),[]);
});
test('CRUD updates note without altering result identity; deletion is scoped', async () => {
  const saved = await saveEntry(docB,{...note,action:'translate',result:'Kết quả',question:'Tại sao?',model:'qwen3:8b'});
  await updateEntryNote(docB,saved.id,'Chỉnh sửa');
  const updated = (await listEntries(docB)).find(e=>e.id===saved.id);
  assert.equal(updated.note,'Chỉnh sửa');
  for(const key of ['id','documentHash','selectedText','result','timestamp','question','model']) assert.equal(updated[key],saved[key]);
  await assert.rejects(updateEntryNote(docA,saved.id,'Wrong document'), /không thuộc/);
  await assert.rejects(deleteEntry(docA,saved.id), /không thuộc/);
  assert.equal((await listEntries(docB)).length,1);
  await deleteEntry(docB,saved.id);
  assert.deepEqual(await listEntries(docB),[]);
});
test('empty note update rejects and leaves committed note unchanged', async () => {
  const saved = await saveEntry(docB,note);
  await assert.rejects(updateEntryNote(docB,saved.id,'  '), /không được để trống/);
  assert.equal((await listEntries(docB))[0].note,'Ghi nhớ');
  await deleteEntry(docB,saved.id);
});
test('history sorts newest first', async (t) => {
  let now = 1000;
  t.mock.method(Date,'now',()=>now++);
  const first = await saveEntry(docB,note);
  const second = await saveEntry(docB,note);
  assert.deepEqual((await listEntries(docB)).map(e=>e.id),[second.id,first.id]);
  await deleteEntry(docB,first.id); await deleteEntry(docB,second.id);
});
test('quota failure rejects save without announcing a phantom saved entry', async (t) => {
  const mocked = t.mock.method(IDBObjectStore.prototype,'put',()=>{throw new DOMException('Quota exceeded','QuotaExceededError');});
  await assert.rejects(saveEntry(docB,note),{name:'QuotaExceededError'});
  mocked.mock.restore();
  assert.deepEqual(await listEntries(docB),[]);
});
test('request success followed by transaction abort does not resolve as saved', async (t) => {
  const originalPut = IDBObjectStore.prototype.put;
  const mocked = t.mock.method(IDBObjectStore.prototype,'put',function(...args) {
    const request = originalPut.apply(this,args);
    request.addEventListener('success',()=>this.transaction.abort(),{once:true});
    return request;
  });
  await assert.rejects(saveEntry(docB,note));
  mocked.mock.restore();
  assert.deepEqual(await listEntries(docB),[]);
});
test('blocked storage access fails cleanly, and opening can be retried', async (t) => {
  const fresh = await import('../src/services/storage/studyStore.ts?denied-access-test');
  const mocked = t.mock.method(globalThis.indexedDB,'open',()=>{throw new DOMException('Access denied','SecurityError');});
  await assert.rejects(fresh.listEntries(docB),{name:'SecurityError'});
  mocked.mock.restore();
  assert.deepEqual(await fresh.listEntries(docB),[]);
});
