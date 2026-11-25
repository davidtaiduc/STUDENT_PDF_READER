import {ObjectId} from 'mongodb';
import {hashPassword} from '../backend/src/auth/password.ts';
import {execFileSync} from 'node:child_process';
import { createServer as createVite } from 'vite';
import { createApi } from '../backend/src/app.ts';
import { createAuthHandler } from '../backend/src/auth/handler.ts';
import { resolveSession } from '../backend/src/auth/security.ts';
import { createUserQuota } from '../backend/src/services/usage/userQuota.ts';
import { fakeAuthRepository } from '../tests/helpers/authRepository.mjs';
import { fakeUserUsage } from '../tests/helpers/userUsage.mjs';
const auth=fakeAuthRepository(),quota=createUserQuota(fakeUserUsage(),30,5),origin='http://127.0.0.1:5181';
// Repeated browser logins share one fake account. Rate policy is covered in unit/API tests.
const fixtureConsume=auth.consume;auth.consume=(key,...args)=>key.startsWith('login:')?Promise.resolve(true):fixtureConsume(key,...args);
await auth.insertUser({_id:new ObjectId('eeeeeeeeeeeeeeeeeeeeeeee'),email:'reader-fixture@example.test',displayName:'Bạn đọc kiểm thử',passwordHash:await hashPassword('fake-reader-password'),createdAt:new Date(),updatedAt:new Date(),sessionVersion:0});
// Ephemeral per-browser-session archives keep visual tests independent.
// Production uses user-scoped GridFS; no .env or application database is read here.
const archives=new Map();
const libraryHandler=async(req,res)=>{
 const authn=await resolveSession(auth,req.headers.cookie);const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(!authn){send(401,{error:'Vui lòng đăng nhập.'});return;}
 if(req.headers['x-library-owner']!==authn.user._id.toHexString()){send(409,{error:'Tài khoản đã thay đổi.'});return;}
 const key=authn.session._id.toHexString(),entry=archives.get(key);res.setHeader('ETag',`"${entry?.revision??0}"`);
 if(req.method==='HEAD'){res.writeHead(entry?200:404);res.end();return;}
 if(req.method==='GET'){if(!entry){send(404,{error:'Chưa có bản máy chủ.'});return;}res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':entry.body.length});res.end(entry.body);return;}
 if(req.method!=='PUT'){send(405,{error:'Phương thức không hỗ trợ.'});return;}
 if(req.headers['if-match']!==`"${entry?.revision??0}"`){send(409,{error:'Xung đột phiên bản.'});return;}
 const chunks=[];for await(const part of req)chunks.push(part);const body=Buffer.concat(chunks),revision=(entry?.revision??0)+1;archives.set(key,{body,revision});res.setHeader('ETag',`"${revision}"`);send(200,{revision});
};
const api=createApi({libraryHandler,authHandler:createAuthHandler(auth,[origin],false),authenticate:async h=>h==='Bearer fixture-internal'?{kind:'app',id:'preview'}:null,
authenticateUser:async cookie=>{const a=await resolveSession(auth,cookie);return a?{kind:'user',id:a.user._id.toHexString()}:null;},origins:[origin],model:'fixture',maxConcurrent:3,aiConfigured:true,readUsage:quota.read,consumeQuota:quota.consume,getHealth:async()=>({service:'student-pdf-reader-api',database:'connected',ai:{configured:true},accounts:{enabled:true},requestLimits:'limited'}),generate:async(_m,signal,onText)=>{await onText("### Hiểu đoạn đang đọc\n\nĐây là phản hồi giả dùng để kiểm tra giao diện. Năng lượng liên hệ với khối lượng qua công thức $E=mc^2$.\n\n**Điểm cần nhớ:** công thức cho biết một lượng khối lượng nhỏ có thể tương ứng với năng lượng rất lớn, vì hệ số $c^2$ rất lớn.\n\n1. $E$ là năng lượng, đơn vị joule.\n2. $m$ là khối lượng, đơn vị kilogram.\n3. $c$ là tốc độ ánh sáng trong chân không.\n\n### Ví dụ và cách đọc\n\nĐọc chậm từng ký hiệu, đối chiếu với đoạn PDF ở bên trái. Bạn có thể chuyển trang hoặc zoom để xem công thức rõ hơn trong khi vẫn giữ nguyên cuộc hội thoại.\n\nNếu tài liệu chưa cung cấp đủ giả thiết, hãy hỏi thêm về ý nghĩa của từng đại lượng trước khi thay số.\n");await new Promise(resolve=>setTimeout(resolve,200));signal.throwIfAborted();}});
api.listen(3019,'127.0.0.1');
const vite=await createVite({configFile:false,envDir:false,envPrefix:[],define:{'import.meta.env.VITE_AI_API_URL':JSON.stringify('')},server:{host:'127.0.0.1',port:5181,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:3019',configure(proxy){proxy.on('proxyReq',upstream=>upstream.setHeader('authorization','Bearer fixture-internal'));}}}}});await vite.listen();
const reference=process.env.UI_BASELINE_REF||'b17c449';
const git=path=>execFileSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'show',`${reference}:${path}`],{encoding:'utf8'});
const previous=new Map(['src/App.tsx','src/components/Auth/AccountMenu.tsx','src/components/AiPanel/ChatPanel.tsx','src/index.css'].map(path=>[path,git(path)]));
const oldHtml=git('index.html');
const baseline=await createVite({configFile:false,envDir:false,envPrefix:[],plugins:[{name:'read-only-visual-baseline',enforce:'pre',load(id){const file=id.replaceAll('\\','/').split('?')[0];for(const [path,content] of previous)if(file.endsWith('/'+path))return content;},transformIndexHtml:{order:'pre',handler:()=>oldHtml}}],server:{host:'127.0.0.1',port:5182,strictPort:true,proxy:{'/api':'http://127.0.0.1:3019'}}});await baseline.listen();
console.log('Visual QA ready: current 5181, read-only baseline 5182; fake auth/AI, no .env or MongoDB.');

const stop=async()=>{await vite.close();await baseline.close();api.closeAllConnections();api.close();};process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
