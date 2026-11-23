import { useState } from "react";
export function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState("");
  return <span className="copy-control">
    <button onClick={async () => {
      try { await navigator.clipboard.writeText(text); setStatus("Đã sao chép."); }
      catch { setStatus("Không sao chép được. Hãy bôi đen và sao chép thủ công."); }
    }}>Sao chép</button>
    <small role="status">{status}</small>
  </span>;
}
