---
created: 2025-11-07
lastUpdated: 2025-11-07
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-ce504221-dac5-4e22-86b2-317735faffb2
audience: Development team and reviewers
tags: [pr-draft, normalized-schema, breaking-change, performance, wave1]
---

# feat(core): normalized audit schema

## What

Reduce audit.json file size by 40-70% through normalized, index-based schema with deduplication.

Replaces duplicated `byFile` and `byRule` structures with deduplicated `rules[]`, `files[]`, and `results[]` arrays. Rules and files are stored once and referenced by index.

**Breaking Change:** Schema version 0.1.0 → 0.2.0 (no backwards compatibility)

## Why

Large projects (10k+ findings) generate 5-10MB audit.json files with significant duplication:

- Rule metadata repeated for every finding
- File paths repeated for every finding in that file
- Range objects (60 bytes) instead of compact tuples (20 bytes)

This PR implements normalized schema to enable:

- 40-70% size reduction (verified in tests)
- Faster file I/O and parsing
- Foundation for cross-checkpoint delta computation via stable content-based keys

## Scope

**Packages affected:**

- `@effect-migrate/core` - Breaking schema change (0.1.0 → 0.2.0)

**Files modified:**

- `packages/core/src/schema/amp.ts` - Normalized schema definitions
- `packages/core/src/schema/versions.ts` - Version bump to 0.2.0
- `packages/core/src/amp/normalizer.ts` - NEW: Deduplication logic
- `packages/core/src/amp/context-writer.ts` - Integration with normalizer
- `packages/core/src/rules/types.ts` - Extract RULE_KINDS constant
- `packages/core/src/types.ts` - Export RuleKind type
- `packages/core/src/index.ts` - Export normalizer utilities
- `packages/core/src/amp/index.ts` - Export normalizer utilities

**Tests added:**

- `packages/core/test/amp/normalizer.test.ts` - 1000+ lines, 40+ test cases
- `packages/core/test/amp/context-writer.test.ts` - Updated for normalized output
- `packages/core/test/amp/schema.test.ts` - Updated for normalized schema

## Changeset

- [x] Changeset added
- [ ] No changeset needed (internal change only)

**Changeset summary:**

> Add normalized schema for 40-70% audit.json size reduction through deduplication. Breaking change: Schema 0.1.0 → 0.2.0. Replaces byFile/byRule with deduplicated rules[]/files[]/results[] arrays with index-based references.

## Testing

**Build and type check:**

