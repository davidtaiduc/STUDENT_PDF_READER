import { actionLabels } from "../../types/ai";
import type { AiAction } from "../../types/ai";

export default function SelectionToolbar({ disabled, activeAction, onAction }: {
  disabled: boolean; activeAction?: AiAction; onAction: (action: AiAction) => void;
}) {
  return <div className="selection-toolbar" role="group" aria-label="Thao tác với đoạn đã chọn"
    data-selection-controls onMouseDown={(event) => event.preventDefault()}>
    {(["translate", "explain", "ask"] as AiAction[]).map((action) =>
      <button key={action} disabled={disabled} aria-pressed={activeAction === action}
        onClick={() => onAction(action)}>{actionLabels[action]}</button>)}
  </div>;
}
