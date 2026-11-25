import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildMessages} from '../backend/src/services/ai/prompts.ts';
const empty={cleanedText:'',context:{before:'hidden text',after:'hidden text'}};
test('general chat accepts no PDF, retains follow-ups and excludes unsupplied context',()=>{
 const history=[{question:'Tôi đang học phương trình.',answer:'Bạn muốn hỏi phần nào?'}];
 const messages=buildMessages('ask',empty,'Giải 2x + 3 = 7.',history),data=JSON.parse(messages[1].content);
 assert.equal(data.selectedText,'');assert.equal(data.contextBefore,'');assert.equal(data.contextAfter,'');assert.deepEqual(data.conversationHistory,history);assert.equal(data.question,'Giải 2x + 3 = 7.');
 assert.match(messages[0].content,/không từ chối chỉ vì PDF không có đáp án/);assert.match(messages[0].content,/Phân biệt rõ dữ kiện/);assert.match(messages[0].content,/không giới hạn kiến thức/);
 assert.throws(()=>buildMessages('ask',empty,''));assert.throws(()=>buildMessages('translate',empty,'Dịch'));assert.throws(()=>buildMessages('explain',empty,'Giải thích'));
});
test('button actions remain narrowly scoped and ignore chat requests and history',()=>{
 const source={cleanedText:'Solve 2x + 3 = 7.',context:{before:'',after:''}};
 for(const action of ['translate','explain']){
  const messages=buildMessages(action,source,'Solve the equation fully',[{question:'Solve',answer:'x=2'}]),data=JSON.parse(messages[1].content);
  assert.equal(data.question,undefined);assert.equal(data.conversationHistory,undefined);assert.match(messages[0].content,/không.*giải bài/);
 }
});


test('math questions must preserve uncertain recognized coefficients and separate equations',()=>{
 const messages=buildMessages('ask',{cleanedText:'0.5x-15y=1 -x+3y=2',context:{before:'Nội dung được nhận dạng từ ảnh',after:''}},'Làm câu này');
 assert.equal(JSON.parse(messages[1].content).selectedText,'0.5x-15y=1 -x+3y=2');
 assert.match(messages[0].content,/15y không được đổi thành 1.5y/);
 assert.match(messages[0].content,/hỏi người dùng xác nhận/);
 assert.match(messages[0].content,/mỗi phương trình trên một dòng riêng/);
});
