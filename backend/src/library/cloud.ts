import {GridFSBucket,type Db,type ObjectId} from 'mongodb';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {AuthRepository} from '../auth/repository.ts';
import {resolveSession} from '../auth/security.ts';
interface Head {_id:string;revision:number;blobId:ObjectId;size:number;updatedAt:Date;deleted?:boolean}
const MAX=544*1024*1024;
export function createLibraryHandler(repo:AuthRepository,db:Db,origins:string[]){
 const bucket=new GridFSBucket(db,{bucketName:'library_archives_v1'}),heads=db.collection<Head>('library_heads_v1');
 let uploads=0;
 return async(req:IncomingMessage,res:ServerResponse)=>{
  const send=(status:number,error:string)=>{if(!res.headersSent){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({error}));}else res.destroy();};
  try{
   if(req.url!=='/api/library/archive'){send(404,'Không tìm thấy API.');return;}
   if(!['GET','PUT','HEAD'].includes(req.method??'')){send(405,'Phương thức không hỗ trợ.');return;}
   if(req.method==='PUT'&&(!req.headers.origin||!origins.includes(req.headers.origin))){send(403,'Nguồn yêu cầu không được phép.');return;}
   const auth=await resolveSession(repo,req.headers.cookie);if(!auth){send(401,'Vui lòng đăng nhập để đồng bộ thư viện.');return;}
   const userId=auth.user._id.toHexString();if(req.headers['x-library-owner']&&req.headers['x-library-owner']!==userId){send(409,'Tài khoản đã thay đổi. Hãy mở lại thư viện rồi đồng bộ.');return;}const head=await heads.findOne({_id:userId});
   if(head?.deleted){send(410,'Tài khoản đã xóa thư viện.');return;}
   res.setHeader('ETag',`"${head?.revision??0}"`);res.setHeader('Access-Control-Expose-Headers','ETag');
   if(req.method==='HEAD'){res.writeHead(head?200:404);res.end();return;}
   if(req.method==='GET'){
    if(!head){send(404,'Tài khoản chưa có thư viện trên máy chủ.');return;}
    res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Length',head.size);
    await pipeline(bucket.openDownloadStream(head.blobId),res);return;
   }
   const expected=req.headers['if-match'];if(expected!==`"${head?.revision??0}"`){send(409,'Thư viện trên tài khoản đã thay đổi. Hãy tải và hợp nhất trước khi lưu lại.');return;}
   if(req.headers['content-type']!=='application/octet-stream'){send(415,'Định dạng thư viện không hợp lệ.');return;}
   if(Number(req.headers['content-length'])>MAX){send(413,'Thư viện vượt giới hạn 544MB.');return;}
   if(uploads>=2){send(429,'Đang đồng bộ thư viện khác. Hãy thử lại sau.');return;}
   uploads++;const upload=bucket.openUploadStream('library.studypdf',{metadata:{userId}});let size=0,prefix=Buffer.alloc(0);const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),120000);
   try{
    const bounded=new Transform({transform(chunk,_,next){size+=chunk.length;if(size>MAX){next(new Error('too large'));return;}if(prefix.length<10)prefix=Buffer.concat([prefix,chunk]).subarray(0,10);this.push(chunk);next();}});
    await pipeline(req,bounded,upload,{signal:abort.signal});
    if(prefix.toString()!=='STUDYPDF1\n'||size<14){await bucket.delete(upload.id);send(400,'Bản sao lưu không hợp lệ.');return;}
    if(!await resolveSession(repo,req.headers.cookie)){await bucket.delete(upload.id);send(401,'Phiên đã hết hạn. Thư viện chưa được lưu.');return;}
    const revision=(head?.revision??0)+1;
    try{const saved=await heads.updateOne({_id:userId,revision:head?.revision??0,deleted:{$ne:true}},{$set:{revision,blobId:upload.id,size,updatedAt:new Date()}},{upsert:!head});if(!saved.matchedCount&&!saved.upsertedCount)throw new Error('conflict');}
    catch{await bucket.delete(upload.id);send(409,'Thư viện đã thay đổi trên thiết bị khác. Hãy đồng bộ lại.');return;}
    if(head)await bucket.delete(head.blobId).catch(()=>{});
    res.setHeader('ETag',`"${revision}"`);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({revision,size}));
   }catch{await upload.abort().catch(()=>{});await bucket.delete(upload.id).catch(()=>{});send(503,'Không lưu được thư viện. Bản trên máy vẫn được giữ.');}
   finally{clearTimeout(timer);uploads--;}
  }catch{send(503,'Dịch vụ đồng bộ chưa sẵn sàng. Hãy thử lại sau.');}
 };
}
