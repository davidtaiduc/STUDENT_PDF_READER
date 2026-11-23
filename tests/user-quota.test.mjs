import { pipelineDatabase } from './helpers/pipelineDatabase.mjs';
import { mongoAiSlots } from '../backend/src/services/usage/slots.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApi } from '../backend/src/app.ts';
import { createUserQuota, mongoUserUsage } from '../backend/src/services/usage/userQuota.ts';
import { resolveSession } from '../backend/src/auth/security.ts';
import { createAuthHandler } from '../backend/src/auth/handler.ts';
import { fakeAuthRepository } from './helpers/authRepository.mjs';
import { fakeUserUsage } from './helpers/userUsage.mjs';
import { AiRequestError } from '../shared/ai/errors.ts';
const A={kind:'user',id:'a'.repeat(24)},B={kind:'user',id:'b'.repeat(24)},origin='http://allowed.test';
test('daily/minute limits are independent per user, atomic under concurrent callers and reset at UTC',async()=>{
 const repo=fakeUserUsage();let now=Date.parse('2026-11-04T23:59:30Z');const quota=createUserQuota(repo,3,2,()=>now);
 assert.equal((await quota.consume(A)).allowed,true);assert.equal((await quota.consume(A)).allowed,true);
 assert.equal((await quota.consume(A)).reason,'minute');assert.equal((await quota.read(A)).dailyUsed,2);assert.equal((await quota.read(B)).dailyUsed,0);
 assert.equal((await quota.consume(B)).allowed,true);now=Date.parse('2026-11-04T23:59:59Z');
 now=Date.parse('2026-11-05T00:00:00Z');assert.equal((await quota.read(A)).dailyUsed,0);
 assert.equal((await quota.read(A)).resetAt,'2026-11-06T00:00:00.000Z');
 const results=await Promise.all(Array.from({length:25},()=>quota.consume(A)));assert.equal(results.filter(r=>r.allowed).length,2);
 now+=60000;assert.equal((await quota.consume(A)).allowed,true);assert.equal((await quota.consume(A)).reason,'day');assert.equal((await quota.read(A)).dailyUsed,3);
 await assert.rejects(quota.consume({kind:'app',id:'preview'}));
 const restarted=createUserQuota(repo,3,2,()=>now);assert.equal((await restarted.read(A)).dailyRemaining,0);
});
test('Mongo quota pipeline is a single indexed conditional update and retries only duplicate initial upsert',async()=>{
 const calls=[];let duplicate=true;
 const repo=mongoUserUsage({collection:()=>({findOneAndUpdate:async(filter,update,options)=>{calls.push({filter,update,options});if(duplicate){duplicate=false;throw {code:11000};}return {lastAccepted:'accepted'};}})});
 assert.equal((await repo.accept(A.id,1,2,30,5,'accepted')).lastAccepted,'accepted');assert.equal(calls.length,2);
 assert.deepEqual(calls[0].filter,{_id:A.id});assert.ok(Array.isArray(calls[0].update));assert.ok(calls[0].update[0].$set.dailyUsed.$cond);assert.ok(calls[0].update[0].$set.minuteUsed.$cond);assert.equal(calls[0].options.upsert,true);assert.equal(calls[1].options.upsert,undefined);
});
async function fixture(t,{daily=3,minute=3,generate,acquireSlot,allowAiAttempt}={}){
 const auth=fakeAuthRepository(),repo=fakeUserUsage(),quota=createUserQuota(repo,daily,minute);
 let generations=0,down=false;
 const server=createApi({authHandler:createAuthHandler(auth,[origin],false),authenticate:async value=>value==='Bearer internal'?{kind:'app',id:'preview'}:null,
  authenticateUser:async cookie=>{if(down)throw new Error('private database URI');const result=await resolveSession(auth,cookie);return result?{kind:'user',id:result.user._id.toHexString()}:null;},origins:[origin],model:'fake',maxConcurrent:3,aiConfigured:true,getHealth:async()=>({}),consumeQuota:quota.consume,readUsage:quota.read,acquireSlot,allowAiAttempt,
  generate:async(...args)=>{generations++;if(generate)return generate(...args);await args[2]('Response');}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(path,method='GET',body,cookie,extra={})=>fetch(base+'/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer internal',...(cookie?{Cookie:cookie}:{}),...extra},...(method==='GET'?{}:{body:JSON.stringify(body??{})})});
 const register=async email=>{const r=await request('auth/register','POST',{email,displayName:email,password:'test-password-only'});const data=await r.json();return {cookie:r.headers.get('set-cookie').split(';')[0],id:data.user.id};};
 const a=await register('a@example.test'),b=await register('b@example.test');
 return {auth,repo,quota,request,a,b,get generations(){return generations;},setDown:()=>{down=true;}};
}
const input={action:'translate',selectedText:'Hello',before:'',after:'',question:''};
test('AI requires both internal token and live session, rejects guest/expiry/revocation and ignores forged identity',async t=>{
 const f=await fixture(t);
 assert.equal((await f.request('ai','POST',input)).status,401);
 assert.equal((await f.request('ai','POST',input,f.a.cookie,{Authorization:''})).status,401);
 assert.equal((await f.request('ai','POST',{...input,action:'invalid'},f.a.cookie)).status,400);
 assert.equal((await f.request('ai','POST',input,f.a.cookie,{Origin:''})).status,403);
 assert.equal((await f.request('ai','POST',{...input,userId:f.b.id,email:'b@example.test'},f.a.cookie,{'X-User-Id':f.b.id})).status,200);
 assert.equal((await (await f.request('usage/me','GET',undefined,f.a.cookie)).json()).dailyUsed,1);
 assert.equal((await (await f.request('usage/me','GET',undefined,f.b.cookie)).json()).dailyUsed,0);
 assert.equal((await f.request('usage/me?userId='+f.a.id,'GET',undefined,f.b.cookie)).status,404);
 const bSession=f.auth.sessions.find(s=>s.userId.toHexString()===f.b.id);bSession.expiresAt=new Date(0);assert.equal((await f.request('ai','POST',input,f.b.cookie)).status,401);
 await f.request('auth/logout','POST',{},f.a.cookie);assert.equal((await f.request('ai','POST',input,f.a.cookie)).status,401);assert.equal(f.generations,1);
});
test('quota exhausted never calls provider or charges again; retry/provider failure/accepted stop count once',async t=>{
 const f=await fixture(t,{daily:2,minute:2,generate:async()=>{throw new AiRequestError('Provider unavailable','provider_unavailable',true,2);}});
 for(let i=0;i<2;i++){const r=await f.request('ai','POST',input,f.a.cookie);assert.equal(r.status,200);const text=await r.text();assert.match(text,/"meta"/);assert.match(text,/"error"/);}
 const blocked=await f.request('ai','POST',input,f.a.cookie);assert.equal(blocked.status,429);assert.equal((await blocked.json()).code,'app_quota');assert.equal(f.generations,2);
 assert.equal((await (await f.request('usage/me','GET',undefined,f.a.cookie)).json()).dailyUsed,2);
 assert.equal((await f.request('ai','POST',input,f.b.cookie)).status,200);
});
test('shared slot unavailable, database errors and spam limits fail closed without charging user quota',async t=>{
 const f=await fixture(t,{acquireSlot:async()=>null});assert.equal((await f.request('ai','POST',input,f.a.cookie)).status,429);assert.equal(f.generations,0);assert.equal((await f.quota.read({kind:'user',id:f.a.id})).dailyUsed,0);
 const g=await fixture(t,{allowAiAttempt:async()=>false});assert.equal((await g.request('ai','POST',input,g.a.cookie)).status,429);assert.equal(g.generations,0);
 g.setDown();const failed=await g.request('ai','POST',input,g.a.cookie);assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('private'));
});

