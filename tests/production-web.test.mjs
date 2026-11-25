import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWebServer} from '../scripts/serve-production.mjs';
import {clientAddress} from '../backend/src/auth/clientAddress.ts';
test('production gateway serves only build files, replaces credentials and rejects foreign origins',async t=>{
 const root=await mkdtemp(join(tmpdir(),'studypdf-gateway-'));await writeFile(join(root,'index.html'),'<h1>Reader</h1>');await writeFile(join(root,'.env'),'must-not-leak');
 const api=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({authorization:req.headers.authorization,ip:req.headers['x-real-ip']}));});api.listen(0,'127.0.0.1');await once(api,'listening');
 const web=createWebServer({root,apiPort:api.address().port,token:'test-only-internal',origins:['https://study.example.test']});web.listen(0,'127.0.0.1');await once(web,'listening');
 t.after(async()=>{web.closeAllConnections();api.closeAllConnections();await Promise.all([new Promise(r=>web.close(r)),new Promise(r=>api.close(r))]);await rm(root,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${web.address().port}`;
 const page=await fetch(base);assert.equal(page.status,200);assert.equal(page.headers.get('x-content-type-options'),'nosniff');
 for(const path of ['/.env','/%2eenv','/missing','/%2e%2e%2f.env'])assert.equal((await fetch(base+path)).status,404);
 assert.equal((await fetch(base+'/api/health',{headers:{Origin:'https://foreign.test'}})).status,403);
 const body=await (await fetch(base+'/api/health',{headers:{Origin:'https://study.example.test',Authorization:'Bearer browser-forgery','X-Real-IP':'8.8.8.8'}})).json();assert.equal(body.authorization,'Bearer test-only-internal');assert.equal(body.ip,'127.0.0.1');
});
test('client address is never accepted from untrusted proxy headers',()=>{
 const old=process.env.TRUST_PROXY,key=process.env.AI_ACCESS_TOKEN;process.env.TRUST_PROXY='loopback';process.env.AI_ACCESS_TOKEN='test-proxy-key';
 try{const request={socket:{remoteAddress:'127.0.0.1'},headers:{'x-real-ip':'1.2.3.4',authorization:'Bearer test-proxy-key'}};assert.equal(clientAddress(request),'1.2.3.4');assert.equal(clientAddress({...request,headers:{'x-real-ip':'1.2.3.4'}}),'127.0.0.1');assert.equal(clientAddress({...request,socket:{remoteAddress:'5.6.7.8'}}),'5.6.7.8');}
 finally{if(old===undefined)delete process.env.TRUST_PROXY;else process.env.TRUST_PROXY=old;if(key===undefined)delete process.env.AI_ACCESS_TOKEN;else process.env.AI_ACCESS_TOKEN=key;}
});
