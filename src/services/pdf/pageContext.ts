import type { PDFDocumentProxy } from 'pdfjs-dist';
import {MAX_CONTEXT_CHARACTERS,validateContextScope} from '../../../shared/ai/contextScope.ts';
import {normalizePdfSelection} from '../../utils/normalizePdfSelection.ts';
export async function extractPageContext(pdf:Pick<PDFDocumentProxy,'numPages'|'getPage'>,pages:number[],signal:AbortSignal){
 validateContextScope({kind:pages.length===1?'page':'pages',pages});
 let text='';
 for(const number of pages){
  signal.throwIfAborted();if(number>pdf.numPages)throw new Error('Trang nằm ngoài tài liệu.');
  const page=await pdf.getPage(number);signal.throwIfAborted();
  const content=await page.getTextContent();signal.throwIfAborted();
  const body=normalizePdfSelection(content.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join(''));
  if(!body.trim())throw new Error(`Trang ${number} chưa có lớp chữ. PDF scan cần OCR; hãy chọn trang khác.`);
  const part=`[Trang ${number}]\n${body}`;
  if(text.length+part.length+2>MAX_CONTEXT_CHARACTERS)throw new Error(`Ngữ cảnh vượt ${MAX_CONTEXT_CHARACTERS.toLocaleString('vi-VN')} ký tự. Chọn ít trang hơn hoặc tô đen đoạn cần hỏi; nội dung không bị cắt âm thầm.`);
  text+=(text?'\n\n':'')+part;
 }
 return text;
}
