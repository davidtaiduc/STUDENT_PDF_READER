import { useState } from "react";
import type { PdfSelection } from "../../types/selection";
import type { AiAction } from "../../types/ai";
import SelectionToolbar from "../SelectionToolbar/SelectionToolbar";
import AiPanel from "./AiPanel";

export default function SelectionAssistant({ selection }: { selection: PdfSelection | null }) {
  const [request, setRequest] = useState<{ selection: PdfSelection; action: AiAction } | null>(null);
  if (selection && request && selection !== request.selection) {
    setRequest({ ...request, selection });
  }
  // Keep the chosen excerpt when focus moves into the panel. A new PDF selection
  // immediately replaces it; geometry-only updates do not restart the response.
  const active = selection ?? request?.selection;
  return <>
    {selection && <SelectionToolbar selection={selection} onAction={(action) => setRequest({selection, action})} />}
    {request && active && <AiPanel key={JSON.stringify([active.pageNumber, active.rawText, active.context, request.action])}
      selection={active} action={request.action} onClose={() => setRequest(null)} />}
  </>;
}
