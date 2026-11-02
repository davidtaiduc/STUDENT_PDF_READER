## Latest: comprehensive README and .env-only runtime — 2026-11-02

User requested detailed Git-readable onboarding for other AIs; README rewritten in Vietnamese (~567 lines) covering status, setup/env, scripts, layout, security/data boundaries, PDF/selection state, API/SSE, storage/quota/errors, tests/CI, troubleshooting, deploy gaps, AI handoff and roadmap. AGENTS points there; docs/README reclassifies Day/Ollama as historical; backend README updated. Verified local doc links and README has no actual secrets. User then explicitly required runtime from .env, not .env.example. Vite now uses backend/src/config/environment.ts, envDir:false/envPrefix:[], explicit public API URL only; Node commands retain --env-file-if-exists=.env. build:static also loads .env. Added 3 env tests (55 tests pass), lint/typecheck/build pass; real proxy health/auth HTTP200 verified on smoke5175 and that temporary process stopped. No raw secrets bundled. Actual .env untouched. IMPORTANT .env.example currently AGAIN contains real key, Mongo credentials and app token: check:secrets correctly fails. Do not print/copy/push those values. User prefers self-editing basic config; report template needs cleanup before Git. No commit/push/deploy. Backend session5273 may still run; check current state before changes.

## Latest: backend folder reorganization — 2026-11-02

