---
"@effect-migrate/core": patch
---

Fix boundary rule glob pattern handling for module specifiers. Patterns like `react*internals` now correctly match `react/internals`.
