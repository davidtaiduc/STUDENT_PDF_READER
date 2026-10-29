import { actionLabels } from "../../types/ai";
import type { AiAction } from "../../types/ai";
import type { PdfSelection } from "../../types/selection";

export default function SelectionToolbar({ selection, onAction }: {
  selection: PdfSelection; onAction: (action: AiAction) => void;
}) {
  const rect = selection.rect;
  // Hide when the highlight has scrolled out of the PDF viewport.
  const layer = document.querySelector(".viewer-scroll")?.getBoundingClientRect();
  if (!layer || rect.bottom < layer.top || rect.top > layer.bottom || rect.right < layer.left || rect.left > layer.right) return null;
  const width = Math.min(300, window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = rect.top - 52 >= layer.top
    ? rect.top - 52 : Math.max(layer.top, Math.min(rect.bottom + 8, layer.bottom - 44));
  return <div className="selection-toolbar" role="group" aria-label="Thao tác với đoạn đã chọn"
    data-selection-controls style={{ left, top, width }} onMouseDown={(event) => event.preventDefault()}>
    {(Object.keys(actionLabels) as AiAction[]).map((action) =>
      <button key={action} onClick={() => onAction(action)}>{actionLabels[action]}</button>)}
  </div>;
}
