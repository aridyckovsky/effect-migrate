---
"@effect-migrate/cli": patch
---

Refactor CLI to use amp utilities from core package

- Import amp utilities from `@effect-migrate/core/amp` instead of local modules
- Create `amp/options.ts` for CLI-specific amp options
- Update audit, metrics, and thread commands to use core schemas
- Remove duplicate amp utility code from CLI package
