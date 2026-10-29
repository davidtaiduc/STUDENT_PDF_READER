# Context Efficiency

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