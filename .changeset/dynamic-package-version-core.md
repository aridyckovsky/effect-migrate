---
"@effect-migrate/core": patch
---

Add getPackageMeta service for dynamic version reading from package.json. Exports PackageMeta interface and getPackageMeta Effect that reads both toolVersion and schemaVersion at runtime, with intelligent path resolution for development and production environments.
