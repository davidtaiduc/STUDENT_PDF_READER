import assert from 'node:assert/strict';
import {test} from 'node:test';
import {recentChatContext,validateChatContext} from '../shared/ai/chat.ts';
import {buildMessages} from '../backend/src/services/ai/prompts.ts';
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
