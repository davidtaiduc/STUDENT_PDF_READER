import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApi } from '../backend/src/app.ts';
import { appTokenAuthenticator } from '../backend/src/auth/appToken.ts';
import { createQuotaPolicy } from '../backend/src/services/usage/quotaPolicy.ts';
import { once } from 'node:events';

test('local development keeps accepting requests beyond old daily limits without touching counters', async t => {
  const quota = createQuotaPolicy({development:true,host:'127.0.0.1'},async()=>assert.fail('Development must not read or increment quota counters'));
  const token = 'development-test-token-0123456789012345';
  const server = createApi({authenticate:appTokenAuthenticator(token),origins:[],model:'mock',aiConfigured:true,maxConcurrent:3,
    getHealth:async()=>({service:'student-pdf-reader-api',database:'connected',ai:{configured:true},accounts:{enabled:false}}),
    consumeQuota:quota.consume, generate:async(_messages,_signal,onText)=>{await onText('Bản dịch kiểm thử');},
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  for(let i=0;i<105;i++) {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/ai`,{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({action:'translate',selectedText:'Hello',before:'',after:'',question:''})});
    assert.equal(response.status,200,`request ${i+1}`);
    assert.match(await response.text(),/"type":"done"/);
  }
});

test('normal server preserves exhausted quotas', async () => {
  let calls=0;
  const quota=createQuotaPolicy({development:false,host:'0.0.0.0',nodeEnv:'production'},async()=>{calls++;return false;});
  assert.equal(quota.mode,'limited'); assert.equal(await quota.consume(),false); assert.equal(calls,1);
});

test('unlimited development cannot bind publicly or run in production', () => {
  for(const options of [{development:true,host:'0.0.0.0'},{development:true,host:'127.0.0.1',nodeEnv:'production'}]) {
    assert.throws(()=>createQuotaPolicy(options,async()=>true),/chỉ được chạy local/);
  }
});
