import {exportLibrary,parseArchive,importLibrary} from '../src/services/library/archive.ts';
import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clearAccountLibrary,pdfId,saveDocument,loadDocument,listDocuments,saveChat,listChats,loadChat,renameChat,deleteChat,renameDocument,deleteDocument,readSnapshot,mergeSnapshot} from '../src/services/library/store.ts';
const alice='user:aaaaaaaaaaaaaaaaaaaaaaaa',bob='user:bbbbbbbbbbbbbbbbbbbbbbbb';
const bytes=new TextEncoder().encode('%PDF-test').buffer;
const turn={id:'turn1',question:'Giải thích?',answer:'Câu trả lời',model:'Gemini',createdAt:1,status:'ready',selection:{pageNumber:1,cleanedText:'Proof',context:{before:'',after:''}}};
test('PDF library persists actual bytes, deduplicates by content and isolates owners',async()=>{
 const id=await pdfId(bytes),other=await pdfId(new TextEncoder().encode('different').buffer);
 assert.notEqual(id,other);
 await saveDocument(alice,id,new File([bytes],'one.pdf'));
 await saveDocument(alice,id,new File([bytes],'renamed.pdf'));
 assert.equal((await listDocuments(alice)).length,1);
 const restored=await loadDocument(alice,id);assert.equal(restored.name,'renamed.pdf');assert.deepEqual(await restored.arrayBuffer(),bytes);
 assert.deepEqual(await listDocuments(bob),[]);await assert.rejects(loadDocument(bob,id));
});
test('each PDF has numbered chats; empty sessions create no record; old chat can continue',async()=>{
 const id=await pdfId(bytes);await saveChat(alice,id,'empty',[],0);assert.deepEqual(await listChats(alice,id),[]);
 assert.equal(await saveChat(alice,id,'first',[turn],0),1);
 assert.equal(await saveChat(alice,id,'second',[{...turn,id:'t2'}],0),1);
 assert.deepEqual((await listChats(alice,id)).map(c=>c.title).sort(),['Đoạn chat 1','Đoạn chat 2']);
 assert.equal(await saveChat(alice,id,'first',[turn,{...turn,id:'t3'}],1),2);
 assert.equal((await loadChat(alice,id,'first')).turns.length,2);
 await assert.rejects(saveChat(alice,id,'first',[turn],1),/tab khác/);
 await assert.rejects(loadChat(bob,id,'first'));
 const other=await pdfId(new TextEncoder().encode('other').buffer);await assert.rejects(loadChat(alice,other,'first'));
});
test('interrupted streams restore as stopped and concurrent writes cannot overwrite',async()=>{
 const id=await pdfId(bytes);await saveChat(alice,id,'interrupted',[{...turn,status:'streaming'}],0);
 assert.equal((await loadChat(alice,id,'interrupted')).turns[0].status,'stopped');
 const writes=await Promise.allSettled([saveChat(alice,id,'race',[turn],0),saveChat(alice,id,'race',[turn],0)]);
 assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(writes.filter(r=>r.status==='rejected').length,1);
});


test('rename survives autosave; delete removes chat content and blocks stale saves, scoped to owner and PDF',async()=>{
 const id=await pdfId(bytes),other=await pdfId(new TextEncoder().encode('other').buffer);
 await saveChat(alice,id,'manage',[turn],0);
 await assert.rejects(renameChat(alice,id,'manage','   '));
 await assert.rejects(renameChat(alice,id,'manage','x'.repeat(101)));
 await assert.rejects(renameChat(bob,id,'manage','intruder'));
 await assert.rejects(deleteChat(bob,id,'manage'));
 await assert.rejects(deleteChat(alice,other,'manage'));
 await renameChat(alice,id,'manage','  Ôn tập chương 1  ');
 await saveChat(alice,id,'manage',[turn,{...turn,id:'follow-up'}],1);
 assert.equal((await loadChat(alice,id,'manage')).title,'Ôn tập chương 1');
 await deleteChat(alice,id,'manage');
 assert.equal((await listChats(alice,id)).some(c=>c.id==='manage'),false);
 await assert.rejects(loadChat(alice,id,'manage'));
 await assert.rejects(saveChat(alice,id,'manage',[turn],2));
 await assert.rejects(saveChat(alice,id,'manage',[turn],0));
 assert.equal((await loadDocument(alice,id)).name,'renamed.pdf');
 assert.equal((await loadChat(alice,id,'first')).turns.length,2);
});


test('binary archive roundtrip verifies bytes, isolates owner and repeated restore is idempotent',async()=>{
 const archive=await exportLibrary(alice),parsed=await parseArchive(bob,archive);
 assert.ok(parsed.documents.length);assert.ok(parsed.documents.every(d=>d.owner===bob));
 await importLibrary(bob,archive);const before=await listChats(bob,await pdfId(bytes));await importLibrary(bob,archive);
 assert.deepEqual(await listChats(bob,await pdfId(bytes)),before);
 assert.deepEqual(await (await loadDocument(bob,await pdfId(bytes))).arrayBuffer(),bytes);
 await assert.rejects(parseArchive(bob,new Blob(['wrong format'])));
 const damaged=new Blob([archive.slice(0,archive.size-1),'x']);await assert.rejects(parseArchive(bob,damaged));
});
test('import validates everything before writing, conflict preserves both versions',async()=>{
 const id=await pdfId(bytes);const before=await readSnapshot(bob);
 const incoming=structuredClone(before);const first=incoming.chats.find(c=>c.id==='first');first.turns[0].answer='Different answer';first.updatedAt+=10000;
 await mergeSnapshot(bob,incoming);const chats=await listChats(bob,id);
 assert.equal((await loadChat(bob,id,'first')).turns[0].answer,'Different answer');
 assert.ok(chats.some(c=>c.title.includes('bản khôi phục')));
 const count=chats.length;await mergeSnapshot(bob,incoming);assert.equal((await listChats(bob,id)).length,count);
});
test('document rename and delete cascade, stale autosave and old archive cannot resurrect deletion',async()=>{
 const id=await pdfId(bytes);const archive=await exportLibrary(bob);
 await assert.rejects(renameDocument(bob,id,' '));await renameDocument(bob,id,'My document.pdf');assert.equal((await loadDocument(bob,id)).name,'My document.pdf');
 await deleteDocument(bob,id);assert.equal((await listDocuments(bob)).some(d=>d.id===id),false);assert.deepEqual(await listChats(bob,id),[]);
 await assert.rejects(loadDocument(bob,id));await assert.rejects(saveChat(bob,id,'stale-new',[turn],0));
 await importLibrary(bob,archive,false);assert.equal((await listDocuments(bob)).some(d=>d.id===id),false);assert.deepEqual(await listChats(bob,id),[]);
 assert.ok((await listDocuments(alice)).some(d=>d.id===id));
 await importLibrary(bob,archive);assert.ok((await listDocuments(bob)).some(d=>d.id===id));assert.ok((await listChats(bob,id)).length);
});


