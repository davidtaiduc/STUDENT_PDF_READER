import {mkdir,writeFile} from 'node:fs/promises';
import {readProjectEnvironment} from '../backend/src/config/environment.ts';
import {generateGemini} from '../backend/src/services/ai/gemini.ts';
import {buildMessages} from '../backend/src/services/ai/prompts.ts';
const env=readProjectEnvironment(process.cwd());
const report={at:new Date().toISOString(),configured:!!env.GEMINI_API_KEY,cases:[]};
if(env.GEMINI_API_KEY){for(const [name,text,action] of [
 ['japanese','家の中は、いつも清潔にしておきたい。','translate'],
 ['english','A function receives input and returns output.','translate'],
 ['vietnamese','Mỗi hàm đảm nhận một nhiệm vụ rõ ràng.','translate'],
 ['math','The relation between energy and mass is E = mc².','translate'],
 ['multiple-choice','問題：正しいものを選びなさい。 1. 家 2. 学校','translate']
]){let output='';const started=Date.now();try{await generateGemini({apiKey:env.GEMINI_API_KEY,model:env.GEMINI_MODEL||'gemini-3.5-flash-lite',messages:buildMessages(action,{cleanedText:text,context:{before:'',after:''}}),signal:AbortSignal.timeout(45000),onText:async chunk=>{output+=chunk;}});const vietnamese=/[ăâđêôơưáàảãạấầẩẫậắằẳẵặếềểễệốồổỗộớờởỡợứừửữựíìỉĩịúùủũụéèẻẽẹóòỏõọýỳỷỹỵ]/i.test(output);report.cases.push({name,ms:Date.now()-started,output,passed:vietnamese&&output.trim()!==text.trim()||name==='vietnamese'&&output.trim()===text.trim()});}catch{report.cases.push({name,ms:Date.now()-started,passed:false,error:'Provider unavailable, timeout or invalid response. No credentials recorded.'});}}}
await mkdir('tmp',{recursive:true});await writeFile('tmp/live-ai-readiness.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));if(!report.configured||report.cases.some(c=>!c.passed))process.exitCode=1;
