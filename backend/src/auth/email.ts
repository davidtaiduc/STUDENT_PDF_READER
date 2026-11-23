import type { Db } from 'mongodb';
import type { IncomingMessage,ServerResponse } from 'node:http';
import { randomBytes,createHash } from 'node:crypto';
import type { AuthRepository,UserDocument } from './repository.ts';
import { AuthError,resolveSession,validatePassword,createPasswordWork,jsonBody } from './security.ts';
import { hashPassword } from './password.ts';
import { sessionCookie } from './session.ts';
type Purpose='reset'|'verify';
export interface EmailUser extends UserDocument {emailVerifiedAt?:Date; emailTokens?:Partial<Record<Purpose,{hash:string;expiresAt:Date;passwordHash:string}>>}
export interface EmailRepository {
 issue(user:UserDocument,purpose:Purpose,hash:string,expiresAt:Date):Promise<void>;
 find(hash:string,purpose:Purpose,now:Date):Promise<EmailUser|null>;
 complete(user:EmailUser,purpose:Purpose,hash:string,newPasswordHash?:string):Promise<boolean>;
}
export const emailTokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function mongoEmailRepository(db:Db):EmailRepository {
 const users=db.collection<EmailUser>('users');
 return {
  issue:async(user,purpose,hash,expiresAt)=>{await users.updateOne({_id:user._id,passwordHash:user.passwordHash},{$set:{[`emailTokens.${purpose}`]:{hash,expiresAt,passwordHash:user.passwordHash}}});},
  find:(hash,purpose,now)=>users.findOne({[`emailTokens.${purpose}.hash`]:hash,[`emailTokens.${purpose}.expiresAt`]:{$gt:now}}),
  async complete(user,purpose,hash,newPasswordHash){
   return (await users.updateOne({_id:user._id,passwordHash:user.passwordHash,[`emailTokens.${purpose}.hash`]:hash,[`emailTokens.${purpose}.expiresAt`]:{$gt:new Date()},[`emailTokens.${purpose}.passwordHash`]:user.passwordHash},purpose==='reset'?{$set:{passwordHash:newPasswordHash!,updatedAt:new Date()},$inc:{sessionVersion:1},$unset:{emailTokens:''}}:{$set:{emailVerifiedAt:new Date(),updatedAt:new Date()},$unset:{'emailTokens.verify':''}})).modifiedCount===1;
  },
 };
}
export interface Mailer {send(to:string,purpose:Purpose,link:string):Promise<void>}
export function resendMailer(apiKey:string,from:string):Mailer|undefined {
 if(!apiKey||!from)return undefined;
 return {async send(to,purpose,link){const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:purpose==='reset'?'Đặt lại mật khẩu StudyPDF AI':'Xác minh email StudyPDF AI',text:`${purpose==='reset'?'Đặt lại mật khẩu (hết hạn sau 30 phút)':'Xác minh email (hết hạn sau 24 giờ)'}:\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`})});if(!response.ok)throw new Error('Mail delivery failed');}};
}
export function createEmailHandler(repo:AuthRepository,tokens:EmailRepository,origins:string[],secure:boolean,appUrl:string,mailer?:Mailer){
 const work=createPasswordWork(repo);
 return async(req:IncomingMessage,res:ServerResponse)=>{
  const send=(status:number,data:object)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try{
   if(req.method!=='POST')throw new AuthError(405,'Chỉ hỗ trợ POST.');
   if(!req.headers.origin||!origins.includes(req.headers.origin))throw new AuthError(403,'Nguồn yêu cầu không được phép.');
   const input=await jsonBody(req),path=req.url;
   const bucket=Math.floor(Date.now()/900000),expiry=new Date((bucket+2)*900000);
   if(!await repo.consume(`email:ip:${emailTokenHash(req.socket.remoteAddress??'unknown')}:${bucket}`,15,expiry)||!await repo.consume(`email:global:${bucket}`,200,expiry))throw new AuthError(429,'Quá nhiều yêu cầu. Hãy thử lại sau 15 phút.');
   if(path==='/api/auth/forgot-password'||path==='/api/auth/resend-verification'){
    if(!mailer)throw new AuthError(503,'Dịch vụ email chưa được cấu hình.');
    const purpose=path.endsWith('forgot-password')?'reset':'verify';
    let user:UserDocument|null;
    if(purpose==='verify'){const auth=await resolveSession(repo,req.headers.cookie);if(!auth)throw new AuthError(401,'Vui lòng đăng nhập.');user=auth.user;}
    else{const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AuthError(400,'Email không hợp lệ.');user=await repo.findUser(email);}
    const subject=purpose==='verify'?user!.email:String(input.email).trim().toLowerCase();
    const allowed=await repo.consume(`email:${purpose}:${emailTokenHash(subject)}:${bucket}`,3,expiry);
    // Same public response for existing/unknown addresses and per-address throttling.
    if(user&&allowed&&!(purpose==='verify'&&(user as EmailUser).emailVerifiedAt)){
     const token=randomBytes(32).toString('hex');const link=new URL(appUrl);link.hash=`${purpose==='reset'?'reset-password':'verify-email'}=${token}`;
     await tokens.issue(user,purpose,emailTokenHash(token),new Date(Date.now()+(purpose==='reset'?1800000:86400000)));
     try{await mailer.send(user.email,purpose,link.href);}catch{console.error('Gửi email tài khoản thất bại. Kiểm tra cấu hình dịch vụ email.');}
    }
    send(200,{message:'Nếu yêu cầu hợp lệ, liên kết sẽ được gửi đến email. Hãy kiểm tra cả thư rác; có thể yêu cầu lại sau 15 phút.'});return;
   }
   const purpose=path==='/api/auth/reset-password'?'reset':path==='/api/auth/verify-email'?'verify':null;
   if(!purpose)throw new AuthError(404,'Không tìm thấy API.');
   const token=typeof input.token==='string'?input.token:'';if(!/^[a-f0-9]{64}$/.test(token))throw new AuthError(400,'Liên kết không hợp lệ hoặc đã hết hạn.');
   const hash=emailTokenHash(token),user=await tokens.find(hash,purpose,new Date());
   if(!user||user.emailTokens?.[purpose]?.passwordHash!==user.passwordHash)throw new AuthError(400,'Liên kết không hợp lệ hoặc đã hết hạn.');
   if(purpose==='reset'){
    const password=validatePassword(input.password);
    await work(req,'change-password',user._id.toHexString(),async()=>{if(!await tokens.complete(user,purpose,hash,await hashPassword(password)))throw new AuthError(400,'Liên kết đã được dùng hoặc hết hạn.');});
    res.setHeader('Set-Cookie',sessionCookie('',secure));
   }else if(!await tokens.complete(user,purpose,hash))throw new AuthError(400,'Liên kết đã được dùng hoặc hết hạn.');
   send(200,{message:purpose==='reset'?'Đã đổi mật khẩu và thu hồi tất cả phiên. Hãy đăng nhập lại.':'Email đã được xác minh.'});
  }catch(e){send(e instanceof AuthError?e.status:503,{error:e instanceof AuthError?e.message:'Không thực hiện được yêu cầu email. Hãy thử lại sau.'});}
 };
}
