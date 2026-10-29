export type AiAction = "explain" | "translate" | "ask";
export const actionLabels: Record<AiAction, string> = {
  explain: "Giải thích", translate: "Dịch", ask: "Hỏi AI",
};
