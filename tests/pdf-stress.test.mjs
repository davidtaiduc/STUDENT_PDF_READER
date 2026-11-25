import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createPdf} from '../scripts/make-stress-pdfs.mjs';
import {resolve} from 'node:path';
const options=data=>({data:new Uint8Array(data),standardFontDataUrl:resolve('node_modules/pdfjs-dist/standard_fonts').replaceAll('\\','/')+'/'});
test('300-page PDF parses first, middle and last pages without loading text for every page',async()=>{
 const task=getDocument(options(createPdf()));try{const pdf=await task.promise;assert.equal(pdf.numPages,300);for(const n of [1,150,300]){const page=await pdf.getPage(n),text=await page.getTextContent();assert.match(text.items.map(i=>i.str||'').join(' '),new RegExp(`page ${n}`));page.cleanup();}}finally{await task.destroy();}
});
test('image-only PDF is readable and has no selectable text; malformed PDFs are rejected',async()=>{
 const task=getDocument(options(createPdf(2,true)));try{const pdf=await task.promise,page=await pdf.getPage(1);assert.equal((await page.getTextContent()).items.length,0);assert.ok((await page.getOperatorList()).fnArray.length>0);}finally{await task.destroy();}
 const broken=getDocument(options(Buffer.from('%PDF-1.4 corrupted')));try{await assert.rejects(broken.promise);}finally{await broken.destroy();}
});
