import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { readSse } from '../shared/ai/sse.ts';
import { streamGemini } from '../src/services/ai/gemini.ts';
import { generateGemini } from '../backend/src/services/ai/gemini.ts';
import { createApi as buildApi } from '../backend/src/app.ts';
import { appTokenAuthenticator } from '../backend/src/auth/appToken.ts';
const testToken = 'test-token-012345678901234567890123';
const createApi = options => buildApi({ aiConfigured: true,
  getHealth: async () => ({ service: 'student-pdf-reader-api', database: 'connected', ai: { configured: true }, accounts: { enabled: false } }), ...options });
import { consumeCounter } from '../backend/src/services/usage/quota.ts';
import { buildMessages } from '../backend/src/services/ai/prompts.ts';

const signal = () => new AbortController().signal;
const encoder = new TextEncoder();
const frame = value => `data: ${JSON.stringify(value)}\n\n`;
const body = parts => new ReadableStream({start(c) { for (const part of parts) c.enqueue(typeof part === 'string' ? encoder.encode(part) : part); c.close(); }});
const excerpt = { cleanedText: 'Tiếng Việt: E = mc²; ∫ f(x) dx.', context: { before: 'a'.repeat(900), after: 'b'.repeat(900) } };

test('prompts preserve formulas, bound context and validate questions', () => {
  for (const action of ['translate', 'explain', 'ask']) {
    const messages = buildMessages(action, excerpt, 'Ý nghĩa là gì?');
    const payload = JSON.parse(messages[1].content);
    assert.equal(payload.selectedText, excerpt.cleanedText);
    assert.equal(payload.contextBefore.length, 650);
    assert.equal(payload.contextAfter.length, 650);
    assert.match(messages[0].content, /Giữ nguyên công thức/);
    assert.equal(payload.question, action === 'ask' ? 'Ý nghĩa là gì?' : undefined);
  }
  assert.throws(() => buildMessages('explain', {...excerpt, cleanedText:' '}));
  assert.throws(() => buildMessages('explain', {...excerpt, cleanedText:'x'.repeat(12001)}));
  assert.throws(() => buildMessages('ask', excerpt));
  assert.throws(() => buildMessages('ask', excerpt, 'x'.repeat(2001)));
});

test('SSE handles single-byte UTF8, CRLF, comments and multiline data', async () => {
  const bytes = encoder.encode(': ping\r\ndata: Tiếng Việt ∫\r\ndata: = ²\r\n\r\n');
  const result = [];
  await readSse(body(Array.from(bytes, b => new Uint8Array([b]))), signal(), s => { result.push(s); });
  assert.deepEqual(result, ['Tiếng Việt ∫\n= ²']);
});

test('aborting a stalled SSE stream cancels the reader', async () => {
  let cancelled = false;
  const controller = new AbortController();
  const running = readSse(new ReadableStream({cancel() {cancelled = true;}}), controller.signal, () => assert.fail());
  controller.abort();
  await assert.rejects(running, {name:'AbortError'});
  assert.equal(cancelled, true);
});

test('Gemini adapter uses server key, stateless interactions and only final output text', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse');
    assert.equal(init.headers['x-goog-api-key'], 'server-only-test-key');
    const payload = JSON.parse(init.body);
    assert.equal(payload.store, false);
    assert.equal(payload.system_instruction, 'system');
    return new Response(body([
      frame({event_type:'step.start',index:0,step:{type:'thought'}}),
      frame({event_type:'step.delta',index:0,delta:{type:'text',text:'hidden'}}),
      frame({event_type:'step.start',index:1,step:{type:'model_output'}}),
      frame({event_type:'step.delta',index:1,delta:{type:'text',text:'Đúng.'}}),
      frame({event_type:'interaction.completed',interaction:{status:'completed'}}),
    ]));
  });
  let result = '';
  await generateGemini({apiKey:'server-only-test-key',model:'test',messages:[{content:'system'},{content:'input'}],signal:signal(),onText:async text => { result += text; }});
  assert.equal(result, 'Đúng.');
});

test('Gemini quota errors do not expose raw provider details', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('SECRET provider error', {status:429}));
  await assert.rejects(generateGemini({apiKey:'secret',model:'test',messages:[{content:'s'},{content:'u'}],signal:signal(),onText:async () => {}}), /giới hạn/);
});

test('browser client sends structured selection and receives streamed metadata', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, '/api/ai');
    assert.equal(init.headers.Authorization, undefined);
    const payload = JSON.parse(init.body);
    assert.equal(payload.before.length,650);
    assert.equal(payload.after.length,650);
    assert.equal(payload.model,undefined);
    assert.equal(payload.messages,undefined);
    return new Response(body([frame({type:'meta',model:'actual-model'}),frame({type:'text',text:'Xin chào'}),frame({type:'done'})]), {headers:{'content-type':'text/event-stream'}});
  });
  let model, answer = '';
  await streamGemini({action:'translate',excerpt,question:'',accessToken:'app-token',signal:signal(),onText:t=>answer+=t,onModel:m=>model=m});
  assert.equal(model,'actual-model'); assert.equal(answer,'Xin chào');
});

