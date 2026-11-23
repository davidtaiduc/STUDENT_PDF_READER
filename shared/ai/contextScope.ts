export const MAX_CONTEXT_PAGES=5;
export const MAX_CONTEXT_CHARACTERS=12000;
export const MAX_PDF_BYTES=150*1024*1024;
export interface ContextScope {kind:'selection'|'page'|'pages';pages:number[]}
export function parsePageRange(value:string,totalPages:number):number[]{
 if(!Number.isSafeInteger(totalPages)||totalPages<1)throw new Error('Hãy mở PDF trước.');
 const pages=new Set<number>();
 for(const part of value.split(',')){
  const match=/^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);if(!match)throw new Error('Nhập dạng 2-4, 8.');
  const start=Number(match[1]),end=Number(match[2]??match[1]);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start||end>totalPages)throw new Error(`Số trang cần từ 1 đến ${totalPages}.`);
  if(end-start+1>MAX_CONTEXT_PAGES)throw new Error(`Mỗi lượt chọn tối đa ${MAX_CONTEXT_PAGES} trang, không giới hạn tổng số trang PDF.`);
  for(let page=start;page<=end;page++){pages.add(page);if(pages.size>MAX_CONTEXT_PAGES)throw new Error(`Mỗi lượt chọn tối đa ${MAX_CONTEXT_PAGES} trang.`);}
 }
 return [...pages].sort((a,b)=>a-b);
}
export function validateContextScope(input:unknown):ContextScope|undefined{
 if(input===undefined)return undefined;
 if(!input||typeof input!=='object')throw new Error('Phạm vi AI không hợp lệ.');
 const v=input as ContextScope;
 if(!['selection','page','pages'].includes(v.kind)||!Array.isArray(v.pages)||v.pages.length<1||v.pages.length>MAX_CONTEXT_PAGES||v.pages.some(p=>!Number.isSafeInteger(p)||p<1)||new Set(v.pages).size!==v.pages.length||(v.kind!=='pages'&&v.pages.length!==1))throw new Error('Phạm vi AI không hợp lệ.');
 return {kind:v.kind,pages:[...v.pages].sort((a,b)=>a-b)};
}
export function scopeLabel(scope:ContextScope|undefined,page:number){return scope?.kind==='page'?`Trang ${page}`:scope?.kind==='pages'?`Các trang ${scope.pages.join(', ')}`:`Đoạn đã chọn · Trang ${page}`;}
export const includesPage=(scope:ContextScope|undefined,pageNumber:number,filter:number)=>scope?scope.pages.includes(filter):pageNumber===filter;
