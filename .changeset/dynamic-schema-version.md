---
"@effect-migrate/cli": patch
---

Read schemaVersion from package.json effectMigrate.schemaVersion instead of hardcoding it, ensuring schema version stays in sync with package configuration. Falls back to "1.0.0" when field is missing.
