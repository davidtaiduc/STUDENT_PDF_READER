import { performance } from 'node:perf_hooks';
import { hashPassword, verifyPassword } from '../backend/src/auth/password.ts';
const password='benchmark-only-not-a-real-account';
const average=values=>Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100;
const hashes=[],verifies=[];let hash;
for(let i=0;i<3;i++){let start=performance.now();hash=await hashPassword(password);hashes.push(performance.now()-start);start=performance.now();if(!await verifyPassword(hash,password))throw new Error('Verification failed');verifies.push(performance.now()-start);}
const concurrent=[];for(let i=0;i<2;i++){const start=performance.now();await Promise.all([hashPassword(password),hashPassword(password)]);concurrent.push(performance.now()-start);}
console.log(JSON.stringify({node:process.version,platform:process.platform,algorithm:'Argon2id',memoryKiB:65536,timeCost:3,parallelism:1,sequentialSamples:3,hashMeanMs:average(hashes),verifyMeanMs:average(verifies),concurrency:2,concurrentBatches:2,pairHashMeanMs:average(concurrent),note:'Bounded local measurement; not a production capacity test. About 128 MiB configured hash memory at concurrency 2, excluding Node overhead.'},null,2));
