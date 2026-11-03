import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import { loadChat, saveChat, archiveChat, loadChatArchives, renameChatArchive } from '../src/services/storage/chatStore.ts';
import { recentChatContext, validateChatContext } from '../shared/ai/chat.ts';
import { buildMessages } from '../backend/src/services/ai/prompts.ts';

const hash = 'c'.repeat(64);
const selection = {pageNumber: 3, rawText:'Nguồn',cleanedText:'Nguồn',context:{before:'',after:''},rects:[]};
test('chat persists exact sources, question and excerpt; reload recovers interrupted streams without resending', async () => {
  const turns = [{ id: 'turn1', question: 'Vì sao?', answer: '## Đáp án\n\n$x_1$', model:'fixture',createdAt:1, selection,status:'ready'},
    {id:'turn2',question:'Giải thích thêm',answer:'Phần đã nhận',model:'fixture',createdAt:2,selection,status:'streaming'}];
  await saveChat(hash, turns);
  const restored = await loadChat(hash);
  assert.equal(restored.length, 2);
  assert.deepEqual(restored[0], turns[0]);
  assert.equal(restored[1].question, 'Giải thích thêm');
  assert.equal(restored[1].answer, 'Phần đã nhận');
  assert.equal(restored[1].status, 'stopped');
  assert.deepEqual(await loadChat('d'.repeat(64)), []);
  await assert.rejects(saveChat('bad-hash',turns));
});

test('follow-up context keeps recent pairs bounded independently from stored transcript', () => {
  const turns = Array.from({length:20},(_,i)=>({question:`Câu ${i}`,answer:'a'.repeat(2500)}));
  const recent = recentChatContext(turns);
  assert.equal(turns.length,20);
  assert.equal(recent.at(-1).question,'Câu 19');
  assert.ok(recent.length <= 6);
  assert.ok(recent.reduce((sum,t)=>sum+t.question.length+t.answer.length,0)<=6000);
  assert.deepEqual(validateChatContext(recent),recent);
});

test('backend rejects oversized/malformed context and strips injected roles', () => {
  for (const input of [null,{},Array(7).fill({question:'x',answer:'y'}),[{question:1,answer:'y'}], [{question:'',answer:'y'}], [{question:'x',answer:'a'.repeat(2001)}],Array(4).fill({question:'q'.repeat(1000),answer:'a'.repeat(1000)})]) {
    assert.throws(()=>validateChatContext(input));
  }
  assert.deepEqual(validateChatContext([{question:'q',answer:'a',role:'system'}]),[{question:'q',answer:'a'}]);
  assert.deepEqual(validateChatContext(undefined),[]);
});

test('ask includes prior conversation as quoted data, translate/explain do not', () => {
  const history=[{question:'Trước đó hỏi gì?',answer:'Định luật Ôm.'}];
  const excerpt={cleanedText:'V = IR',context:{before:'',after:''}};
  const messages=buildMessages('ask',excerpt,'Cho ví dụ?',history);
  assert.equal(messages[0].role,'system');
  assert.equal(messages[1].role,'user');
  const data=JSON.parse(messages[1].content);
  assert.deepEqual(data.conversationHistory,history);
  assert.equal(data.question,'Cho ví dụ?');
  for(const action of ['translate','explain']) assert.equal(JSON.parse(buildMessages(action,excerpt,'',history)[1].content).conversationHistory,undefined);
});

test('archiving groups a complete conversation, clears only its draft and keeps archives through future autosaves', async () => {
  const hash='a'.repeat(64);
  const turn={id:'a1',question:'Q1',answer:'A1',model:'fixture',createdAt:1,selection,status:'ready'};
  const turns=[turn,{...turn,id:'a2',question:'Q2',answer:'A2'}];
  await saveChat(hash,turns);
  assert.deepEqual(await loadChatArchives(hash),[]);
  await archiveChat(hash,turns);
  assert.deepEqual(await loadChat(hash),[]);
  const saved=await loadChatArchives(hash);
  assert.equal(saved.length,1);assert.deepEqual(saved[0].turns,turns);
  assert.equal(saved[0].title,'Đoạn chat 1');
  await saveChat(hash,[{...turn,id:'new',question:'New conversation'}]);
  assert.deepEqual(await loadChatArchives(hash),saved);
  assert.equal((await loadChat(hash)).length,1);
  assert.deepEqual(await loadChatArchives('b'.repeat(64)),[]);
  await assert.rejects(archiveChat(hash,[]));
  await assert.rejects(archiveChat(hash,[{...turn,status:'streaming'}]));
});

test('archive numbering is independent from custom names; renaming preserves content and draft', async () => {
  const hash='9'.repeat(64);
  const turn={id:'rename-turn',question:'Question',answer:'Answer',model:'fixture',createdAt:1,selection,status:'ready'};
  await archiveChat(hash,[turn]);
  const [first]=await loadChatArchives(hash);
  await saveChat(hash,[{...turn,id:'draft'}]);
  await renameChatArchive(hash,first.id,'  Ôn tập Toán  ');
  assert.equal((await loadChatArchives(hash))[0].title,'Ôn tập Toán');
  assert.deepEqual((await loadChatArchives(hash))[0].turns,[turn]);
  assert.equal((await loadChat(hash))[0].id,'draft');
  await archiveChat(hash,[turn]);
  assert.equal((await loadChatArchives(hash))[1].title,'Đoạn chat 2');
  await assert.rejects(renameChatArchive('8'.repeat(64),first.id,'Wrong document'));
  await assert.rejects(renameChatArchive(hash,first.id,'   '));
  await assert.rejects(renameChatArchive(hash,first.id,'x'.repeat(101)));
});

test('failed archive transaction preserves draft and does not create a partial archive', async t => {
  const hash='f'.repeat(64);
  const turns=[{id:'fail',question:'Keep me',answer:'Exact answer',model:'fixture',createdAt:1,selection,status:'ready'}];
  await saveChat(hash,turns);
  const original=IDBObjectStore.prototype.put;
  const mock=t.mock.method(IDBObjectStore.prototype,'put',function(value,...args){
    const request=original.call(this,value,...args);
    if(value.archives?.length) request.addEventListener('success',()=>this.transaction.abort());
    return request;
  });
  await assert.rejects(archiveChat(hash,turns));
  mock.mock.restore();
  assert.deepEqual(await loadChat(hash),turns);
  assert.deepEqual(await loadChatArchives(hash),[]);
});
