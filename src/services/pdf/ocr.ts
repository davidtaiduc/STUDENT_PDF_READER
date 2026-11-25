import type {PDFDocumentProxy} from 'pdfjs-dist';
import {MAX_CONTEXT_CHARACTERS,validateContextScope} from '../../../shared/ai/contextScope.ts';
export type OcrLanguage='eng'|'vie'|'eng+vie';
export interface OcrOptions {ocr?:boolean;language?:OcrLanguage;onProgress?:(text:string)=>void}
const cache=new WeakMap<PDFDocumentProxy,Map<string,string>>();
async function abortable<T>(task:Promise<T>,signal:AbortSignal){
 signal.throwIfAborted();let cancel=()=>{};
 try{return await Promise.race([task,new Promise<never>((_,reject)=>{cancel=()=>reject(signal.reason??new DOMException('Đã hủy','AbortError'));signal.addEventListener('abort',cancel,{once:true});})]);}
 finally{signal.removeEventListener('abort',cancel);}
}
export async function extractOcrContext(pdf:PDFDocumentProxy,pages:number[],signal:AbortSignal,options:OcrOptions){
 validateContextScope({kind:pages.length===1?'page':'pages',pages});
 const {createWorker}=await import('tesseract.js');signal.throwIfAborted();
 const language=options.language??'eng+vie';if(!['eng','vie','eng+vie'].includes(language))throw new Error('Ngôn ngữ nhận dạng không hợp lệ.');
 const base=new URL(`${import.meta.env.BASE_URL}ocr/`,document.baseURI).href;
 let pageNumber=pages[0];options.onProgress?.('Đang nạp bộ nhận dạng chữ trên máy…');
 const pending=createWorker(language,1,{workerPath:`${base}worker.min.js`,corePath:`${base}core/`,langPath:`${base}lang`,workerBlobURL:false,logger:m=>{if(!signal.aborted&&m.status==='recognizing text')options.onProgress?.(`Đang nhận dạng chữ trang ${pageNumber}: ${Math.round(m.progress*100)}%`);}});
 const cancel=()=>{void pending.then(w=>w.terminate()).catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 let worker:Awaited<typeof pending>|undefined;const entries=cache.get(pdf)??new Map<string,string>();cache.set(pdf,entries);
 try{
  worker=await abortable(pending,signal);let combined='';
  for(const number of pages){pageNumber=number;signal.throwIfAborted();const key=`${number}:${language}`;let text=entries.get(key);
   if(text===undefined){const page=await pdf.getPage(number),original=page.getViewport({scale:1});const scale=Math.min(2,Math.sqrt(4_000_000/(original.width*original.height)));const viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const context=canvas.getContext('2d');if(!context)throw new Error('Trình duyệt này chưa hỗ trợ nhận dạng chữ.');
    const render=page.render({canvas,canvasContext:context,viewport});const stopRender=()=>render.cancel();signal.addEventListener('abort',stopRender,{once:true});
    try{await abortable(render.promise,signal);const result=await abortable(worker.recognize(canvas),signal);text=result.data.text.trim();entries.set(key,text);}
    finally{signal.removeEventListener('abort',stopRender);canvas.width=0;canvas.height=0;}
   }
   if(!text)throw new Error(`Không nhận được chữ ở trang ${number}. Hãy thử ảnh rõ hơn hoặc ngôn ngữ khác.`);
   const part=`[Trang ${number} · Chữ nhận dạng, cần kiểm tra lại]\n${text}`;if(combined.length+part.length+2>MAX_CONTEXT_CHARACTERS)throw new Error('Kết quả nhận dạng vượt 12.000 ký tự. Hãy chọn ít trang hơn.');combined+=(combined?'\n\n':'')+part;
  }
  return combined;
 }catch(error){signal.throwIfAborted();if(error instanceof Error&&!(error instanceof TypeError))throw error;throw new Error('Chưa nhận dạng được chữ. Hãy thử lại với ít trang hơn.',{cause:error});}
 finally{signal.removeEventListener('abort',cancel);if(worker)await worker.terminate().catch(()=>{});}
}

/** Render only the selected rectangle; never allocate a full-page scan canvas. */
export async function extractOcrRegion(pdf:PDFDocumentProxy,pageNumber:number,region:import('./ocrRegion').NormalizedRegion,signal:AbortSignal,options:OcrOptions={}){
 const {regionViewport}=await import('./ocrRegion');
 const language=options.language??'eng+vie';if(!['eng','vie','eng+vie'].includes(language))throw new Error('Ngôn ngữ nhận dạng không hợp lệ.');
 signal.throwIfAborted();const page=await pdf.getPage(pageNumber);signal.throwIfAborted();
 const original=page.getViewport({scale:1}),crop=regionViewport(original.width,original.height,region),viewport=page.getViewport({scale:crop.scale});
 const canvas=document.createElement('canvas');canvas.width=crop.width;canvas.height=crop.height;
 const context=canvas.getContext('2d');if(!context)throw new Error('Trình duyệt này chưa hỗ trợ nhận dạng chữ.');
 let worker:Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>|undefined;
 const render=page.render({canvas,canvasContext:context,viewport,transform:[1,0,0,1,-crop.left,-crop.top]});
 const stop=()=>{render.cancel();void worker?.terminate().catch(()=>{});};signal.addEventListener('abort',stop,{once:true});
 try{
  await abortable(render.promise,signal);options.onProgress?.('Đang nạp bộ nhận dạng chữ trên máy…');
  const {createWorker}=await import('tesseract.js');signal.throwIfAborted();const base=new URL(`${import.meta.env.BASE_URL}ocr/`,document.baseURI).href;
  const pending=createWorker(language,1,{workerPath:`${base}worker.min.js`,corePath:`${base}core/`,langPath:`${base}lang`,workerBlobURL:false,logger:m=>{if(!signal.aborted&&m.status==='recognizing text')options.onProgress?.(`Nhận dạng vùng chọn: ${Math.round(m.progress*100)}%`);}});
  void pending.then(w=>{if(signal.aborted)void w.terminate().catch(()=>{});}).catch(()=>{});
  worker=await abortable(pending,signal);
  const result=await abortable(worker.recognize(canvas),signal);signal.throwIfAborted();const text=result.data.text.trim();
  if(!text)throw new Error('Không nhận được chữ trong vùng này. Hãy chọn sát nội dung hoặc đổi ngôn ngữ.');
  if(text.length>MAX_CONTEXT_CHARACTERS)throw new Error('Vùng nhận dạng vượt 12.000 ký tự. Hãy chọn vùng nhỏ hơn.');return text;
 }catch(error){signal.throwIfAborted();if(error instanceof Error&&!(error instanceof TypeError))throw error;throw new Error('Chưa nhận dạng được vùng chọn. Hãy thử lại.',{cause:error});}
 finally{signal.removeEventListener('abort',stop);await render.promise.catch(()=>{});canvas.width=0;canvas.height=0;if(worker)await worker.terminate().catch(()=>{});}
}
