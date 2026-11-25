import {configureDns} from '../../backend/src/config/dns.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { mongoAuthRepository, createAuthIndexes } from '../../backend/src/auth/repository.ts';
import { hashPassword, verifyPassword } from '../../backend/src/auth/password.ts';
import { newSessionToken, sessionHash } from '../../backend/src/auth/session.ts';
import { resolveSession } from '../../backend/src/auth/security.ts';

const uri=process.env.MONGODB_TEST_URI;
test('isolated MongoDB account/session integration', {skip: !uri ? 'NOT RUN: set MONGODB_TEST_URI for a dedicated test server' : false}, async t=>{
 assert.equal(process.env.MONGODB_TEST_ALLOW_WRITE,'isolated-tests','Explicit test write opt-in required. Do not use a production server.');
 assert.ok(!process.env.MONGODB_URI || uri!==process.env.MONGODB_URI,'Test URI must not equal the application URI.');
 const databaseName=`studypdf_test_${randomBytes(16).toString('hex')}`;
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:3000,connectTimeoutMS:3000,maxPoolSize:3});
 let connected=false;
 try {
  configureDns(process.env.MONGODB_DNS_SERVERS);await client.connect();connected=true;
  const db=client.db(databaseName), repo=mongoAuthRepository(db), now=new Date(), userId=new ObjectId(), otherId=new ObjectId();
  const password='integration-password-only', passwordHash=await hashPassword(password);
  const check=(name,work)=>t.test(name,async()=>{try{await work();}catch{throw new Error('Integration check failed; driver/connection details suppressed.');}});
  await check('indexes, including idempotent creation and unique email/token',async()=>{
   await createAuthIndexes(db);await createAuthIndexes(db);
   const users=await db.collection('users').indexes(),sessions=await db.collection('sessions').indexes();
   assert.ok(users.some(i=>i.key.email===1&&i.unique));assert.ok(sessions.some(i=>i.key.tokenHash===1&&i.unique));
   assert.ok(sessions.some(i=>i.key.expiresAt===1&&i.expireAfterSeconds===0));assert.ok(sessions.some(i=>i.key.userId===1));
  });
  await check('user creation, no plaintext and duplicate email race',async()=>{
   const user={_id:userId,email:'integration@example.test',displayName:'Nguyễn Test',passwordHash,createdAt:now,updatedAt:now,sessionVersion:0};
   await repo.insertUser(user);const stored=await db.collection('users').findOne({_id:userId});
   assert.ok(!('password' in stored));assert.ok(stored.passwordHash.startsWith('$argon2id$'));
   await assert.rejects(repo.insertUser({...user,_id:new ObjectId()}),error=>error.code===11000);
   await repo.insertUser({...user,_id:otherId,email:'other@example.test'});
  });
  await check('profile update only changes authenticated record',async()=>{
   const updated=await repo.updateName(userId,'Tên mới');assert.equal(updated.displayName,'Tên mới');assert.equal((await repo.userById(otherId)).displayName,'Nguyễn Test');
   assert.equal(updated.email,'integration@example.test');assert.equal(updated.passwordHash,passwordHash);
  });
  const firstToken=newSessionToken(),secondToken=newSessionToken(),otherToken=newSessionToken();
  const session=(token,userId,expiresAt=new Date(Date.now()+60000))=>({_id:new ObjectId(),userId,tokenHash:sessionHash(token),createdAt:now,expiresAt,version:0});
  const first=session(firstToken,userId),second=session(secondToken,userId),other=session(otherToken,otherId);
  await check('session persistence across NEW client/pool and unique token hash',async()=>{
   await repo.insertSession(first);await repo.insertSession(second);await repo.insertSession(other);
   await assert.rejects(repo.insertSession({...first,_id:new ObjectId()}),error=>error.code===11000);
   const fresh=new MongoClient(uri,{serverSelectionTimeoutMS:3000,maxPoolSize:2});
   try {await fresh.connect();const restarted=mongoAuthRepository(fresh.db(databaseName));assert.ok(await resolveSession(restarted,`studypdf_session=${firstToken}`));}finally{await fresh.close();}
   const stored=await db.collection('sessions').findOne({_id:first._id});assert.ok(!JSON.stringify(stored).includes(firstToken));
  });
  await check('expiry checked before TTL and user session isolation/IDOR',async()=>{
   const expired=newSessionToken();await repo.insertSession(session(expired,userId,new Date(0)));
   assert.equal(await resolveSession(repo,`studypdf_session=${expired}`),null);
   const list=await repo.listSessions(userId,0,new Date());assert.equal(list.length,2);assert.ok(list.every(s=>s.userId.equals(userId)));
   assert.equal(await repo.revokeSession(other._id,userId),false);assert.ok(await resolveSession(repo,`studypdf_session=${otherToken}`));
  });
  await check('revoke one and logout others',async()=>{
   assert.equal(await repo.revokeSession(second._id,userId),true);assert.equal(await resolveSession(repo,`studypdf_session=${secondToken}`),null);
   const extraToken=newSessionToken();await repo.insertSession(session(extraToken,userId));await repo.revokeOthers(userId,first._id);
   assert.equal(await resolveSession(repo,`studypdf_session=${extraToken}`),null);assert.ok(await resolveSession(repo,`studypdf_session=${firstToken}`));
  });
  const nextHash=await hashPassword('new-integration-password');
  await check('concurrent password CAS, new hash and revocation barrier for late session insert',async()=>{
   const results=await Promise.all([repo.changePassword(userId,passwordHash,0,nextHash),repo.changePassword(userId,passwordHash,0,nextHash)]);
   assert.equal(results.filter(Boolean).length,1);assert.ok(await verifyPassword((await repo.userById(userId)).passwordHash,'new-integration-password'));
   assert.equal(await resolveSession(repo,`studypdf_session=${firstToken}`),null);
   const late=newSessionToken();await repo.insertSession(session(late,userId));assert.equal(await resolveSession(repo,`studypdf_session=${late}`),null);
   assert.ok(await resolveSession(repo,`studypdf_session=${otherToken}`));
  });
  await check('logout all invalidates existing and concurrently stale generation sessions',async()=>{
   const token=newSessionToken();await repo.insertSession({...session(token,userId),version:1});assert.ok(await resolveSession(repo,`studypdf_session=${token}`));
   assert.equal(await repo.revokeAll(userId,nextHash,1),true);assert.equal(await resolveSession(repo,`studypdf_session=${token}`),null);
   assert.equal((await repo.listSessions(userId,2,new Date())).length,0);
  });
 } catch {
  // Never expose driver errors containing connection details or credentials in runner output.
  throw new Error('MongoDB test failed. Use a dedicated test server and check connectivity/permissions; URI suppressed.');
 } finally {
  try {
   if(connected) {
    assert.match(databaseName,/^studypdf_test_[a-f0-9]{32}$/);
    try {await client.db(databaseName).dropDatabase();} catch {throw new Error('Could not clean up generated test database. Connection details suppressed.');}
   }
  } finally { await client.close(); }
 }
});
