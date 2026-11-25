import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePageRange,validateContextScope,includesPage,MAX_PDF_BYTES} from '../shared/ai/contextScope.ts';
import {extractPageContext} from '../src/services/pdf/pageContext.ts';
import {buildMessages} from '../backend/src/services/ai/prompts.ts';
import {recentChatContext} from '../shared/ai/chat.ts';
test('page ranges allow large documents, deduplicate/sort and bound only requested context',()=>{
 assert.deepEqual(parsePageRange('250, 248-250, 1000',1250),[248,249,250,1000]);assert.ok(MAX_PDF_BYTES>0);
 for(const input of ['','0','1-6','9-2','2,3,4,5,6,7','1251','1e3','1,'])assert.throws(()=>parsePageRange(input,1250));
 assert.deepEqual(validateContextScope({kind:'pages',pages:[250,249]}),{kind:'pages',pages:[249,250]});
 for(const input of [{kind:'page',pages:[1,2]},{kind:'pages',pages:[1,1]},{kind:'all',pages:[1]},{kind:'pages',pages:[0]}])assert.throws(()=>validateContextScope(input));
});
test('text extraction touches only explicitly requested pages, no AI/network; scans/oversize/abort fail clearly',async t=>{
 let aiCalls=0;const calls=[];t.mock.method(globalThis,'fetch',async()=>{aiCalls++;throw new Error('unexpected');});
 const pdf={numPages:1250,getPage:async page=>{calls.push(page);return {getTextContent:async()=>({items:[{str:`Body of page ${page}`,hasEOL:true}]})};}};
 assert.equal(calls.length,0);const content=await extractPageContext(pdf,[250,251],new AbortController().signal);assert.deepEqual(calls,[250,251]);assert.match(content,/\[Trang 250\]/);assert.ok(!content.includes('page 249'));assert.equal(aiCalls,0);
 await assert.rejects(extractPageContext({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[]})})},[1],new AbortController().signal),/OCR/);
 await assert.rejects(extractPageContext({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:'x'.repeat(12001)}]})})},[1],new AbortController().signal),/ít trang hơn/);
 const abort=new AbortController();abort.abort();await assert.rejects(extractPageContext(pdf,[250],abort.signal));assert.equal(aiCalls,0);
});
test('AI scope is explicit, bounded history is independent of total saved transcript, insufficient context is instructed',()=>{
 const scope={kind:'page',pages:[250]},messages=buildMessages('ask',{cleanedText:'[Trang 250]\nOnly this',context:{before:'',after:''},scope},'Explain?');
 assert.deepEqual(JSON.parse(messages[1].content).scope,scope);assert.match(messages[0].content,/Nếu thực sự thiếu dữ kiện/);
 const recent=recentChatContext(Array.from({length:1000},()=>({question:'Q'.repeat(100),answer:'A'.repeat(1000)})));assert.ok(recent.length<=6);assert.ok(JSON.stringify(recent).length<6500);
});
