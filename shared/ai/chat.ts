export interface ChatContextTurn { question: string; answer: string; }

/** Bound provider context independently of the complete local transcript. */
export function recentChatContext(turns: ChatContextTurn[]): ChatContextTurn[] {
  const result: ChatContextTurn[] = [];
  let remaining = 6000;
  for (const turn of turns.slice(-6).reverse()) {
    const question = turn.question.slice(0, 2000);
    const answer = turn.answer.slice(0, 2000);
    if (question.length + answer.length > remaining) break;
    result.unshift({ question, answer });
    remaining -= question.length + answer.length;
  }
  return result;
}

export function validateChatContext(value: unknown): ChatContextTurn[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 6) throw new Error('Lịch sử hội thoại không hợp lệ.');
  let size = 0;
  return value.map(turn => {
    if (!turn || typeof turn.question !== 'string' || typeof turn.answer !== 'string'
      || !turn.question.trim() || !turn.answer.trim() || turn.question.length > 2000 || turn.answer.length > 2000) {
      throw new Error('Lịch sử hội thoại không hợp lệ.');
    }
    size += turn.question.length + turn.answer.length;
    if (size > 6000) throw new Error('Ngữ cảnh hội thoại quá dài.');
    // Do not accept caller-supplied roles/system instructions as message roles.
    return { question: turn.question, answer: turn.answer };
  });
}
