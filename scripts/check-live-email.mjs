import {configureDns} from '../backend/src/config/dns.ts';
import {MongoClient} from 'mongodb';
import {randomBytes} from 'node:crypto';
import {readProjectEnvironment} from '../backend/src/config/environment.ts';
import {mongoAuthRepository} from '../backend/src/auth/repository.ts';
import {mongoEmailRepository,emailTokenHash,resendMailer} from '../backend/src/auth/email.ts';
import {mkdir,writeFile} from 'node:fs/promises';
const env=readProjectEnvironment(process.cwd()),recipient=process.argv[2];
if(!recipient||!/^\S+@\S+\.\S+$/.test(recipient))throw new Error('Provide the explicitly authorized recipient.');
const report={at:new Date().toISOString(),configured:!!(env.RESEND_API_KEY&&env.MAIL_FROM),database:false,accountFound:false,sent:[]};
configureDns(env.MONGODB_DNS_SERVERS);
const client=new MongoClient(env.MONGODB_URI||'',{serverSelectionTimeoutMS:10000});
try{if(!report.configured)throw new Error('missing-mail-config');await client.connect();report.database=true;const db=client.db(env.MONGODB_DB||'student_pdf_reader'),repo=mongoAuthRepository(db),user=await repo.findUser(recipient.trim().toLowerCase());report.accountFound=!!user;if(user){const tokens=mongoEmailRepository(db),mail=resendMailer(env.RESEND_API_KEY,env.MAIL_FROM);for(const purpose of ['verify','reset']){const token=randomBytes(32).toString('hex'),url=new URL(env.APP_PUBLIC_URL||env.ALLOWED_ORIGINS?.split(',')[0]);url.hash=`${purpose==='verify'?'verify-email':'reset-password'}=${token}`;await tokens.issue(user,purpose,emailTokenHash(token),new Date(Date.now()+(purpose==='verify'?86400000:1800000)));try{await mail.send(user.email,purpose,url.href);report.sent.push({purpose,accepted:true});}catch{report.sent.push({purpose,accepted:false});}}}}catch{report.error='Mail configuration, database or provider check failed. Credentials and links are not recorded.';}finally{await client.close();}
await mkdir('tmp',{recursive:true});await writeFile('tmp/live-email-readiness.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.sent.length!==2||report.sent.some(s=>!s.accepted))process.exitCode=1;
