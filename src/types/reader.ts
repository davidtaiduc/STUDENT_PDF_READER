import type {OcrOptions} from '../services/pdf/ocr';
import type {PdfSelection} from './selection';
export interface ReaderContext {
 currentPage:number;
 totalPages:number;
 prepare:(pages:number[],signal:AbortSignal,options?:OcrOptions)=>Promise<PdfSelection>;
}
