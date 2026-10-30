# Ollama local setup

1. Open Ollama on this computer. Run `ollama list` to inspect installed models.
   The tested model is `qwen3:8b`; if missing, install it yourself with
   `ollama pull qwen3:8b` (a multi-GB download).
2. Start this project with `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
3. Open http://127.0.0.1:5173, load a local PDF and select text.
4. Choose Dịch, Giải thích or Hỏi AI. Hỏi AI waits for a question and Gửi.
   Dừng cancels the request and keeps the partial answer; Thử lại starts over.

The Vite development and preview servers proxy `/ollama/api/chat` to
`http://127.0.0.1:11434/api/chat`. No Ollama CORS setting changes are needed
for these local server modes. Bind Vite to loopback as shown above.

Only the cleaned selection (up to 12,000 characters), up to 650 context characters
on each side, and the question (up to 2,000 characters) are sent. The PDF file
itself is not sent to Ollama. Requests use `stream: true`, `think: false`,
`keep_alive: "30m"`, and a 3-minute request timeout. The model can remain loaded
in memory after the answer. Models that do not accept `think: false` may fail;
use the tested qwen3 model or a compatible Ollama version.

Model selection is available in the panel under Model Ollama. It applies to the
current panel; changing the selection/action resets the panel to its default.
To change the default, add `VITE_OLLAMA_MODEL=your-installed-model` to `.env.local`
and restart Vite.

## Static hosting

The proxy is a Vite server feature, not part of the static JS bundle. A static
deployment must provide a reverse proxy for `/ollama`, or rebuild with
`VITE_OLLAMA_BASE_URL=http://localhost:11434` and allow the exact application
origin in Ollama's CORS settings. HTTPS deployments can also encounter browser
local-network/mixed-content restrictions. Never put an API key into a VITE
variable; these values are included in client JavaScript. Remote endpoints send
the selected text/context to that endpoint rather than this computer.

## Troubleshooting

- Connection error / HTTP 500: open Ollama; verify port 11434 and available RAM.
- Missing model / HTTP 404: run `ollama list`, then choose a name from that list.
- Timeout: use a shorter selection or a model that fits the available memory.
- Very old browser: use a current Chrome or Edge for ReadableStream/AbortSignal.
- Superscript/subscript and code indentation can already be flattened by PDF
  extraction. Check the selected text before asking AI; the model cannot reliably
  recover missing layout or guarantee mathematical accuracy.

API references: [Chat](https://docs.ollama.com/api/chat),
[Streaming](https://docs.ollama.com/api/streaming).
