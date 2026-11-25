import {configureDns} from '../../backend/src/config/dns.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { once } from 'node:events';
import { mongoUserUsage, createUserQuota, createUsageIndexes } from '../../backend/src/services/usage/userQuota.ts';
import { mongoAiSlots } from '../../backend/src/services/usage/slots.ts';
import { mongoAuthRepository, createAuthIndexes } from '../../backend/src/auth/repository.ts';
import { resolveSession } from '../../backend/src/auth/security.ts';
import { newSessionToken, sessionHash } from '../../backend/src/auth/session.ts';
import { createApi } from '../../backend/src/app.ts';
const uri=process.env.MONGODB_TEST_URI;
test('isolated MongoDB per-user quota, leases and live session AI integration',{skip:!uri?'NOT RUN: dedicated MONGODB_TEST_URI missing':false},async t=>{
 assert.equal(process.env.MONGODB_TEST_ALLOW_WRITE,'isolated-tests');assert.ok(!process.env.MONGODB_URI||uri!==process.env.MONGODB_URI);
 const databaseName='studypdf_test_'+randomBytes(16).toString('hex'),client=new MongoClient(uri,{serverSelectionTimeoutMS:3000,maxPoolSize:4});let connected=false;
 const check=(name,work)=>t.test(name,async()=>{try{await work();}catch{throw new Error('Mongo quota integration check failed; connection details suppressed.');}});
 try{
  configureDns(process.env.MONGODB_DNS_SERVERS);await client.connect();connected=true;const db=client.db(databaseName),repo=mongoUserUsage(db);
  const A={kind:'user',id:new ObjectId().toHexString()},B={kind:'user',id:new ObjectId().toHexString()};let now=Date.parse('2026-11-04T23:59:30Z');const quota=createUserQuota(repo,7,20,()=>now);
  await check('indexes and atomic competing quota increments never exceed cap',async()=>{
   await createUsageIndexes(db);await createUsageIndexes(db);const indexes=await db.collection('ai_user_usage_v1').indexes();assert.ok(indexes.some(i=>i.key.userId===1&&i.unique));
   const results=await Promise.all(Array.from({length:30},()=>quota.consume(A)));assert.equal(results.filter(r=>r.allowed).length,7);assert.equal((await quota.read(A)).dailyUsed,7);assert.equal((await quota.consume(A)).allowed,false);assert.equal((await quota.consume(B)).allowed,true);
   await assert.rejects(db.collection('ai_user_usage_v1').insertOne({_id:'duplicate',userId:A.id}),e=>e.code===11000);
  });
  await check('UTC reset and independent minute cap, rejected requests do not change counters',async()=>{
   now=Date.parse('2026-11-05T00:00:00Z');assert.equal((await quota.read(A)).dailyUsed,0);assert.equal((await quota.consume(A)).allowed,true);
   const limited=createUserQuota(repo,30,2,()=>now);assert.equal((await limited.consume(B)).allowed,true);assert.equal((await limited.consume(B)).allowed,true);assert.equal((await limited.consume(B)).reason,'minute');assert.equal((await limited.read(B)).dailyUsed,2);
  });
  await check('quota survives a new client/pool/repository',async()=>{
   const fresh=new MongoClient(uri,{serverSelectionTimeoutMS:3000,maxPoolSize:2});try{await fresh.connect();const restored=createUserQuota(mongoUserUsage(fresh.db(databaseName)),7,20,()=>now);assert.equal((await restored.read(A)).dailyUsed,1);}finally{await fresh.close();}
  });
  await check('shared lease guard works across repository instances and releases/reclaims expired leases',async()=>{
   const one=mongoAiSlots(db,2),two=mongoAiSlots(db,2);const slots=await Promise.all(Array.from({length:8},(_,i)=>(i%2?one:two)()));assert.equal(slots.filter(Boolean).length,2);await Promise.all(slots.filter(Boolean).map(release=>release()));
   const release=await one();assert.ok(release);await db.collection('ai_runtime_v1').updateOne({_id:'global'},{$set:{'leases.$[].expiresAt':new Date(0)}});assert.ok(await two());await release();
  });
  await check('real Mongo sessions gate HTTP AI; guest, expiry, revocation and DB outage never call provider',async()=>{
   await createAuthIndexes(db);const auth=mongoAuthRepository(db),id=new ObjectId(),date=new Date(),token=newSessionToken();await auth.insertUser({_id:id,email:'quota@example.test',displayName:'Test',passwordHash:'test-fixture-never-used-for-login',createdAt:date,updatedAt:date,sessionVersion:0});
   const session={_id:new ObjectId(),userId:id,tokenHash:sessionHash(token),createdAt:date,expiresAt:new Date(Date.now()+60000),version:0};await auth.insertSession(session);
   let generated=0,down=false;const liveQuota=createUserQuota(repo,2,2);
   const server=createApi({authenticate:async h=>h==='Bearer internal'?{kind:'app',id:'preview'}:null,authenticateUser:async cookie=>{if(down)throw new Error('DB unavailable');const a=await resolveSession(auth,cookie);return a?{kind:'user',id:a.user._id.toHexString()}:null;},origins:['http://test.local'],model:'fake',maxConcurrent:2,aiConfigured:true,getHealth:async()=>({}),readUsage:liveQuota.read,consumeQuota:liveQuota.consume,generate:async(_m,_s,onText)=>{generated++;await onText('test');}});
   server.listen(0,'127.0.0.1');await once(server,'listening');
   const send=cookie=>fetch(`http://127.0.0.1:${server.address().port}/api/ai`,{method:'POST',headers:{Origin:'http://test.local',Authorization:'Bearer internal','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({action:'translate',selectedText:'Hello',before:'',after:'',question:''})});const cookie='studypdf_session='+token;
   try{assert.equal((await send()).status,401);const ok=await send(cookie);assert.equal(ok.status,200);assert.match(await ok.text(),/"done"/);assert.equal((await liveQuota.read({kind:'user',id:id.toHexString()})).dailyUsed,1);
    await db.collection('sessions').updateOne({_id:session._id},{$set:{expiresAt:new Date(0)}});assert.equal((await send(cookie)).status,401);
    await db.collection('sessions').updateOne({_id:session._id},{$set:{expiresAt:new Date(Date.now()+60000)}});await auth.revoke(sessionHash(token));assert.equal((await send(cookie)).status,401);
    down=true;const failed=await send(cookie);assert.equal(failed.status,503);assert.equal(generated,1);
   }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  });
 }catch{throw new Error('Mongo quota integration failed; URI suppressed.');}
 finally{try{if(connected){assert.match(databaseName,/^studypdf_test_[a-f0-9]{32}$/);await client.db(databaseName).dropDatabase();}}catch{throw new Error('Test database cleanup failed; connection details suppressed.');}finally{await client.close();}}
});
