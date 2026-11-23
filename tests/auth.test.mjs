import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApi } from '../backend/src/app.ts';
import { createAuthHandler } from '../backend/src/auth/handler.ts';
import { createAuthIndexes } from '../backend/src/auth/repository.ts';
import { hashPassword, verifyPassword } from '../backend/src/auth/password.ts';
import { sessionHash } from '../backend/src/auth/session.ts';

const origin = 'http://127.0.0.1:5173';
import { fakeAuthRepository } from './helpers/authRepository.mjs';

async function fixture(t, secure=false) {
 const repo=fakeAuthRepository();
 const api=createApi({authHandler:createAuthHandler(repo,[origin],secure),authenticate:async()=>null,origins:[origin],model:'fake',maxConcurrent:3,aiConfigured:true,getHealth:async()=>({service:'student-pdf-reader-api',database:'connected',ai:{configured:true},accounts:{enabled:true}}),consumeQuota:async()=>true,generate:async()=>{}});
 api.listen(0,'127.0.0.1');await once(api,'listening');t.after(()=>new Promise(resolve=>{api.closeAllConnections();api.close(resolve);}));
 const base=`http://127.0.0.1:${api.address().port}`;
 const request=async(action,body,cookie,source=origin)=>{
   const response=await fetch(`${base}/api/auth/${action}`,{method:action==='me'?'GET':'POST',headers:{...(source?{Origin:source}:{}),'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(action==='me'?{}:{body:JSON.stringify(body??{})})});
   return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie'),headers:response.headers};
 };
 return {repo,request,base};
}
const registration={email:' Student@Example.COM ',displayName:' Nguyễn Văn A ',password:'test-password-only'};

test('Argon2id salts, parameters and verification', async()=>{
 const a=await hashPassword(registration.password),b=await hashPassword(registration.password);
 assert.notEqual(a,b);assert.match(a,/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
 assert.equal(await verifyPassword(a,registration.password),true);assert.equal(await verifyPassword(a,'wrong'),false);
});
test('register, normalize, cookie persistence, login rotation, expiry and logout revocation',async t=>{
 const {repo,request}=await fixture(t,true);
 assert.deepEqual((await request('me')).body,{authenticated:false,user:null});
 const register=await request('register',registration);assert.equal(register.status,201);
 assert.deepEqual(Object.keys(register.body.user).sort(),['displayName','email','id']);
 assert.equal(register.body.user.email,'student@example.com');assert.equal(register.body.user.displayName,'Nguyễn Văn A');
 assert.ok(!JSON.stringify(register.body).includes('password'));assert.equal(repo.users[0].password,undefined);
 assert.match(repo.users[0].passwordHash,/^\$argon2id/);
 for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/;','Max-Age=604800'])assert.ok(register.cookie.includes(flag));
 const cookie=register.cookie.split(';')[0],token=cookie.split('=')[1];assert.equal(repo.sessions[0].tokenHash,sessionHash(token));assert.ok(!JSON.stringify(repo.sessions).includes(token));
 assert.equal((await request('me',undefined,cookie)).body.authenticated,true);
 assert.equal((await request('register',registration)).status,409);
 const wrong=await request('login',{email:registration.email,password:'incorrect'});const absent=await request('login',{email:'absent@example.com',password:'incorrect'});
 assert.equal(wrong.status,401);assert.deepEqual(wrong.body,absent.body);
 const login=await request('login',registration,cookie);assert.equal(login.status,200);const second=login.cookie.split(';')[0];assert.notEqual(second,cookie);
 assert.equal((await request('me',undefined,cookie)).body.authenticated,false);
 repo.sessions[0].expiresAt=new Date(0);assert.equal((await request('me',undefined,second)).body.authenticated,false);
 const again=await request('login',registration);const current=again.cookie.split(';')[0];
 const logout=await request('logout',{},current);assert.equal(logout.status,200);assert.match(logout.cookie,/Max-Age=0/);
 assert.equal((await request('me',undefined,current)).body.authenticated,false);assert.equal((await request('logout',{},current)).status,200);
});
test('backend validation, CSRF, JSON bounds and safe database failures',async t=>{
 const {request,repo,base}=await fixture(t);
 for(const input of [{...registration,email:'invalid'},{...registration,password:'short'},{...registration,password:'x'.repeat(129)},{...registration,displayName:' '}])assert.equal((await request('register',input)).status,400);
 assert.equal((await request('register',registration,undefined,'https://evil.example')).status,403);
 assert.equal((await request('register',registration,undefined,null)).status,403);
 assert.equal((await fetch(`${base}/api/auth/register`,{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:'{}'})).status,415);
 assert.equal((await request('register',{...registration,extra:'x'.repeat(9000)})).status,413);
 repo.findUser=async()=>{throw new Error('secret database detail');};const failure=await request('login',registration);assert.equal(failure.status,503);assert.ok(!JSON.stringify(failure.body).includes('secret'));
 assert.equal((await fetch(`${base}/api/ai`,{method:'POST'})).status,401);
 assert.equal((await fetch(`${base}/api/access`)).status,401);
 assert.equal((await fetch(`${base}/api/health`)).status,200);
});
test('auth rate limit is independent, stored through repository and fails closed',async t=>{
 const {request,repo}=await fixture(t);repo.consume=async()=>false;
 const result=await request('login',registration);assert.equal(result.status,429);assert.equal(result.headers.get('retry-after'),'900');assert.equal(repo.users.length,0);
 repo.consume=async()=>{throw new Error('database unavailable');};assert.equal((await request('register',registration)).status,503);
});
test('Mongo indexes cover unique emails/tokens and expiry cleanup',async()=>{
 const calls=[];await createAuthIndexes({collection:name=>({createIndex:async(keys,options)=>calls.push({name,keys,options})})});
 assert.ok(calls.some(c=>c.name==='users'&&c.keys.email===1&&c.options.unique));
 assert.ok(calls.some(c=>c.name==='sessions'&&c.keys.tokenHash===1&&c.options.unique));
 for(const name of ['sessions','auth_rate_limits'])assert.ok(calls.some(c=>c.name===name&&c.keys.expiresAt===1&&c.options.expireAfterSeconds===0));
});

test('concurrent duplicate registration is rejected by uniqueness, not a prior existence check',async t=>{
 const {request,repo}=await fixture(t);
 const results=await Promise.all([request('register',registration),request('register',registration)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(repo.users.length,1);
});
test('auth logout requires trusted Origin and response never enables wildcard credentials',async t=>{
 const {request}=await fixture(t);
 assert.equal((await request('logout',{},undefined,null)).status,403);
 assert.equal((await request('logout',{},undefined,'https://evil.example')).status,403);
 const me=await request('me');assert.equal(me.headers.get('access-control-allow-origin'),origin);
 assert.equal(me.headers.get('access-control-allow-credentials'),'true');assert.equal(me.headers.get('cache-control'),'no-store');
});
