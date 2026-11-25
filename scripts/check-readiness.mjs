import {readProjectEnvironment} from '../backend/src/config/environment.ts';
import {existsSync} from 'node:fs';
const env=readProjectEnvironment(process.cwd()),strict=process.argv.includes('--production');
const required=['MONGODB_URI','AI_ACCESS_TOKEN','ALLOWED_ORIGINS','GEMINI_API_KEY','RESEND_API_KEY','MAIL_FROM','APP_PUBLIC_URL'];
const checks=required.map(name=>({name,passed:!!env[name]?.trim()}));
checks.push({name:'build:index',passed:existsSync('dist/index.html')},{name:'build:entry',passed:existsSync('dist/gioi-thieu.html')});
const origins=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim());
let publicUrl;try{publicUrl=new URL(env.APP_PUBLIC_URL);}catch{}
checks.push({name:'production:HTTPS',passed:publicUrl?.protocol==='https:',productionOnly:true},{name:'production:origin',passed:!!publicUrl&&origins.includes(publicUrl.origin)&&publicUrl.pathname==='/'&&!publicUrl.search&&!publicUrl.hash,productionOnly:true},{name:'production:same-origin API',passed:!env.VITE_AI_API_URL||env.VITE_AI_API_URL===publicUrl?.origin,productionOnly:true});
for(const name of ['USER_DAILY_REQUEST_LIMIT','USER_MINUTE_REQUEST_LIMIT','MAX_CONCURRENT_REQUESTS','GLOBAL_DAILY_AI_LIMIT'])checks.push({name,passed:!env[name]||Number.isSafeInteger(Number(env[name]))&&Number(env[name])>0});
checks.push({name:'private-token:length',passed:(env.AI_ACCESS_TOKEN||'').length>=32});
for(const c of checks)console.log(`${c.passed?'PASS':c.productionOnly&&!strict?'LOCAL':'FAIL'} ${c.name}`);
if(checks.some(c=>!c.passed&&(!c.productionOnly||strict)))process.exitCode=1;
console.log('No secrets displayed. This checks configuration only, not delivery, DNS, HTTPS certificates or load capacity.');
