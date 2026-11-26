import {test} from 'node:test';import assert from 'node:assert/strict';
import {createAutoSync} from '../src/services/library/autoSyncController.ts';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('automatic synchronization debounces edits, never overlaps and queues changes during upload',async()=>{
 let calls=0,active=0,max=0,release;const states=[];
 const c=createAutoSync({debounceMs:10,retryMs:10,canRun:()=>true,onState:s=>states.push(s),run:async()=>{calls++;active++;max=Math.max(max,active);if(calls===1)await new Promise(r=>release=r);active--;return new Date();}});
 try{c.change();c.change();c.change();await wait(30);assert.equal(calls,1);c.change();release();await wait(40);assert.equal(calls,2);assert.equal(max,1);assert.equal(states.at(-1).phase,'saved');}finally{c.stop();}
});
test('automatic synchronization waits for busy chats, retries network failures, and cancels on logout',async()=>{
 let ready=false,calls=0,aborted=false;const states=[];
 const c=createAutoSync({debounceMs:5,retryMs:10,canRun:()=>ready,onState:s=>states.push(s),run:async signal=>{calls++;if(calls===1)throw new Error('offline');await new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);}));return new Date();}});
 c.retry();await wait(20);assert.equal(calls,0);ready=true;await wait(35);assert.ok(states.some(s=>s.phase==='error'));assert.equal(calls,2);c.stop();await wait(10);assert.equal(aborted,true);const count=states.length;c.change();c.retry();await wait(15);assert.equal(states.length,count);
});


test('focus events during an upload do not queue redundant downloads, actual changes still do',async()=>{
 let calls=0,release;const c=createAutoSync({debounceMs:5,canRun:()=>true,onState:()=>{},run:async()=>{calls++;if(calls===1)await new Promise(r=>release=r);return new Date();}});
 try{c.retry();await wait(15);for(let i=0;i<10;i++)c.retry();release();await wait(25);assert.equal(calls,1);c.change();await wait(20);assert.equal(calls,2);}finally{c.stop();}
});