test('browser rejects truncated, malformed and empty streams', async t => {
  const mock = t.mock.method(globalThis,'fetch');
  for (const content of [frame({type:'text',text:'partial'}), 'data: invalid\n\n',frame({type:'done'})]) {
    mock.mock.mockImplementation(async () => new Response(content,{headers:{'content-type':'text/event-stream'}}));
    await assert.rejects(streamGemini({action:'explain',excerpt,question:'',accessToken:'token',signal:signal(),onText:()=>{},onModel:()=>{}}));
  }
});

test('API enforces authentication, CORS, validation, persisted limits and DB failure', async t => {
  let quota = true, databaseDown = false, calls = 0;
  const server = createApi({authenticate:appTokenAuthenticator(testToken),origins:['http://allowed.test'],model:'gemini-test',maxConcurrent:1,
    consumeQuota:async () => { if (databaseDown) throw new Error('private-db-uri'); return quota; },
    generate:async (messages, signal, onText) => { calls++; assert.match(messages[0].content,/Dịch/); signal.throwIfAborted(); await onText('Bản dịch'); },
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/ai`;
  const payload = {action:'translate',selectedText:'Hello',before:'',after:'',question:''};
  const send = (override={}, headers={}) => fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${testToken}`,Origin:'http://allowed.test',...headers},body:JSON.stringify({...payload,...override})});
  assert.equal((await send({}, {Authorization:'Bearer wrong'})).status,401);
  assert.equal((await send({}, {Origin:'http://evil.test'})).status,403);
  assert.equal((await send({action:'unknown'})).status,400);
  assert.equal((await send({selectedText:'x'.repeat(12001)})).status,400);
  assert.equal((await send({before:'x'.repeat(651)})).status,400);
  assert.equal((await send({selectedText:'x'.repeat(70000)})).status,413);
  quota = false; assert.equal((await send()).status,429);
  databaseDown = true; const failed = await send(); assert.equal(failed.status,503); assert.doesNotMatch(await failed.text(),/private-db-uri/);
  databaseDown = false; quota = true;
  const response = await send(); assert.equal(response.status,200);
  assert.equal(response.headers.get('access-control-allow-origin'),'http://allowed.test');
  const result = await response.text(); assert.match(result,/Bản dịch/); assert.match(result,/gemini-test/); assert.match(result,/"done"/);
  assert.equal(calls,1);
});

test('quota counter has atomic cap, treats duplicate upsert as exhausted and propagates DB failures', async () => {
  const expiresAt = new Date();
  const collection = {findOneAndUpdate:async (filter,update,options) => {
    assert.deepEqual(filter,{_id:'day:1',count:{$lt:100}});
    assert.equal(update.$inc.count,1); assert.equal(update.$setOnInsert.expiresAt,expiresAt); assert.equal(options.upsert,true);
    return {count:1};
  }};
  assert.equal(await consumeCounter(collection,'day:1',100,expiresAt),true);
  collection.findOneAndUpdate = async () => { throw {code:11000}; };
  assert.equal(await consumeCounter(collection,'day:1',100,expiresAt),false);
  collection.findOneAndUpdate = async () => { throw new Error('offline'); };
  await assert.rejects(consumeCounter(collection,'day:1',100,expiresAt),/offline/);
});

test('API caps concurrency and aborts generation when the browser disconnects', async t => {
  const started = Promise.withResolvers();
  const cancelled = Promise.withResolvers();
  const server = createApi({authenticate:appTokenAuthenticator(testToken),origins:[],model:'test',maxConcurrent:1,consumeQuota:async()=>true,
    generate:async (_messages, signal, onText) => {
      await onText('partial'); started.resolve();
      await new Promise(resolve => signal.addEventListener('abort',resolve,{once:true}));
      cancelled.resolve();
    },
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const url = `http://127.0.0.1:${server.address().port}/api/ai`;
  const controller = new AbortController();
  const init = {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${testToken}`},
    body:JSON.stringify({action:'explain',selectedText:'A word',before:'',after:'',question:''})};
  const first = await fetch(url,{...init,signal:controller.signal});
  await started.promise;
  assert.equal((await fetch(url,init)).status,429);
  controller.abort();
  await cancelled.promise;
  await first.body.cancel().catch(()=>{});
});

test('Gemini interrupted or failed output is never marked complete', async t => {
  const mock = t.mock.method(globalThis,'fetch');
  for (const events of [
    [{event_type:'step.start',index:1,step:{type:'model_output'}},{event_type:'step.delta',index:1,delta:{type:'text',text:'partial'}}],
    [{event_type:'interaction.failed',error:{message:'private provider details'}}],
    [{event_type:'interaction.completed',interaction:{status:'completed'}}],
  ]) {
    mock.mock.mockImplementation(async()=>new Response(body(events.map(frame))));
    await assert.rejects(generateGemini({apiKey:'secret',model:'test',messages:[{content:'s'},{content:'u'}],signal:signal(),onText:async()=>{}}), error => !error.message.includes('private provider details'));
  }
});
