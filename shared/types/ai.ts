export type AiAction = "explain" | "translate" | "ask";

export interface AiExcerpt {
  cleanedText: string;
  context: { before: string; after: string };
}
