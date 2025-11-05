---
"@effect-migrate/core": patch
---

Correctly prune nested directories using exclude globs in FileDiscovery. Exclude patterns are now matched against directory paths (absolute and relative) and support trailing "/\*\*". Adds tests for absolute and relative nested directory exclusions.
