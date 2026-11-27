import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function entry(url){const parsed=new URL(url);let target=null;runInNewContext(script,{URLSearchParams,location:{hostname:parsed.hostname,pathname:parsed.pathname,search:parsed.search,hash:parsed.hash,replace:value=>target=value}});return target;}
test('Render opens the introduction while reader, email links and Vercel remain reachable',()=>{
 const root='https://student-pdf-reader-1.onrender.com/';
 assert.equal(entry(root),'/gioi-thieu.html');
 for(const url of [root+'?start=1',root+'#verify-email='+'a'.repeat(64),root+'#reset-password='+'a'.repeat(64),root+'index.html','https://studypdf-omega.vercel.app/','http://127.0.0.1:5173/'])assert.equal(entry(url),null);
});
