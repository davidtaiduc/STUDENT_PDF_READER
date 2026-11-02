import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geminiFailure, readProviderError } from '../backend/src/services/ai/geminiErrors.ts';
import { AiRequestError, errorFromPayload, formatWait } from '../shared/ai/errors.ts';
import { streamGemini } from '../src/services/ai/gemini.ts';
import { createApi } from '../backend/src/app.ts';
import { appTokenAuthenticator } from '../backend/src/auth/appToken.ts';
import { once } from 'node:events';

test('short-term rate limit uses provider delay without exposing provider messages', () => {
  const failure=geminiFailure(429,{error:{code:'rate_limit_exceeded',message:'SECRET URI and key',details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'12.5s'}]}},'10');
  assert.equal(failure.code,'provider_rate_limit'); assert.equal(failure.retryAfterSeconds,13); assert.equal(failure.retryable,true);
  assert.doesNotMatch(failure.message,/SECRET/);
});
test('daily quota is distinguished by explicit code or daily quota metadata, not raw text guesses', () => {
  for(const payload of [{error:{code:'quota_exceeded'}},{error:{status:'RESOURCE_EXHAUSTED',details:[{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaId:'GenerateRequestsPerDayPerProjectPerModel'}]}]}}]) {
    const failure=geminiFailure(429,payload); assert.equal(failure.code,'provider_quota'); assert.equal(failure.retryable,false); assert.match(failure.message,/trong ngày/);
  }
  const unknown=geminiFailure(429,{error:{message:'daily quota maybe? private raw body'}});
  assert.equal(unknown.code,'provider_limit'); assert.equal(unknown.retryable,true); assert.equal(unknown.retryAfterSeconds,5);
});
test('HTTP date retry delay, malformed retry headers, provider downtime and non-retryable setup errors', () => {
  const now=Date.parse('2026-11-02T00:00:00Z');
  assert.equal(geminiFailure(429,null,'Mon, 02 Nov 2026 00:00:20 GMT',now).retryAfterSeconds,20);
  assert.equal(geminiFailure(429,null,'invalid').retryAfterSeconds,5);
  assert.equal(geminiFailure(503,null).code,'provider_unavailable');
  assert.equal(geminiFailure(403,null).retryable,false);
  assert.equal(geminiFailure(404,null).retryable,false);
  assert.equal(geminiFailure(402,null).code,'payment');
});
test('error payload delay is bounded and wait formatting is readable', () => {
  assert.equal(errorFromPayload({error:'test',retryAfterSeconds:-10}).retryAfterSeconds,0);
  assert.equal(errorFromPayload({error:'test',retryAfterSeconds:Infinity}).retryAfterSeconds,0);
  assert.equal(errorFromPayload({error:'test',retryAfterSeconds:1e10}).retryAfterSeconds,86400);
  assert.equal(formatWait(5),'5 giây'); assert.equal(formatWait(90),'1 phút 30 giây'); assert.equal(formatWait(3600),'1 giờ');
  assert.equal(formatWait(7199),'1 giờ 59 phút');
});
test('provider error JSON is bounded and malformed responses have a neutral fallback', async () => {
  assert.equal(await readProviderError(new Response('not JSON')),null);
  assert.equal(await readProviderError(new Response('x'.repeat(65537))),null);
});
test('HTTP backend and browser preserve structured streamed errors and cooldown', async t => {
  const token='test-token-012345678901234567890123';
  const failure=new AiRequestError('Gemini cần chờ trước khi thử lại.','provider_rate_limit',true,12);
  const server=createApi({authenticate:appTokenAuthenticator(token),origins:[],model:'test',aiConfigured:true,maxConcurrent:3,
    getHealth:async()=>({service:'student-pdf-reader-api',database:'connected',ai:{configured:true},accounts:{enabled:false}}),
    consumeQuota:async()=>true,generate:async()=>{throw failure;}});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
  const originalFetch=globalThis.fetch;
  t.mock.method(globalThis,'fetch',(url,init)=>originalFetch(url,{...init,headers:{...init.headers,Authorization:`Bearer ${token}`}}));
  await assert.rejects(streamGemini({baseUrl:`http://127.0.0.1:${server.address().port}`,action:'translate',excerpt:{cleanedText:'Hello',context:{before:'',after:''}},question:'',signal:new AbortController().signal,onText:()=>{},onModel:()=>{}}),
    error=>error instanceof AiRequestError&&error.code==='provider_rate_limit'&&error.retryAfterSeconds===12);
});
