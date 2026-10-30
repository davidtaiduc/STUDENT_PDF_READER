import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMessages } from '../src/services/ai/prompts.ts';
import { consumeChatStream, streamOllama } from '../src/services/ai/ollama.ts';

const encoder = new TextEncoder();
const excerpt = { cleanedText: 'Tiếng Việt: E = mc²; ∫ f(x) dx.', context: { before: 'a'.repeat(900), after: 'b'.repeat(900) } };
const frame = (content, done = false) => JSON.stringify({ message: { content }, done });
const body = (parts) => new ReadableStream({ start(c) { parts.forEach((part) => c.enqueue(typeof part === 'string' ? encoder.encode(part) : part)); c.close(); } });
const signal = () => new AbortController().signal;

test('prompts keep selected formulas exact and bound each context side', () => {
  for (const action of ['translate', 'explain', 'ask']) {
    const messages = buildMessages(action, excerpt, 'Ý nghĩa là gì?');
    const payload = JSON.parse(messages[1].content);
    assert.equal(payload.selectedText, excerpt.cleanedText);
    assert.equal(payload.contextBefore.length, 650);
    assert.equal(payload.contextAfter.length, 650);
    assert.match(messages[0].content, /Giữ nguyên công thức/);
    assert.equal(payload.question, action === 'ask' ? 'Ý nghĩa là gì?' : undefined);
  }
  assert.notEqual(buildMessages('explain', excerpt)[0].content, buildMessages('translate', excerpt)[0].content);
});
test('rejects empty or oversized selection and invalid questions', () => {
  assert.throws(() => buildMessages('explain', {...excerpt, cleanedText:' '}), /chọn đoạn/);
  assert.throws(() => buildMessages('explain', {...excerpt, cleanedText:'x'.repeat(12001)}), /quá dài/);
  assert.throws(() => buildMessages('ask', excerpt), /nhập câu hỏi/);
  assert.throws(() => buildMessages('ask', excerpt, 'x'.repeat(2001)), /quá dài/);
});
test('handles single-byte chunks, split UTF-8, CRLF and final line without newline', async () => {
  const bytes = encoder.encode('\r\n' + frame('Tiếng Việt ∫') + '\r\n' + frame(' = ²', true));
  const result = [];
  await consumeChatStream(body(Array.from(bytes, b => new Uint8Array([b]))), t => result.push(t), signal());
  assert.equal(result.join(''), 'Tiếng Việt ∫ = ²');
});
test('emits chunks progressively before stream ends, ignores thinking field', async () => {
  let controller;
  const stream = new ReadableStream({start(c) {controller = c;}});
  const parts = [];
  const first = Promise.withResolvers();
  const running = consumeChatStream(stream, t => { parts.push(t); first.resolve(); }, signal());
  controller.enqueue(encoder.encode(JSON.stringify({message:{thinking:'hidden reasoning'}}) + '\n' + frame('first') + '\n'));
  await first.promise;
  assert.deepEqual(parts, ['first']);
  controller.enqueue(encoder.encode(frame('second', true) + '\n'));
  await running;
  assert.deepEqual(parts, ['first','second']);
});
test('rejects malformed JSON, protocol errors and truncated streams', async () => {
  for (const [source, pattern] of [
    ['not json\n', /NDJSON/], ['null\n', /không hợp lệ/],
    ['{"error":"model failed"}\n', /model failed/],
    [frame('partial') + '\n', /bị ngắt/],
    ['{"message":{"content":123},"done":true}\n', /không hợp lệ/],
  ]) await assert.rejects(consumeChatStream(body([source]), () => {}, signal()), pattern);
});
test('abort cancels stalled reader and prevents late tokens', async () => {
  let cancelled = false;
  const abort = new AbortController();
  const stream = new ReadableStream({cancel() {cancelled = true;}});
  const running = consumeChatStream(stream, () => assert.fail('late token'), abort.signal);
  abort.abort();
  await assert.rejects(running, {name:'AbortError'});
  assert.ok(cancelled);
});
test('already aborted request cancels reader', async () => {
  const abort = new AbortController(); abort.abort();
  await assert.rejects(consumeChatStream(body([frame('no',true)]), () => assert.fail('late token'), abort.signal), {name:'AbortError'});
});
test('service sends chat contract and forwards content', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:11434/api/chat');
    const request = JSON.parse(options.body);
    assert.equal(request.model, 'qwen3:8b'); assert.equal(request.keep_alive, '30m');
    assert.equal(request.stream, true); assert.equal(request.think, false);
    assert.equal(request.messages.length, 2);
    return new Response(body([frame('Đúng.',true) + '\n']));
  });
  let result = '';
  await streamOllama({action:'translate',excerpt,model:'qwen3:8b',baseUrl:'http://localhost:11434/',signal:signal(),onText:t=>result+=t});
  assert.equal(result,'Đúng.');
});
test('offline, missing model, server failures and empty output are actionable', async (t) => {
  const mocked = t.mock.method(globalThis,'fetch');
  const invoke = () => streamOllama({action:'explain',excerpt,model:'qwen3:8b',signal:signal(),onText:()=>{}});
  mocked.mock.mockImplementation(async () => {throw new TypeError('fetch failed');});
  await assert.rejects(invoke(), /Không kết nối được Ollama/);
  mocked.mock.mockImplementation(async () => new Response('missing', {status:404}));
  await assert.rejects(invoke(), /Không tìm thấy model/);
  mocked.mock.mockImplementation(async () => new Response('offline', {status:500}));
  await assert.rejects(invoke(), /chưa sẵn sàng/);
  mocked.mock.mockImplementation(async () => new Response(frame('',true)));
  await assert.rejects(invoke(), /không trả nội dung/);
});
