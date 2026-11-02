import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { hashPdf } from '../src/services/storage/hashPdf.ts';
import { createStudyEntry } from '../src/services/storage/studyStore.ts';

const bytes = text => new TextEncoder().encode(text).buffer;
const hash = 'a'.repeat(64);
const draft = { pageNumber: 2, selectedText: 'Tiếng Việt: E = mc²', action: 'note', result: '', note: '  Cần nhớ công thức.  ' };

test('SHA-256 matches known digest and does not detach input', async () => {
  const input = bytes('abc');
  assert.equal(await hashPdf(input), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(input.byteLength, 3);
});
test('real PDF identity survives rename; same-name different PDF is isolated', async (t) => {
  let a, b;
  try {
    a = await readFile(new URL('../Kiểm thử/Test Case 5.pdf', import.meta.url));
    b = await readFile(new URL('../Kiểm thử/Test Case 6.pdf', import.meta.url));
  } catch (error) {
    if (error.code === 'ENOENT') { t.skip('Local real PDF fixtures are not bundled in Git.'); return; }
    throw error;
  }
  const original = new File([a], 'Test Case 5.pdf');
  const renamed = new File([a], 'Renamed.pdf');
  const collision = new File([b], 'Test Case 5.pdf');
  assert.equal(await hashPdf(await original.arrayBuffer()), await hashPdf(await renamed.arrayBuffer()));
  assert.notEqual(await hashPdf(await original.arrayBuffer()), await hashPdf(await collision.arrayBuffer()));
});
test('saved entries retain exact excerpt, result, question, model and document ID', () => {
  for (const action of ['translate', 'explain', 'ask', 'note']) {
    const record = createStudyEntry(hash, {...draft, action, result: action === 'note' ? '' : 'Kết quả ∫ f(x) dx', question: 'Tại sao?', model: 'qwen3:8b'});
    assert.equal(record.documentHash, hash);
    assert.equal(record.selectedText, draft.selectedText);
    assert.equal(record.pageNumber, 2);
    assert.equal(record.note, 'Cần nhớ công thức.');
    assert.equal(record.question, 'Tại sao?');
    assert.equal(record.model, 'qwen3:8b');
    assert.match(record.id, /^[a-f0-9-]{36}$/);
    assert.ok(record.timestamp <= Date.now());
  }
  assert.notEqual(createStudyEntry(hash, draft).id, createStudyEntry(hash, draft).id);
});
test('rejects malformed identity, pages and empty/oversized study content', () => {
  assert.throws(() => createStudyEntry('filename.pdf', draft), /nhận diện/);
  for (const pageNumber of [0,-1,1.5,NaN]) assert.throws(() => createStudyEntry(hash,{...draft,pageNumber}), /Số trang/);
  assert.throws(() => createStudyEntry(hash,{...draft,selectedText:' '}), /Chọn đoạn/);
  assert.throws(() => createStudyEntry(hash,{...draft,selectedText:'x'.repeat(12001)}), /Chọn đoạn/);
  assert.throws(() => createStudyEntry(hash,{...draft,note:' '}), /Chưa có nội dung/);
  assert.throws(() => createStudyEntry(hash,{...draft,action:'translate',result:''}), /Chưa có nội dung/);
  assert.throws(() => createStudyEntry(hash,{...draft,note:'x'.repeat(10001)}), /quá dài/);
  assert.throws(() => createStudyEntry(hash,{...draft,action:'unexpected'}), /Loại mục/);
});