```bash
pnpm build:types
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

**All tests pass:** ✅

**New tests:**

- `packages/core/test/amp/normalizer.test.ts`
  - Deterministic ordering (sorted rules/files)
  - Deduplication (rules stored once)
  - Expansion (reconstructs full RuleResult)
  - Stable keys (content-based, survives index changes)
  - Size reduction verification (40-70% on realistic datasets)
  - Edge cases (empty results, file-less results, message overrides, info severity)

**Updated tests:**

- `packages/core/test/amp/context-writer.test.ts` - Validates normalized output structure
- `packages/core/test/amp/schema.test.ts` - Validates new schema definitions

**Performance verification:**

From test suite (1000 findings, 10 rules, 50 files):

- Legacy size: ~500KB
- Normalized size: ~150KB
- **Reduction: 70%**

## Schema Migration

**BEFORE (v0.1.0):**

```json
{
  "findings": {
    "byFile": {
      "file1.ts": [
        {
          "id": "no-async-await",
          "ruleKind": "pattern",
          "severity": "warning",
          "message": "Use Effect.gen instead of async/await",
          "file": "file1.ts",
          "range": {
            "start": { "line": 1, "column": 1 },
            "end": { "line": 1, "column": 10 }
          }
        }
      ]
    },
    "byRule": { "..." }
  }
}
```

**AFTER (v0.2.0):**

```json
{
  "findings": {
    "rules": [
      {
        "id": "no-async-await",
        "kind": "pattern",
        "severity": "warning",
        "message": "Use Effect.gen instead of async/await"
      }
    ],
    "files": ["file1.ts"],
    "results": [
      {
        "rule": 0,
        "file": 0,
        "range": [1, 1, 1, 10]
      }
    ],
    "groups": {
      "byFile": { "0": [0] },
      "byRule": { "0": [0] }
    }
  }
}
```

**Key changes:**

- ✅ Rules deduplicated (stored once, referenced by index)
- ✅ Files deduplicated (stored once, referenced by index)
- ✅ Compact ranges (tuples instead of objects: 67% smaller)
- ✅ Deterministic ordering (sorted rules/files for reproducibility)
- ✅ Index-based groupings (O(1) lookup, can be reconstructed if omitted)

## Checklist

- [x] Code follows Effect-TS best practices
- [x] TypeScript strict mode passes
- [x] All tests pass
- [x] Linter passes
- [x] Build succeeds
- [x] Changeset created
- [x] Documentation updated (JSDoc in schema, normalizer)
- [x] Breaking change documented (schema version bump, migration guide in PR)

## Agent Context (for AI agents)

**Implementation approach:**

1. **Type safety foundation:**
   - Extracted `RULE_KINDS` constant to ensure Schema.Literal matches RuleResult.ruleKind
   - Prevents divergence between schema and runtime types

2. **Schema design:**
   - `RuleDef` - Deduplicated rule metadata (id, kind, severity, message, docsUrl, tags)
   - `CompactRange` - Tuple `[startLine, startCol, endLine, endCol]` instead of object
   - `CompactResult` - Index-based references to rules/files arrays
   - `FindingsGroup` - Index-based groupings + summary statistics

3. **Normalizer implementation:**
   - `normalizeResults()` - Deduplicates rules/files, builds compact results
   - Deterministic ordering via sorted rules (by ID) and files (by path)
   - Index remapping after sorting ensures stable indices
   - Message override optimization (omit if matches rule template)
   - Grouped findings by file/rule for O(1) lookup

4. **Stable key generation:**
   - `deriveResultKey()` - Content-based keys using rule ID + file path + range
   - Keys survive index changes across checkpoints
   - Enables future delta computation between audit snapshots

5. **Integration:**
   - Context-writer pre-normalizes paths to forward slashes
   - Calls `normalizeResults()` and emits directly to audit.json
   - Sorts `rulesEnabled` and `failOn` for determinism

6. **Documentation improvements (from review):**
   - Document `info` severity counting as warning in summary
   - Clarify `groups` field optionality (future space optimization)
   - Extract `RULE_KINDS` for type safety

**Effect patterns used:**

- Pure functions (normalizer has no side effects)
- No Schema misuse (services use interfaces, not Schema)
- Proper type exports (`Schema.Schema.Type<typeof X>`)
- Effect.gen composition in context-writer

**Amp Thread:**

- Commits: https://ampcode.com/threads/T-ce504221-dac5-4e22-86b2-317735faffb2

**Related docs:**

- @docs/agents/plans/pr2-normalized-schema.md - Implementation plan
- @docs/agents/plans/pr2-normalized-schema-dual-emit.md - Alternative approach (not pursued)
- @docs/agents/prs/reviews/amp/pr2-normalized-schema.md - Comprehensive PR review

## Migration Impact

**For external consumers:** None (pre-1.0, no published versions yet)

**For internal development:**

- Previous audit.json files cannot be read by new code
- No migration script needed (regenerate via `effect-migrate audit`)
- Tests updated to expect new structure
- Future PRs will build on normalized schema

## Follow-up Opportunities

**Not included in this PR (potential future work):**

1. Make `groups` truly optional (save additional 5-10% space)
2. Add `info` counter to summary (currently counted as warnings)
3. Gzip compression for stored audit.json (would multiply gains)
4. Delta computation between checkpoints using stable keys