test('actual quota pipeline expressions cap both counters together and persist across repository instances (fake engine)',async()=>{
 const db=pipelineDatabase();let now=Date.parse('2026-11-04T23:59:30Z');const quota=createUserQuota(mongoUserUsage(db),7,3,()=>now);
 const results=await Promise.all(Array.from({length:20},()=>quota.consume(A)));assert.equal(results.filter(r=>r.allowed).length,3);assert.equal((await quota.read(A)).dailyUsed,3);
 assert.equal((await quota.consume(B)).allowed,true);assert.equal((await quota.read(B)).dailyUsed,1);now+=30000;
 assert.equal((await quota.read(A)).dailyUsed,0);assert.equal((await quota.consume(A)).allowed,true);
 const fresh=createUserQuota(mongoUserUsage(db),7,3,()=>now);assert.equal((await fresh.read(A)).dailyUsed,1);
});
test('actual lease pipeline guards two instances, releases and reclaims expiry without removing another lease (fake engine)',async()=>{
 const db=pipelineDatabase();let now=1000;const one=mongoAiSlots(db,2,()=>now),two=mongoAiSlots(db,2,()=>now);
 const leases=await Promise.all(Array.from({length:12},(_,i)=>(i%2?one:two)()));assert.equal(leases.filter(Boolean).length,2);
 const oldRelease=leases.find(Boolean);now+=210001;const newRelease=await two();assert.ok(newRelease);await oldRelease();
 assert.equal(db.collection('ai_runtime_v1').records.get('global').leases.length,1);await newRelease();assert.equal(db.collection('ai_runtime_v1').records.get('global').leases.length,0);
});

test('accepted stream exposes meta/text before completion; Stop keeps one charge and Retry is a new charge',async t=>{
 let calls=0;const stopped=Promise.withResolvers();
 const f=await fixture(t,{generate:async(_messages,signal,onText)=>{
  calls++;await onText('partial');if(calls===1){await new Promise(resolve=>signal.addEventListener('abort',()=>{stopped.resolve();resolve();},{once:true}));signal.throwIfAborted();}
 }});
 const response=await f.request('ai','POST',input,f.a.cookie);assert.equal(response.status,200);const reader=response.body.getReader();const first=await reader.read();assert.match(new TextDecoder().decode(first.value),/"meta"/);
 assert.equal((await f.quota.read({kind:'user',id:f.a.id})).dailyUsed,1);await reader.cancel();await stopped.promise;
 const retry=await f.request('ai','POST',input,f.a.cookie);assert.equal(retry.status,200);assert.match(await retry.text(),/"done"/);assert.equal((await f.quota.read({kind:'user',id:f.a.id})).dailyUsed,2);
});
test('concurrent HTTP AI requests for A and B charge their own principal independently',async t=>{
 const f=await fixture(t,{generate:async(_m,_s,onText)=>{await onText('text');await new Promise(resolve=>setTimeout(resolve,25));}});
 const responses=await Promise.all([f.request('ai','POST',input,f.a.cookie),f.request('ai','POST',input,f.b.cookie),f.request('ai','POST',input,f.a.cookie)]);
 for(const response of responses){assert.equal(response.status,200);assert.match(await response.text(),/"done"/);}
 assert.equal((await f.quota.read({kind:'user',id:f.a.id})).dailyUsed,2);assert.equal((await f.quota.read({kind:'user',id:f.b.id})).dailyUsed,1);
});
