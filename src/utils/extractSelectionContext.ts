import { normalizePdfSelection } from "./normalizePdfSelection.ts";

export interface ContextFragment {
  text: string;
  left: number;
  right: number;
}

/** Same-page context; horizontal overlap reduces leakage from adjacent columns. */
export function extractSelectionContext(
  before: ContextFragment[], after: ContextFragment[],
  column: { left: number; right: number }, limit = 650,
): { before: string; after: string } {
  const size = Number.isFinite(limit) ? Math.max(0, Math.min(800, Math.floor(limit))) : 650;
  const collect = (items: ContextFragment[]) => normalizePdfSelection(items
    .filter((item) => {
      const overlap = Math.min(item.right, column.right) - Math.max(item.left, column.left);
      return overlap > 0 && overlap >= Math.min(item.right - item.left, column.right - column.left) * 0.5;
    })
    .map((item) => item.text).join("\n"));
  return { before: size ? collect(before).slice(-size) : "", after: collect(after).slice(0, size) };
}
