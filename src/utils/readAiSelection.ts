import type { PdfSelection } from '../types/selection';

function answerFor(node: Node | null): HTMLElement | null {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest<HTMLElement>('.ai-answer[data-ai-selection-page]') ?? null;
}

/** Only text within one answer is eligible; never capture buttons/forms or
 * combine separate turns, a PDF range, and an AI answer into one request. */
export function readAiSelection(root: HTMLElement): PdfSelection | null {
  const selected = window.getSelection();
  if (!selected || selected.isCollapsed || selected.rangeCount !== 1) return null;
  const answer = answerFor(selected.anchorNode);
  if (!answer || answer !== answerFor(selected.focusNode) || !root.contains(answer)) return null;
  const pageNumber = Number(answer.dataset.aiSelectionPage);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return null;
  const range = selected.getRangeAt(0);
  if (!answer.contains(range.commonAncestorContainer)) return null;
  const rawText = selected.toString();
  if (!rawText.trim()) return null;
  const before = range.cloneRange();
  before.selectNodeContents(answer);
  before.setEnd(range.startContainer, range.startOffset);
  const after = range.cloneRange();
  after.selectNodeContents(answer);
  after.setStart(range.endContainer, range.endOffset);
  return { text: rawText, rawText, cleanedText: rawText.trim(), source: 'ai', pageNumber,
    context: { before: before.toString().slice(-650), after: after.toString().slice(0, 650) },
    rect: range.getBoundingClientRect(), rects: Array.from(range.getClientRects()) };
}
