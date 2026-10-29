# DAY 03 STATUS

Date: 2026-10-30

Implemented separate utilities for NFC Unicode cleanup, Vietnamese diacritics,
whitespace/control removal, sentence line joining, paragraph retention, soft
hyphen removal and lowercase word continuation after a line-end hyphen.
Inline compounds such as state-of-the-art are preserved.

PdfSelection exposes cleanedText and context.before/context.after alongside
rawText and existing ordered text. Preview shows cleaned text with expandable
context and raw text. Context includes partial boundary nodes on the same page,
650 characters per side, hard capped at 800. Horizontal overlap with selected
spans filters adjacent columns. Existing page/file/zoom invalidation is retained.

Validation: production build PASS; lint PASS; all 11 utility tests PASS.
Command: node --experimental-strip-types --test tests/*.test.mjs

Pending: real-PDF browser acceptance for Vietnamese, two-column papers, tables
and scans. Geometry filtering is heuristic; selections spanning columns and
unusual PDF ordering can mix context. Context is page-local. Ambiguous hyphens
may join compounds split across lines. No OCR, AI, notes, commit or push added.
