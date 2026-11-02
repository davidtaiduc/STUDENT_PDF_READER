# Context Efficiency

Start project onboarding with README.md. It documents the current backend/shared
layout, runtime .env convention, development commands, API and data boundaries.
Treat docs/DAY_*.md as historical plans; confirm current behavior in source.

Use jCodeMunch first for code exploration.

Prefer:
- symbol search
- references
- related symbols
- targeted source retrieval

Avoid reading entire files or folders when symbol-level context is enough.

Only use full file reads when:
- editing the file
- exact surrounding implementation is necessary
- jCodeMunch does not provide sufficient context

Minimize repeated reads of unchanged files.
Keep tool output and final reports concise.
