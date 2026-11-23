import type { ContextScope } from '../ai/contextScope.ts';
export type AiAction = "explain" | "translate" | "ask";

export interface AiExcerpt {
  scope?: ContextScope;
  cleanedText: string;
  context: { before: string; after: string };
}
