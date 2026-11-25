import {purgeDeletedAccounts} from '../../backend/src/auth/deletion.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {MongoClient,ObjectId} from 'mongodb';
import {createLibraryHandler} from '../../backend/src/library/cloud.ts';
import {createApi} from '../../backend/src/app.ts';
import {fakeAuthRepository} from '../helpers/authRepository.mjs';
import {newSessionToken,sessionHash} from '../../backend/src/auth/session.ts';
import {configureDns} from '../../backend/src/config/dns.ts';
const enabled=process.env.MONGODB_TEST_URI&&process.env.MONGODB_TEST_ALLOW_WRITE==='isolated-tests';
test('GridFS library roundtrip, session isolation, Origin and concurrent version conflict', {skip:!enabled},async()=>{
 configureDns(process.env.MONGODB_DNS_SERVERS);const client=new MongoClient(process.env.MONGODB_TEST_URI,{serverSelectionTimeoutMS:5000});
 const name=`spr_lib_test_${randomUUID().replaceAll('-','').slice(0,24)}`;assert.match(name,/^spr_lib_test_[a-f0-9]{24}$/);await client.connect();const db=client.db(name),repo=fakeAuthRepository(),origin='http://localhost:5173';
 const cookie=()=>{const user={_id:new ObjectId(),sessionVersion:0},token=newSessionToken();repo.users.push(user);repo.sessions.push({_id:new ObjectId(),userId:user._id,tokenHash:sessionHash(token),version:0,expiresAt:new Date(Date.now()+60000)});return `studypdf_session=${token}`;};
 // Use the actual cookie name from sessionCookie rather than a fixture approximation.
 const {sessionCookie}=await import('../../backend/src/auth/session.ts');
 const account=()=>{const raw=cookie().split('=')[1];return sessionCookie(raw,false).split(';')[0];};const alice=account(),bob=account();
 const server=createApi({authenticate:async()=>null,origins:[origin],model:'test',maxConcurrent:1,aiConfigured:false,getHealth:async()=>({}),consumeQuota:async()=>true,generate:async()=>{},libraryHandler:createLibraryHandler(repo,db,[origin])});server.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}/api/library/archive`;
 const json=Buffer.from(JSON.stringify({version:1,documents:[],chats:[]})),length=Buffer.alloc(4);length.writeUInt32BE(json.length);const archive=Buffer.concat([Buffer.from('STUDYPDF1\n'),length,json]);
 const put=(who,version='"0"',body=archive)=>fetch(url,{method:'PUT',headers:{Cookie:who,Origin:origin,'Content-Type':'application/octet-stream','If-Match':version},body});
 try{
  assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:{Cookie:alice,'X-Library-Owner':'bbbbbbbbbbbbbbbbbbbbbbbb'}})).status,409);assert.equal((await fetch(url,{headers:{Cookie:alice}})).status,404);
  const first=await put(alice);assert.equal(first.status,200);assert.equal(first.headers.get('etag'),'"1"');
  const loaded=await fetch(url,{headers:{Cookie:alice}});assert.equal(loaded.status,200);assert.deepEqual(Buffer.from(await loaded.arrayBuffer()),archive);
  assert.equal((await fetch(url,{headers:{Cookie:bob}})).status,404);assert.equal((await put(alice)).status,409);
  assert.equal((await fetch(url,{method:'PUT',headers:{Cookie:alice,'Content-Type':'application/octet-stream','If-Match':'"1"'},body:archive})).status,403);
  assert.equal((await put(alice,'"1"',Buffer.from('invalid archive'))).status,400);
  const race=await Promise.all([put(bob),put(bob)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  assert.equal(await db.collection('library_archives_v1.files').countDocuments(),2);
  const removed=repo.users[0];removed.deletedAt=new Date();await db.collection('users').insertOne({_id:removed._id,deletedAt:removed.deletedAt});
  await purgeDeletedAccounts(db);await purgeDeletedAccounts(db);
  assert.equal(await db.collection('library_archives_v1.files').countDocuments(),1);
  assert.equal((await db.collection('library_heads_v1').findOne({_id:removed._id.toHexString()})).deleted,true);
  assert.equal((await fetch(url,{headers:{Cookie:alice}})).status,401);
  assert.equal((await fetch(url,{headers:{Cookie:bob}})).status,200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));try{await db.dropDatabase();}finally{await client.close();}}
});
