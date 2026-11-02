import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApi } from '../backend/src/app.ts';
import { appTokenAuthenticator } from '../backend/src/auth/appToken.ts';
import { fetchBackendHealth } from '../src/services/backend.ts';

const token = 'test-token-012345678901234567890123';
const health = (database = 'connected', configured = false) => ({
  service: 'student-pdf-reader-api', database, ai: { configured }, accounts: { enabled: false },
});
async function start(t, overrides = {}) {
  const server = createApi({ authenticate: appTokenAuthenticator(token), origins: ['http://allowed.test'],
    model: 'test', aiConfigured: false, maxConcurrent: 1, getHealth: async () => health(),
    consumeQuota: async () => { assert.fail('Health or access check must not consume Gemini quota'); },
    generate: async () => { assert.fail('Health or access check must not call Gemini'); }, ...overrides });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('backend and database remain usable without a configured Gemini key', async t => {
  const base = await start(t);
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), health());
  const ai = await fetch(`${base}/api/ai`, { method:'POST', headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:'{}' });
  assert.equal(ai.status, 503);
  assert.match((await ai.json()).error, /cấu hình Gemini/);
});

test('database outage produces 503 and is shown honestly by the frontend client', async t => {
  const base = await start(t, { getHealth: async () => health('unavailable') });
  assert.equal((await fetch(`${base}/api/health`)).status, 503);
  assert.equal((await fetchBackendHealth(base, new AbortController().signal)).database, 'unavailable');
});

test('access check uses app credentials and never impersonates a user account', async t => {
  const base = await start(t);
  assert.equal((await fetch(`${base}/api/access`)).status, 401);
  const response = await fetch(`${base}/api/access`, { headers: { Authorization:`Bearer ${token}` } });
  assert.deepEqual(await response.json(), { authenticated: true, authentication:'app', accountsEnabled:false });
  assert.equal((await fetch(`${base}/api/health`, {headers:{Origin:'http://evil.test'}})).status,403);
});

test('authentication resolver failure is closed and never exposes internal details', async t => {
  const base = await start(t, { authenticate: async () => { throw new Error('private database URI'); } });
  const response = await fetch(`${base}/api/access`);
  assert.equal(response.status,503);
  assert.doesNotMatch(await response.text(),/private database URI/);
});

test('frontend rejects wrong-server responses instead of showing a false connection', async t => {
  const mock = t.mock.method(globalThis,'fetch');
  for (const payload of [{ok:true}, {...health(),service:'some-other-app'}, {...health(),ai:{configured:'true'}}]) {
    mock.mock.mockImplementation(async()=>new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}}));
    await assert.rejects(fetchBackendHealth('',new AbortController().signal));
  }
  mock.mock.mockImplementation(async()=>new Response('<html>Vite fallback</html>',{headers:{'content-type':'text/html'}}));
  await assert.rejects(fetchBackendHealth('',new AbortController().signal));
});

test('short preview token is rejected and wrong tokens do not create a principal', async () => {
  assert.throws(()=>appTokenAuthenticator('short'));
  const authenticate = appTokenAuthenticator(token);
  assert.equal(await authenticate(undefined),null);
  assert.equal(await authenticate('Bearer wrong'),null);
  assert.deepEqual(await authenticate(`Bearer ${token}`),{kind:'app',id:'preview'});
});
