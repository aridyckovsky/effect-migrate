---
"@effect-migrate/preset-basic": minor
"@effect-migrate/core": minor
"@effect-migrate/cli": minor
---

Thread command feature and project improvements

**CLI:**
- Add `thread add` command to track Amp thread references with tags/scope metadata
- Add `thread list` command with human-readable and JSON output modes
- Integrate thread tracking into audit context output (threads.json → audit.json)
- Remove redundant NodeFileSystem.layer provision from commands

**Core:**
- Improve error messages with underlying causes in ConfigLoadError
- Normalize result file paths to be relative to project root
- Skip recursion into excluded directories for better performance

**Project:**
- Migrate to ESM-only builds (remove CommonJS support)
- Convert examples to standalone projects outside workspace
- Add effect-migrate.config.ts for self-auditing
