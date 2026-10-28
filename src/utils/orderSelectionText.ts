export interface SelectionFragment {
  text: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Repair displaced wide text blocks without sorting column text row by row. */
export function orderSelectionText(fragments: SelectionFragment[], rawText: string): string {
  const meaningful = fragments.filter((fragment) => fragment.text.trim());
  if (meaningful.length < 2) return rawText;
  const width = Math.max(...meaningful.map((f) => f.right)) - Math.min(...meaningful.map((f) => f.left));
  const ordered = [...fragments];
  let changed = false;
  for (const fragment of meaningful) {
    // Narrow column/table fragments keep their original order. A wide caption
    // can be emitted late by a PDF producer despite appearing above the body.
    if (fragment.right - fragment.left < width * 0.55) continue;
    const current = ordered.indexOf(fragment);
    const target = ordered.findIndex((candidate, index) => {
      if (index >= current || !candidate.text.trim()) return false;
      const height = Math.min(candidate.bottom - candidate.top, fragment.bottom - fragment.top);
      const overlap = Math.min(candidate.right, fragment.right) - Math.max(candidate.left, fragment.left);
      return candidate.top > fragment.bottom + height * 0.25 && overlap > 0;
    });
    if (target < 0) continue;
    ordered.splice(current, 1);
    ordered.splice(target, 0, fragment);
    changed = true;
  }
  if (!changed) return rawText;
  let text = "";
  let previous: SelectionFragment | undefined;
  for (const fragment of ordered) {
    if (!fragment.text) continue;
    if (previous && !/\s$/.test(text) && !/^\s/.test(fragment.text)) {
      const height = Math.min(previous.bottom - previous.top, fragment.bottom - fragment.top);
      const sameLine = Math.min(previous.bottom, fragment.bottom) - Math.max(previous.top, fragment.top) > height * 0.5;
      text += sameLine ? (fragment.left - previous.right > height * 0.15 ? " " : "") : "\n";
    } else if (previous && fragment.top > previous.bottom && !text.endsWith("\n")) {
      text += "\n";
    }
    text += fragment.text;
    previous = fragment;
  }
  return text;
}
