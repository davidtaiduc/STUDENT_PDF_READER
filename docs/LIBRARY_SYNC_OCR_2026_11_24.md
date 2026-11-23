# Library, backup, cloud sync and OCR - 24/11/2026

## Behavior

PDF folder clicks start a new chat; nested chat clicks resume that chat. PDF/chat rename and deletion are available in the sidebar with confirmation for deletion. Delete active PDF closes it; delete active chat starts an empty conversation. IndexedDB tombstones reject delayed autosaves; BroadcastChannel refreshes sidebar lists across tabs.

Backup format `.studypdf`: 10 bytes `STUDYPDF1\n`, a 4-byte big-endian JSON length, UTF-8 manifest version 1, then each PDF's raw bytes in manifest order. Deleted PDFs contain no bytes. Manifest contains document metadata and chat turns, excludes owner identity and secrets. Every PDF hash is verified and every chat validated before a single local import transaction. A snapshot comparison prevents overwriting concurrent tab edits. Manual restore can revive deleted entries; cloud merge cannot revive stale deletions. Divergent transcripts keep a deterministic recovery copy. Rename/title metadata remains separate from content revision.

Cloud sync is explicit and account scoped: GET remote archive, validate and merge locally, export merged archive, PUT with remote ETag in If-Match. A concurrent server update returns 409 instead of replacing its head. Uploads use GridFS and bounded streaming, 2 concurrent uploads per API instance, 120s timeout, 544MiB bound. Current account must match X-Library-Owner when supplied. Offline content remains local. Not background synchronization or end-to-end encryption; administrator database/storage access can read the archive. Large libraries require sufficient network bandwidth and browser storage. Crashed processes may leave orphaned staging GridFS blobs; no automatic destructive cleanup of unrelated database files is performed.

OCR uses the local PDF.js renderer and Tesseract.js worker with English/Vietnamese assets bundled at build/postinstall. Explicit opt-in only; max 5 pages/12,000 characters. Per-page raster <=4 million pixels; cancellation terminates the worker and cancels rendering. Results are previewed and cached by PDF/page/language during the session. OCR may misread formulas, columns or poor scans. The generated scan fixture contains image bytes only and was recognized correctly in the browser.

Continuation is a user initiated new AI request with bounded recent context plus up to 2,000 characters of the interrupted answer. It retains partial output, does not retry automatically, and counts as another request. Provider downtime cannot be fixed by client code; continuation itself may also fail.

## Validation

- 101 local tests: account/session/email/AI/quota plus archive hash/roundtrip/isolation, atomic validation, conflict recovery/idempotence, PDF rename/delete cascade and stale-save rejection.
- Real Mongo GridFS test in a generated isolated database: cookie/Origin/owner isolation, roundtrip, invalid archive rejection, stale ETag and simultaneous updates. Test database removed afterward.
- Browser QA on fake auth/AI and isolated real Mongo: image-only PDF OCR eng and eng+vie, interrupted answer continuation, rename PDF/chat, delete active chat, restore that chat, sync confirmation, mobile rename, and sidebar rename propagation between two tabs.
- Export button and generated archive are verified; the browser automation download-event API stalled, so the downloaded artifact was not retrieved through that API. Import UI was tested with a generated valid backup fixture; byte-for-byte roundtrip is covered by the automated tests.
- UI screenshots: LIBRARY_CLOUD_OCR_DESKTOP_2026_11_24.jpg and LIBRARY_CLOUD_OCR_MOBILE_2026_11_24.jpg.
- No application user PDFs, real emails or real Gemini calls in this QA; fake account data used for UI tests.

References: [Tesseract.js local installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md), [MongoDB GridFS](https://www.mongodb.com/docs/drivers/node/current/crud/gridfs/).
