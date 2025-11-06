---
"@effect-migrate/core": patch
---

Fix `defineConfig` to accept encoded input types. Users can now pass pattern strings directly instead of RegExp objects, avoiding TypeScript errors.
