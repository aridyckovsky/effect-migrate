---
"@effect-migrate/core": minor
---

Add unified schema versioning and amp utilities to core package

- Add `SCHEMA_VERSION` constant - single version for all artifacts (simplicity over complexity)
- Add Semver schema validator with subpath export `@effect-migrate/core/schema`
- Move amp utilities (context-writer, metrics-writer, thread-manager) from CLI to core
- Add `schemaVersion` field to index.json and audit.json schemas
- Add `revision` counter field to audit.json (increments on each write)
- Export amp utilities via `@effect-migrate/core/amp` subpath
- All artifacts share same schema version for clearer versioning semantics