User requested backend in its own folder and professional file organization. Moved server/* to backend/src/{auth,config,database,services/ai,services/usage} with app.ts/index.ts at backend/src root. Moved prompts into backend/src/services/ai; shared SSE/errors and AI/BackendHealth types into shared/. Frontend stays src/, labels re-export shared AiAction. Backend does not import frontend code. Moved backend check script into backend/scripts/check-connection.mjs and tsconfig.server.json into backend/tsconfig.json. Updated imports/tests/Vite/ESLint/build scripts/docs. Root .env unchanged, shared root package.json/lock retained. New npm run dev:backend and dev:frontend; npm run dev frontend-only and npm run server alias preserved. 52 tests, lint, secret preflight, typecheck, build, diff check pass. Real Mongo/API auth via local proxy verified on test ports 3005/5175; those owned smoke processes stopped. No Google calls needed. Backup of source (no env) in ignored tmp/before-backend-reorganization; do not rerun tmp/reorganize-backend.py. No commits/push/deploy. See backend/README.md, shared/README.md, root README.

## Latest: Git CI prepared, sample secrets cleared — 2026-11-02

Continued Git deployment preparation. User manually cleared real Gemini key and Mongo URI from .env.example; npm run check:secrets now passes. Added scripts/check-secrets.mjs, .github/workflows/ci.yml (checkout/setup-node v7, Node22, read-only token, secret preflight/npm ci/lint/test/build, no deploy), and secret-preflight test. 52 tests, lint, build and diff whitespace check pass locally. CI has not run on GitHub because nothing committed/pushed. Real .env remains ignored and unchanged. User chooses basic config/hosting themselves; async question pending: iNET Node/VPS, another service, or Git-only preparation. OneSite Git URL is static import only/no build; full frontend+backend hosting still missing. Do not claim deployment ready or automatically publicize backend.

## Latest: Git hosting clarification — 2026-11-02

User prefers Git deployment and thought OnePortal can host full app. Inspected OneSite Git URL directly: public GitHub/GitLab static files only, no build; cannot run Node backend. Local remote origin is davidtaiduc/STUDENT_PDF_READER main; latest changes uncommitted/unpushed. OnePortal Hosting screen explicitly says no Hosting; Cloud Server screen says none (Cloud VPS not inspected). No purchases, enrollment, Git changes, or deploy actions. IMPORTANT: .env.example currently contains the same real Gemini key as .env and a Mongo URI with password. Do not print values or push. User prefers to edit basic configuration themselves: tell them to blank sample secrets; do not silently alter .env. Existing .env remains ignored. See docs/GIT_HOSTING.md and docs/ONESITE_GIT_IMPORT.png.

## Latest: PDF navigation preserves lesson — 2026-11-02

User requested keeping AI/teaching content during page and zoom changes, and editing existing page number (not adding a separate jump field). Removed SelectionAssistant viewport key and selectionScope prop from StudySidebar; PdfViewer still resets sidebar only on new documentVersion. Native selection scope still resets highlight, captured AI excerpt/response/draft remain mounted. PdfToolbar now edits current page inline: Enter or blur commits valid integer, Escape restores, invalid/out-of-range shows accessible error. Browser fixture verified active stream survives Next/zoom/direct page/Fit Width without new requests, completed answer and unsaved note persist; new document resets; real 441-page Case8 jumps to 221/441, rejects 442. 51 tests/lint/build pass. See docs/PDF_NAVIGATION_FIX.md and PDF_NAVIGATION_PREVIEW.png. Temporary fixture session 46819 stopped. .env/backend/OneSite untouched.

## Latest: clear AI errors and retry countdown — 2026-11-02

Added shared AiRequestError and Gemini error classification via official codes/QuotaFailure/RetryInfo/Retry-After; never forward raw provider bodies. Distinguishes rate limit, unknown provider limit, daily quota, app quota, concurrency, setup/payment. UI shows friendly alert, disables Retry during cooldown/busy, hides retry for non-retryable errors, preserves partial text. No automatic paid retries. 51 tests/lint/build pass; mock UI 5174 verified disabled countdown then successful retry. Screenshot docs/AI_WAIT_PREVIEW.png. Backend restarted, session 33271, still development-unlimited. .env untouched. Temporary UI fixture server must be stopped after verification; OneSite unchanged.

## Latest: no user code required — 2026-11-02

User wants translation without codes; accounts later. Removed code UI and browser Authorization header. Keep backend appTokenAuthenticator: Vite local proxy adds private credential only for loopback clients with local Host and matching/absent Origin. Do not expose credential in VITE variables. Auto-review rejected removing all backend auth; safer local proxy was implemented instead, no unauthenticated public API. Real checks: direct API 401, local web /api/access 200 without user header, external Origin 403. Browser translation completed successfully with Gemini and existing remote MongoDB. 42 tests/lint/build pass. .env values untouched this turn. OneSite still old release; new no-code flow verified local only. Screenshot docs/GEMINI_NO_CODE_PREVIEW.png.

## Latest backend connection update — 2026-11-02

Backend now loads .env (not .env.local). User already has MongoDB and will fill MONGODB_URI in .env; do not start/create local MongoDB. Both project-owned MongoDB and API test processes were stopped. Gemini key was moved from sample configuration into ignored env files; never print it. Authentication and database modules are separate for future user accounts, which are not implemented. Health/access routes, frontend connection status, and check:backend are added. 39 tests, lint and build pass. Real user database/Gemini validation is pending the URI. Existing OneSite/ZIP unchanged.

﻿# Session handoff

Date: 2026-10-28
Project: E:\New folder\student-pdf-reader
Scope: Day 1 PDF viewer foundation only.

Implemented: restored truncated PdfViewer, added missing main entry point,
latest-request guards/loading-task cleanup, isolated render DOM with cancellation,
HiDPI canvas and TextLayer scale variables, zoom bounds, local PDF.js resources,
responsive UI and test checklist.

Validation: install (offline, scripts disabled), build and lint pass; development
server starts and initial UI loads. Real PDF fixtures are absent; runtime worker,
selection alignment, Vietnamese/scan/long-PDF checks await manual verification.

Git: directory is not a Git repository. No init/branch/commit/push performed.
Original files and unified diff retained under this Codex chat workspace.

Active development server: http://127.0.0.1:5173 (started by this chat).
Stop this session's server when user says finished for today; do not stop unrelated node processes.

## Selection fix verification
- Added standalone PDF.js --scale-round-x/y defaults and explicit overlay stacking/hit testing.
- Tested D:/May in/Windows 8_Notice.pdf in browser (actual folder name has Vietnamese accents).
- TextLayer contains 25 spans; one canvas is mounted.
- Mouse drag returns selected text; highlight visible over rendered text.
- Selection also works after zoom from 120% to 130%.
- Browser console: no errors/warnings captured during this test.
- Build and lint: PASS.

## Report PDF selection regression (2026-10-29)
Reproduced on D:/Tai lieu in/Bao Cao Cong Nghe Visual Report.pdf, page 1, 120%.
Before: dragging the first paragraph slightly into the right margin selected 890
characters extending into the following table. After: same drag selected 197
characters near the pointer (two lines), without jumping to the table.
Reverse drag across the left margin also stayed within the nearby paragraph.
Zoom 120 -> 130 -> 120: one end-of-content guard remained, no console errors.

PdfPage now uses the official PDF.js TextLayerBuilder, which wraps TextLayer
and adds end-of-content / selection stabilization and copy normalization.
Its event listeners are aborted and builder cancelled during effect cleanup.
No AI, floating toolbar, OCR, or selection-to-AI integration added.
Build and lint: PASS. Complex table/cross-column reading order still depends
on the source PDF; not all page layouts are certified by this regression.

## Day 2 (2026-10-29)
Implemented shared PdfSelection and usePdfSelection. Validates both endpoints
inside the same PDF text layer, captures raw text/page/viewport bounding rect
and line rects; coalesces selection/scroll/resize events; invalidates snapshots
on page/zoom/file changes, including reopening the same file. Added a simple
selection preview, no floating toolbar or AI. Browser tests and build/lint pass.
See docs/DAY_02_STATUS.md for acceptance evidence and remaining manual coverage.
Development server remains http://127.0.0.1:5173.

Selection ordering repair: added src/utils/orderSelectionText.ts and five
regression tests in tests/selection-order.test.mjs. Wide displaced text blocks
are repositioned in extracted text; rawText preserves browser output. Test Case 6
subtitle is now below title. Browser regression: word, multiline, Ctrl+A, zoom,
outside selection and page navigation pass. Native PDF text layer untouched.
Run: node --experimental-strip-types --test tests/selection-order.test.mjs

## Day 3 implementation (2026-10-30)
Added cleanup and bounded same-page context utilities, integrated into selection
preview. Build, lint and 11 utility tests pass. Real-PDF browser acceptance is
pending. See docs/DAY_03_STATUS.md for scope and limitations. No commit/push.

## Day 4 implementation (2026-10-30)
Added SelectionToolbar, SelectionAssistant and AiPanel with three mock actions,
loading/error/retry and question input. Selection controls preserve the excerpt;
new selections update panel; file/page/zoom changes cancel old mock requests.
Build/lint/11 utility tests pass. Browser verification used real Test Case 1.pdf,
including multiline selection, actions, question, error/retry, zoom, navigation
and phone layout. See docs/DAY_04_STATUS.md for untested cases and preview.
Vite was stopped at the user's request when ending this session (2026-10-30).
Next session: finish remaining Day 4 edge/PDF checks, then read docs/DAY_05.md
before implementing AI integration and streaming. This agent did not commit/push.

## Day 5 implementation (2026-10-31)
Replaced mock panel responses with local Ollama streaming using installed qwen3:8b.
Added separate prompts, NDJSON parsing, Stop/retry/errors/model selection and
loopback Vite dev/preview proxy. Build/lint/20 tests pass. Real browser checks:
explanation, translation, questions, streaming, partial Stop, invalid model and
selection/document replacement during requests. See docs/DAY_05_STATUS.md for
evidence, math/context limitations and remaining manual coverage; setup is in
docs/OLLAMA_SETUP.md. Day 4 exhaustive edge/layout checks remain incomplete.
Vite is running at http://127.0.0.1:5173, exec session 36077, started this session.
Stop only this server when the user ends today's work. No commit or push performed.
Next: complete outstanding QA, then read docs/DAY_06.md for notes/history/storage.

## Side-by-side layout update (2026-10-31)
User requested a compact PDF on the left and all translation/AI tasks on the
right. PdfViewer now uses a two-column workspace; SelectionAssistant is a
permanent right sidebar with fixed Dịch/Giải thích/Hỏi AI actions, selection
preview and independently scrolling results. Removed the floating overlay and
bottom selection/AI panes. PDF initially fits its column (capped at 120%);
Vừa chiều rộng refits the current page without changing PDF/text-layer geometry.
Below 860px the panes stack. Browser verified real Case 5 translation, no desktop
horizontal overflow at fit width, and stacked phone layout at 390x844; viewport
override reset. Build/lint pass. Preview: docs/SIDE_BY_SIDE_PREVIEW.jpg.

## Session ended (2026-10-31)
User requested to stop here. Stopped this session's Vite server (exec 36077).
Latest state: Day 5 local Ollama integration and side-by-side PDF/AI layout saved.
Resume from remaining QA in docs/DAY_05_STATUS.md before starting Day 6.
No commit or push performed by this agent.

## Day 6 implementation (2026-11-02)
Added SHA-256 identity before PDF.js buffer transfer, IndexedDB metadata and
study entries, right-sidebar Trợ lý/Lịch sử views, explicit note/result saving,
copy, note editing, guarded deletion and saved-page navigation. History survives
reload, file renaming and page changes; different PDFs with the same name stay
isolated. Real qwen3:8b translate/explain/ask results and one edited note were
saved and restored in browser checks on real Test Case 5. Build/lint/24 tests pass.
See docs/DAY_06_STATUS.md for acceptance evidence and remaining manual coverage;
user guide: docs/STUDY_STORAGE.md. Preview: docs/DAY_06_PREVIEW.jpg.
Ignored test copies: test-pdfs/day06-20261102/; original fixtures untouched.
Vite runs at http://127.0.0.1:5173, exec session 87846, started this session.
Stop only this server when the user ends today's work. No commit or push.
Next: finish remaining QA, then read docs/DAY_07.md before final polish/deploy.
## Latest: Gemini migration — 2026-11-02

Runtime AI now uses Node.js `/api/ai` → Gemini Interactions; Ollama adapter/proxy removed. MongoDB persists global usage caps, notes stay in IndexedDB. See docs/GEMINI_SETUP.md and docs/GEMINI_MIGRATION_STATUS.md. `.env.local` is ignored, configured with user-supplied local Mongo URI and generated app token; Gemini key was still empty at last check. Mongo ping failed. Do not print secrets. User must fill key/start Mongo before live verification. 33 tests, lint/build pass; runtime audit zero vulnerabilities. OneSite/old ZIP remain previous Ollama release; need public backend HTTPS URL before publishing new frontend. No commits/pushes made.
