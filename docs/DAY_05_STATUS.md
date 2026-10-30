# DAY 05 STATUS

Date: 2026-10-31

Implemented real local Ollama chat streaming in place of mock responses.
Default qwen3:8b, stream:true, think:false, keep_alive:30m, 3-minute timeout.
Separate prompts for Dịch / Giải thích / Hỏi AI, bounded context, exact selected
text/formula payloads, question limits and selection length validation.
NDJSON parser supports arbitrary byte/UTF-8 splits, CRLF and a final line without
newline; detects malformed/error/truncated output and cancels readers on abort.
Panel shows progressive content, loading, stop, retained partial output, error,
retry and an installed-model input. Scope/selection changes clean up old requests.
Vite dev/preview proxy talks to loopback Ollama without changing its CORS settings.
No AI SDK/dependency, backend service, account, storage, OCR, commit or push added.

## TEST PDF INVENTORY

- Test Case 1: FOUND
- Test Case 2: FOUND
- Test Case 3: FOUND
- Test Case 4: FOUND
- Test Case 5: FOUND
- Test Case 6: FOUND
- Additional Test Case 7: FOUND (not tested this session)

Original PDFs remain untouched. Browser session loaded Test Cases 2–6; live AI
checks used Case 2 (formula-labelled text) and Case 5 (English/Vietnamese text).
Case 6 selection + question-panel smoke check passed. Loading Cases 3/4 does not
certify selection, cleanup or AI quality on those layouts.

## Validation

- PASS: production build; lint; npm test (20 tests: 9 new + 11 existing).
- PASS: prompt payload preserves E = mc² and ∫ f(x) dx, limits context to 650 per
  side and keeps question separate; tested in utilities, not a math-rendering claim.
- PASS: stream parser handles byte-by-byte Vietnamese/Unicode, multiple frames,
  empty lines, missing final newline, reasoning-only frames, protocol failures,
  truncated output, and cancellation while waiting for data.
- PASS: service contract, missing model, offline fetch, server failure and empty
  response exercised with controlled fetch responses in automated tests.
- PASS: installed real qwen3:8b connects through the app's Vite proxy.
- PASS: Case 2 explanation streamed incrementally and completed in Vietnamese.
- PASS: live retry + Stop cancelled and retained a partial answer.
- PASS: a nonexistent model produced a clear UI error; valid model restored.
- PASS: Case 5 English excerpt translated to Vietnamese; final prompt translated
  the selected word understanding to hiểu biết without translating surrounding text.
- PASS: question “AI ... là viết tắt của từ gì?” returned Artificial Intelligence.
- PASS: choosing understanding during a longer streamed answer reset the excerpt,
  cleared the question/old answer, and stopped displaying the old request.
- PASS: replacing the PDF during a live request removed the old panel; Case 6
  loaded and accepted a fresh selection without displaying the previous answer.
- PASS: final browser console error snapshot empty.

## Remaining coverage / limitations

- MANUAL TEST REQUIRED: physically stop/restart the user's Ollama server and
  verify recovery through UI. Offline handling is automated-tested; this session
  did not shut down the user's existing Ollama daemon.
- MANUAL TEST REQUIRED: cold-load timeout, static-hosting CORS/local-network
  restrictions, exhaustive toolbar edge placements and complex math/code quality.
- KNOWN LIMITATION: PDF superscript/subscript and code indentation can be flattened
  before the AI receives text. The Case 2 drag selected only part of the formula;
  model output reconstructed c² from context. This is not certified formula fidelity.
- KNOWN LIMITATION: an early translation of an incomplete sentence incorporated
  surrounding context. The final prompt explicitly forbids completion from context;
  a complete-word translation was rechecked, but model adherence is not guaranteed.
- KNOWN LIMITATION: answers use plain text; Markdown/LaTeX is not rendered.
- KNOWN LIMITATION: panel model choice resets on a new selection/action. Configure
  VITE_OLLAMA_MODEL for a session-wide default; no preference persistence yet.

Setup and API references: [OLLAMA_SETUP.md](OLLAMA_SETUP.md).
Preview: DAY_05_PREVIEW.jpg.
Vite is running on http://127.0.0.1:5173 (started this session).