test('clearing account library deletes only its documents and chats',async()=>{
 const owner='user:cccccccccccccccccccccccc',other='user:dddddddddddddddddddddddd',id=await pdfId(bytes);
 await saveDocument(owner,id,new File([bytes],'delete.pdf'));await saveDocument(other,id,new File([bytes],'keep.pdf'));
 await saveChat(owner,id,'remove-me',[turn],0);await saveChat(other,id,'keep-me',[turn],0);
 await clearAccountLibrary(owner);
 assert.deepEqual(await listDocuments(owner),[]);assert.deepEqual(await listChats(owner,id),[]);
 assert.equal((await listDocuments(other)).length,1);assert.equal((await listChats(other,id)).length,1);
 await assert.rejects(saveChat(owner,id,'remove-me',[turn],1));await assert.rejects(clearAccountLibrary('guest'));
});


test('new storage uses bytes and legacy Blob documents still reopen and export',async()=>{
 const owner='user:ffffffffffffffffffffffff',id=await pdfId(bytes);
 await saveDocument(owner,id,new File([bytes],'modern.pdf'));
 assert.ok((await readSnapshot(owner)).documents[0].blob instanceof ArrayBuffer);
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('studypdf-library',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);const r=tx.objectStore('documents').get([owner,id]);r.onsuccess=()=>tx.objectStore('documents').put({...r.result,name:'legacy.pdf',blob:new Blob([bytes])});});db.close();
 assert.deepEqual(await(await loadDocument(owner,id)).arrayBuffer(),bytes);
 const exported=await parseArchive(owner,await exportLibrary(owner));assert.equal(exported.documents[0].name,'legacy.pdf');
});

import {GENERAL_CHAT_ID} from '../src/services/library/store.ts';
test('general chats persist without PDF, number independently, isolate owners and survive archive roundtrip',async()=>{
 const owner='user:111111111111111111111111',other='user:222222222222222222222222';
 const general={...turn,selection:{pageNumber:1,cleanedText:'',context:{before:'',after:''}}};
 await saveChat(owner,GENERAL_CHAT_ID,'general-one',[general],0);await saveChat(owner,GENERAL_CHAT_ID,'general-two',[general],0);
 assert.deepEqual(await listDocuments(owner),[]);assert.equal((await listChats(owner,GENERAL_CHAT_ID)).length,2);assert.deepEqual(await listChats(other,GENERAL_CHAT_ID),[]);
 await renameChat(owner,GENERAL_CHAT_ID,'general-one','Ôn tập riêng');assert.equal((await loadChat(owner,GENERAL_CHAT_ID,'general-one')).title,'Ôn tập riêng');
 const archive=await exportLibrary(owner);await importLibrary(other,archive);assert.equal((await listChats(other,GENERAL_CHAT_ID)).length,2);assert.deepEqual(await listDocuments(other),[]);await assert.rejects(loadDocument(owner,GENERAL_CHAT_ID));
 await deleteChat(owner,GENERAL_CHAT_ID,'general-one');await assert.rejects(saveChat(owner,GENERAL_CHAT_ID,'general-one',[general],1));
 await clearAccountLibrary(owner);await assert.rejects(saveChat(owner,GENERAL_CHAT_ID,'late',[general],0));
});
test('archive rejects a general container carrying PDF bytes or an unreserved identifier',async()=>{
 const owner='user:333333333333333333333333';const json=JSON.stringify({version:1,documents:[{id:'f'.repeat(64),kind:'general',name:'bad',size:0,openedAt:1,updatedAt:1,nextChatNumber:1}],chats:[]});const bytes=new TextEncoder().encode(json),size=new Uint8Array(4);new DataView(size.buffer).setUint32(0,bytes.length);await assert.rejects(parseArchive(owner,new Blob(['STUDYPDF1\n',size,bytes])));
});

test('repeated import of a deleted document and chat converges without extra writes',async()=>{
 const owner='user:444444444444444444444444',id=await pdfId(bytes);await saveDocument(owner,id,new File([bytes],'deleted.pdf'));await saveChat(owner,id,'deleted-chat',[turn],0);await deleteDocument(owner,id);await mergeSnapshot(owner,await readSnapshot(owner),false);const before=await readSnapshot(owner);let changes=0;const {subscribeLibrary}=await import('../src/services/library/store.ts');const stop=subscribeLibrary(()=>changes++);try{await mergeSnapshot(owner,before,false);assert.equal(changes,0);assert.deepEqual(await readSnapshot(owner),before);}finally{stop();}
});
