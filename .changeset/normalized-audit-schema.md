---
"@effect-migrate/core": minor
---

Add normalized schema for 40-70% audit.json size reduction through deduplication

**Breaking Change:** Schema version 0.1.0 → 0.2.0 (no backwards compatibility)

- Replace `byFile`/`byRule` with deduplicated `rules[]`, `files[]`, `results[]` arrays
- Add index-based groupings in `groups` field for O(1) lookup
- Implement deterministic ordering (sorted rules/files) for reproducible output
- Add stable content-based keys for cross-checkpoint delta computation
- Compact range representation using tuples instead of objects
- Export normalizer utilities: `normalizeResults()`, `expandResult()`, `deriveResultKey()`
- Comprehensive test suite with 40+ test cases verifying size reduction and correctness
