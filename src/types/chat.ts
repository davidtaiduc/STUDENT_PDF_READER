import type { ContextScope } from '../../shared/ai/contextScope.ts';
import type { AiAction } from '../../shared/types/ai.ts';
import type { AiErrorCode } from '../../shared/ai/errors.ts';
export type ChatExcerpt = {ocr?:boolean;pageNumber:number;cleanedText:string;context:{before:string;after:string};scope?:ContextScope};
export interface ChatTurn {
  action?: AiAction;
  id: string; question: string; answer: string; model: string; createdAt: number;
  selection: ChatExcerpt;
  status: 'loading' | 'streaming' | 'ready' | 'stopped' | 'error';
  error?: { message: string; code: AiErrorCode; retryable: boolean; retryAt: number };
}
