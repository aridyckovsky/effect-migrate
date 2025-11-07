---
"@effect-migrate/core": major
---

**BREAKING CHANGE:** Normalize audit schema to reduce file size by 40-70%

Replace duplicated `byFile` and `byRule` structure with normalized, index-based approach using deduplicated `rules[]`, `files[]`, and `results[]` arrays.

**Schema version:** 0.1.0 → 0.2.0

**Key changes:**

- Add `normalizeResults()` for deduplication and stable key generation
- Add `expandResult()` for reconstructing full RuleResult from compact format
- Add `deriveResultKey()` for content-based keys enabling cross-checkpoint deltas
- Replace legacy byFile/byRule with index-based groupings
- Implement deterministic ordering (sorted rules/files) for reproducible output
- Extract `RULE_KINDS` constant for type safety

**Size reduction:** 40-70% verified on realistic datasets (1000 findings, 10 rules, 50 files)

**Migration:** No backwards compatibility - consumers must update to new schema format
