import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { ObjectId } from 'mongodb';
import { createApi } from '../backend/src/app.ts';
import { createAuthHandler } from '../backend/src/auth/handler.ts';
import { fakeAuthRepository } from './helpers/authRepository.mjs';
import { hashPassword, verifyPassword } from '../backend/src/auth/password.ts';
import { resolveSession } from '../backend/src/auth/security.ts';
import { newSessionToken, sessionHash } from '../backend/src/auth/session.ts';
const origin='http://127.0.0.1:5173', password='test-password-only', newer='new-test-password';
async function fixture(t) {
 const repo=fakeAuthRepository();
 const server=createApi({authHandler:createAuthHandler(repo,[origin],false),origins:[origin],authenticate:async()=>null,model:'fake',maxConcurrent:2,aiConfigured:true,getHealth:async()=>({service:'student-pdf-reader-api',database:'connected',ai:{configured:true},accounts:{enabled:true}}),consumeQuota:async()=>true,generate:async()=>{}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(path,method='GET',input,cookie,source=origin)=>{
  const res=await fetch(`${base}/api/${path}`,{method,headers:{...(source?{Origin:source}:{}),'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(method==='GET'?{}:{body:JSON.stringify(input??{})})});
  return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie'),headers:res.headers};
 };
 const a=await request('auth/register','POST',{email:'a@example.test',displayName:'Nguyễn A',password});
 const cookieA=a.cookie.split(';')[0];
 const a2=await request('auth/login','POST',{email:'a@example.test',password});
 const cookieA2=a2.cookie.split(';')[0];
 const b=await request('auth/register','POST',{email:'b@example.test',displayName:'B',password});
 return {repo,request,cookieA,cookieA2,cookieB:b.cookie.split(';')[0]};
}
test('profile public fields, Unicode update, header payload and mass assignment protection',async t=>{
 const {request,cookieA,repo}=await fixture(t);
 const initial=await request('users/me','GET',undefined,cookieA);assert.equal(initial.status,200);
 assert.deepEqual(Object.keys(initial.body).sort(),['createdAt','displayName','email','id','updatedAt']);
 const update=await request('users/me','PATCH',{displayName:'  Nguyễn Ánh ☀  '},cookieA);assert.equal(update.status,200);assert.equal(update.body.displayName,'Nguyễn Ánh ☀');
 assert.equal((await request('auth/me','GET',undefined,cookieA)).body.user.displayName,'Nguyễn Ánh ☀');
 for(const extra of ['userId','email','passwordHash','role','emailVerified'])assert.equal((await request('users/me','PATCH',{displayName:'changed',[extra]:'bad'},cookieA)).status,400);
 for(const value of ['', ' '.repeat(3),'x'.repeat(81),'bad\nname'])assert.equal((await request('users/me','PATCH',{displayName:value},cookieA)).status,400);
 assert.equal(repo.users[1].displayName,'B');assert.equal((await request('users/me')).status,401);
});
test('session listing isolates users and denies IDOR, expired/malformed IDs and revoked cookies',async t=>{
 const {request,cookieA,cookieA2,cookieB,repo}=await fixture(t);
 const a=(await request('auth/sessions','GET',undefined,cookieA)).body.sessions;
 const b=(await request('auth/sessions','GET',undefined,cookieB)).body.sessions;
 assert.equal(a.length,2);assert.equal(b.length,1);assert.equal(a.filter(s=>s.isCurrent).length,1);
 for(const s of a)assert.deepEqual(Object.keys(s).sort(),['createdAt','expiresAt','id','isCurrent']);
 assert.equal((await request(`auth/sessions/${b[0].id}`,'DELETE',{},cookieA)).status,404);
 assert.equal((await request('auth/sessions/bad','DELETE',{},cookieA)).status,404);
 const other=a.find(s=>!s.isCurrent);assert.equal((await request(`auth/sessions/${other.id}`,'DELETE',{},cookieA)).status,200);
 assert.equal((await request('users/me','GET',undefined,cookieA2)).status,401);
 assert.equal((await request('users/me','GET',undefined,cookieB)).status,200);
 repo.sessions.find(s=>s._id.toHexString()===a.find(s=>s.isCurrent).id).expiresAt=new Date(0);
 assert.equal((await request('auth/sessions','GET',undefined,cookieA)).status,401);
});
test('logout others keeps current, logout all reauthenticates and invalidates every generation',async t=>{
 const {request,cookieA,cookieA2,cookieB,repo}=await fixture(t);
 assert.equal((await request('auth/logout-others','POST',{},cookieA)).status,200);
 assert.equal((await request('users/me','GET',undefined,cookieA)).status,200);
 assert.equal((await request('users/me','GET',undefined,cookieA2)).status,401);
 assert.equal((await request('auth/logout-all','POST',{currentPassword:'wrong-password'},cookieA)).status,400);
 assert.equal((await request('users/me','GET',undefined,cookieA)).status,200);
 const all=await request('auth/logout-all','POST',{currentPassword:password},cookieA);
 assert.equal(all.status,200);assert.match(all.cookie,/Max-Age=0/);assert.equal(all.body.authenticated,false);
 assert.equal((await request('users/me','GET',undefined,cookieA)).status,401);
 assert.equal((await request('users/me','GET',undefined,cookieB)).status,200);
 assert.equal(repo.users[0].sessionVersion,1);
});
test('password changes verify old password, reject same/invalid new password, revoke all and permit new login only',async t=>{
 const {request,cookieA,cookieA2,repo}=await fixture(t);
 const oldHash=repo.users[0].passwordHash;
 for(const input of [{currentPassword:'wrong-password',newPassword:newer},{currentPassword:password,newPassword:password},{currentPassword:password,newPassword:'tiny'},{currentPassword:password,newPassword:'x'.repeat(129)}])assert.equal((await request('auth/change-password','POST',input,cookieA)).status,400);
 const change=await request('auth/change-password','POST',{currentPassword:password,newPassword:newer},cookieA);
 assert.equal(change.status,200);assert.match(change.cookie,/Max-Age=0/);assert.ok(!JSON.stringify(change.body).includes('Hash'));
 assert.notEqual(repo.users[0].passwordHash,oldHash);assert.equal(await verifyPassword(repo.users[0].passwordHash,newer),true);assert.equal(await verifyPassword(repo.users[0].passwordHash,password),false);
 for(const cookie of [cookieA,cookieA2])assert.equal((await request('users/me','GET',undefined,cookie)).status,401);
 assert.equal((await request('auth/login','POST',{email:'a@example.test',password})).status,401);
 assert.equal((await request('auth/login','POST',{email:'a@example.test',password:newer})).status,200);
});
test('sensitive endpoints require Origin, own session and distributed rate budget, database errors are curated',async t=>{
 const {request,cookieA,repo}=await fixture(t);
 for(const [path,method] of [['users/me','PATCH'],['auth/change-password','POST'],['auth/logout-all','POST'],['auth/logout-others','POST'],['auth/sessions/'+new ObjectId(),'DELETE']]){
  assert.equal((await request(path,method,{},cookieA,null)).status,403);
  assert.equal((await request(path,method,{},cookieA,'https://evil.example')).status,403);
  assert.equal((await request(path,method,{})).status,401);
 }
 repo.consume=async()=>false;
 assert.equal((await request('auth/change-password','POST',{currentPassword:password,newPassword:newer},cookieA)).status,429);
 assert.equal((await request('auth/logout-all','POST',{currentPassword:password},cookieA)).status,429);
 repo.updateName=async()=>{throw new Error('private DB information');};const result=await request('users/me','PATCH',{displayName:'new'},cookieA);assert.equal(result.status,503);assert.ok(!JSON.stringify(result.body).includes('private'));
});
test('generation barrier rejects in-flight old login inserts, legacy sessions and competing password updates',async()=>{
 const repo=fakeAuthRepository(), id=new ObjectId(), hash=await hashPassword(password), now=new Date();
 await repo.insertUser({_id:id,email:'legacy@example.test',displayName:'Legacy',passwordHash:hash,createdAt:now,updatedAt:now});
 const token=newSessionToken(), cookie=`studypdf_session=${token}`;
 const doc={_id:new ObjectId(),userId:id,tokenHash:sessionHash(token),createdAt:now,expiresAt:new Date(Date.now()+60000)};
 await repo.insertSession(doc);assert.ok(await resolveSession(repo,cookie));
 const results=await Promise.all([repo.changePassword(id,hash,0,'new-hash'),repo.changePassword(id,hash,0,'competing-hash')]);assert.equal(results.filter(Boolean).length,1);
 assert.equal(await resolveSession(repo,cookie),null);
 // Login verified BEFORE rotation but inserts its stale session AFTER rotation.
 const lateToken=newSessionToken();await repo.insertSession({...doc,_id:new ObjectId(),tokenHash:sessionHash(lateToken),version:0});
 assert.equal(await resolveSession(repo,`studypdf_session=${lateToken}`),null);
 assert.equal((await repo.listSessions(id,1,new Date())).length,0);
});

test('current session deletion clears cookie and sensitive wrong-password attempts hit their own rate limit',async t=>{
 const {request,cookieA,cookieA2}=await fixture(t);
 for(let i=0;i<5;i++)assert.equal((await request('auth/change-password','POST',{currentPassword:'wrong-password',newPassword:newer},cookieA)).status,400);
 assert.equal((await request('auth/change-password','POST',{currentPassword:password,newPassword:newer},cookieA)).status,429);
 const list=(await request('auth/sessions','GET',undefined,cookieA)).body.sessions;
 const current=list.find(s=>s.isCurrent);const result=await request(`auth/sessions/${current.id}`,'DELETE',{},cookieA);
 assert.equal(result.status,200);assert.equal(result.body.authenticated,false);assert.match(result.cookie,/Max-Age=0/);
 assert.equal((await request('users/me','GET',undefined,cookieA)).status,401);assert.equal((await request('users/me','GET',undefined,cookieA2)).status,200);
});
