import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApi } from '../backend/src/app.ts';
import { createAuthHandler } from '../backend/src/auth/handler.ts';
import { createEmailHandler,emailTokenHash,mongoEmailRepository,resendMailer } from '../backend/src/auth/email.ts';
import { fakeAuthRepository } from './helpers/authRepository.mjs';
const origin='http://127.0.0.1:5173';
async function fixture(t,mailEnabled=true){
 const repo=fakeAuthRepository(),sent=[];
 const tokens={issue:async(user,purpose,token,expiresAt)=>{const target=repo.users.find(u=>u._id.equals(user._id));target.emailTokens??={};target.emailTokens[purpose]={hash:token,expiresAt,passwordHash:user.passwordHash};},find:async(token,purpose,now)=>{const user=repo.users.find(u=>u.emailTokens?.[purpose]?.hash===token&&u.emailTokens[purpose].expiresAt>now);return user?{...user}:null;},complete:async(user,purpose,token,password)=>{const target=repo.users.find(u=>u._id.equals(user._id)),record=target.emailTokens?.[purpose];if(!record||record.hash!==token||record.expiresAt<=new Date()||target.passwordHash!==user.passwordHash||record.passwordHash!==target.passwordHash)return false;if(purpose==='reset'){target.passwordHash=password;target.sessionVersion=(target.sessionVersion??0)+1;delete target.emailTokens;}else{target.emailVerifiedAt=new Date();delete target.emailTokens.verify;}return true;}};
 const mailer=mailEnabled?{send:async(to,purpose,link)=>{sent.push({to,purpose,link});}}:undefined;
 const server=createApi({authHandler:createAuthHandler(repo,[origin],false),emailHandler:createEmailHandler(repo,tokens,[origin],false,origin,mailer),authenticate:async()=>null,origins:[origin],model:'fake',maxConcurrent:1,aiConfigured:false,getHealth:async()=>({}),consumeQuota:async()=>true,generate:async()=>{}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const request=async(path,method='POST',data={},cookie='',source=origin)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{method,headers:{'Content-Type':'application/json',...(source?{Origin:source}:{}),...(cookie?{Cookie:cookie}:{})},...(method==='GET'?{}:{body:JSON.stringify(data)})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const register=async(email)=>{const result=await request('auth/register','POST',{email,password:'fixture-password',displayName:'Tester'});assert.equal(result.status,201);return {id:result.data.user.id,cookie:result.cookie};};
 return {repo,sent,request,register};
}
test('forgot password does not enumerate users; raw token is email-only; reset is one-use and revokes all sessions',async t=>{
 const {request,register,sent,repo}=await fixture(t),a=await register('a@example.test');
 const known=await request('auth/forgot-password','POST',{email:'a@example.test'}),unknown=await request('auth/forgot-password','POST',{email:'unknown@example.test'});assert.deepEqual(known.data,unknown.data);assert.equal(sent.length,1);
 const token=new URL(sent[0].link).hash.split('=')[1];assert.match(token,/^[a-f0-9]{64}$/);assert.equal(repo.users[0].emailTokens.reset.hash,emailTokenHash(token));assert.ok(!JSON.stringify(repo.users).includes(token));
 assert.equal((await request('auth/reset-password','POST',{token,password:'new-password-only'})).status,200);
 assert.equal((await request('auth/reset-password','POST',{token,password:'new-password-only'})).status,400);
 assert.equal((await request('auth/me','GET',{},a.cookie)).data.authenticated,false);
 assert.equal((await request('auth/login','POST',{email:'a@example.test',password:'fixture-password'})).status,401);
 assert.equal((await request('auth/login','POST',{email:'a@example.test',password:'new-password-only'})).status,200);
});
test('verification requires session to issue; link requires POST, expires, and is one-use',async t=>{
 const {request,register,sent,repo}=await fixture(t),a=await register('a@example.test');
 assert.equal((await request('auth/resend-verification')).status,401);
 await request('auth/resend-verification','POST',{},a.cookie);const token=new URL(sent[0].link).hash.split('=')[1];
 assert.equal((await request('auth/verify-email','GET',{token})).status,405);
 assert.equal((await request('auth/verify-email','POST',{token})).status,200);
 assert.equal((await request('auth/me','GET',{},a.cookie)).data.user.emailVerified,true);
 assert.equal((await request('auth/verify-email','POST',{token})).status,400);
 await request('auth/forgot-password','POST',{email:'a@example.test'});repo.users[0].emailTokens.reset.expiresAt=new Date(0);
 assert.equal((await request('auth/reset-password','POST',{token:new URL(sent.at(-1).link).hash.split('=')[1],password:'new-password-only'})).status,400);
});
test('resending invalidates old links; password changed after issue invalidates reset; mail not configured fails clearly',async t=>{
 const {request,register,sent,repo}=await fixture(t),a=await register('a@example.test');
 await request('auth/forgot-password','POST',{email:'a@example.test'});const old=new URL(sent[0].link).hash.split('=')[1];await request('auth/forgot-password','POST',{email:'a@example.test'});
 assert.equal((await request('auth/reset-password','POST',{token:old,password:'new-password-only'})).status,400);
 repo.users[0].passwordHash='changed';assert.equal((await request('auth/reset-password','POST',{token:new URL(sent[1].link).hash.split('=')[1],password:'new-password-only'})).status,400);
 assert.equal((await request('auth/resend-verification','POST',{},a.cookie,'https://evil.test')).status,403);
 const disabled=await fixture(t,false);assert.equal((await disabled.request('auth/forgot-password','POST',{email:'a@example.test'})).status,503);
 assert.equal(resendMailer('',''),undefined);
});

test('retired study endpoints are not served by the backend',async t=>{const {request}=await fixture(t);for(const kind of ['chat','entries','documents']){const path=`study/${kind}/${'a'.repeat(64)}`;assert.equal((await request(path,'GET')).status,404);assert.equal((await request(path,'POST',{revision:0,value:{}})).status,404);}});
test('Mongo email reset remains atomic and invalidates all sessions',async()=>{
 const calls=[];const db={collection:()=>({updateOne:async(filter,update)=>{calls.push({filter,update});return {modifiedCount:1};}})};
 const user={_id:'fixture-id',passwordHash:'old-hash'};assert.equal(await mongoEmailRepository(db).complete(user,'reset','token-hash','new-hash'),true);
 assert.equal(calls[0].filter.passwordHash,'old-hash');assert.equal(calls[0].filter['emailTokens.reset.hash'],'token-hash');assert.equal(calls[0].update.$set.passwordHash,'new-hash');assert.equal(calls[0].update.$inc.sessionVersion,1);assert.ok('emailTokens' in calls[0].update.$unset);
});
