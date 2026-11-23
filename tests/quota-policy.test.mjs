import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApi } from '../backend/src/app.ts';
import { appTokenAuthenticator } from '../backend/src/auth/appToken.ts';
test('internal token alone cannot bypass session requirement, even with a legacy unlimited quota callback',async t=>{
 const token='development-test-token-0123456789012345';let calls=0;
 const server=createApi({authenticate:appTokenAuthenticator(token),origins:['http://allowed.test'],model:'fake',aiConfigured:true,maxConcurrent:3,getHealth:async()=>({}),consumeQuota:async()=>{calls++;return true;},generate:async()=>assert.fail('Guest must not call Gemini')});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
 const response=await fetch(`http://127.0.0.1:${server.address().port}/api/ai`,{method:'POST',headers:{Origin:'http://allowed.test',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'translate',selectedText:'Hello',before:'',after:'',question:''})});
 assert.equal(response.status,401);assert.equal(calls,0);
});
