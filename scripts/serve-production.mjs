import {createServer,request} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {isIP} from 'node:net';
export function createWebServer({root=resolve('dist'),apiPort=3001,token,origins=[],trustLoopback=false}){
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.gz':'application/gzip','.bcmap':'application/octet-stream'};
 return createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  const fail=(code,message)=>{res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});res.end(message);};
  if(req.url?.startsWith('/api/')){
   if(req.headers.origin&&!origins.includes(req.headers.origin)){fail(403,'Nguồn yêu cầu không được phép.');return;}
   const headers={...req.headers,authorization:`Bearer ${token}`};delete headers['x-forwarded-for'];delete headers['x-real-ip'];
   const remote=req.socket.remoteAddress||'';
   const real=req.headers['x-real-ip'];
   headers['x-real-ip']=trustLoopback&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)&&typeof real==='string'&&isIP(real)?real:remote;
   const upstream=request({host:'127.0.0.1',port:apiPort,path:req.url,method:req.method,headers},response=>{res.writeHead(response.statusCode||502,response.headers);response.pipe(res);});
   upstream.setTimeout(190000,()=>upstream.destroy());
   upstream.on('error',()=>{if(!res.headersSent)fail(502,'Máy chủ tạm chưa sẵn sàng.');else res.destroy();});
   req.on('aborted',()=>upstream.destroy());res.on('close',()=>{if(!res.writableEnded)upstream.destroy();});req.pipe(upstream);return;
  }
  if(!['GET','HEAD'].includes(req.method)){fail(405,'Phương thức không hỗ trợ.');return;}
  let path;try{path=decodeURIComponent((req.url||'/').split('?')[0]);}catch{fail(400,'Đường dẫn không hợp lệ.');return;}
  if(path.includes('\\')||path.split('/').some(p=>p==='..'||p.startsWith('.'))){fail(404,'Không tìm thấy trang.');return;}
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+sep)){fail(404,'Không tìm thấy trang.');return;}
  try{const info=await stat(file);if(!info.isFile()){fail(404,'Không tìm thấy trang.');return;}
   res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':path.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'});
   if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{fail(404,'Không tìm thấy trang.');}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(!process.env.AI_ACCESS_TOKEN)throw new Error('Cần AI_ACCESS_TOKEN phía máy chủ.');
 const apiPort=Number(process.env.PORT||3001),webPort=Number(process.env.WEB_PORT||8080);
 if(!Number.isInteger(webPort)||webPort<1||webPort>65535||webPort===apiPort)throw new Error('WEB_PORT không hợp lệ hoặc trùng PORT.');
 const child=spawn(process.execPath,['--experimental-strip-types','backend/src/index.ts'],{stdio:'inherit',env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',TRUST_PROXY:'loopback'}});
 const server=createWebServer({token:process.env.AI_ACCESS_TOKEN,apiPort,origins:(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()),trustLoopback:process.env.TRUST_PROXY==='loopback'});
 let closing=false;const stop=()=>{if(closing)return;closing=true;server.close();server.closeAllConnections();child.kill('SIGTERM');};
 child.on('error',()=>{console.error('Không khởi động được API.');process.exitCode=1;stop();});child.on('exit',code=>{if(!closing){process.exitCode=code||1;stop();}});
 server.on('error',()=>{console.error('Không mở được cổng web.');process.exitCode=1;stop();});
 server.listen(webPort,process.env.WEB_HOST||'127.0.0.1',()=>console.log(`Web production sẵn sàng ở cổng ${webPort}.`));
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
