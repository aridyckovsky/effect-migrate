---
created: 2025-11-07
lastUpdated: 2025-11-07
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-301625dd-8e95-4ccc-94aa-3301f9fd6966
audience: Development team and reviewers
tags: [pr-draft, normalized-schema, breaking-change, performance, wave1]
---

# feat(core,cli): normalized audit schema and improve core business logic

## What

**Normalized Schema (BREAKING):** Replace duplicated `byFile`/`byRule` structures with deduplicated index-based schema that reduces audit.json size by 40-70%.

**Loaders Migration:** Move config/preset business logic from CLI to core, making CLI a thin orchestrator.

## Why

Large projects (10k+ findings) generate 5-10MB audit.json files with significant duplication. This PR:

- Reduces file size by 40-70% (verified in tests)
- Enables future delta computation via stable content-based keys
- Improves architecture by centralizing business logic in core

## Scope

**Packages affected:**

- `@effect-migrate/core` - BREAKING schema change (0.1.0 → 0.2.0) + new business logic
- `@effect-migrate/cli` - Thin orchestrator using core services

## Changeset

- [x] Changeset added

**Changeset summary:**

> Add normalized schema for 40-70% audit.json size reduction and move business logic to core. Breaking changes: (1) Schema 0.1.0 → 0.2.0 - replaces byFile/byRule with deduplicated arrays. (2) CLI loaders removed - use @effect-migrate/core exports instead.

## Testing

```bash
pnpm build:types && pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

**All checks pass:** ✅ (308 tests)

**New tests added:**

- `packages/core/test/amp/normalizer.test.ts` (40+ tests) - Normalization, deduplication, stable keys
- `packages/core/test/config/merge.test.ts` (9 tests)
- `packages/core/test/utils/merge.test.ts` (21 tests)
- `packages/core/test/presets/PresetLoader.test.ts` (6 tests)
- `packages/core/test/rules/builders.test.ts` (14 tests)
- `packages/cli/test/layers/PresetLoaderWorkspace.test.ts` (6 tests)

**Size reduction verified:** 1000 findings → 70% reduction (500KB → 150KB)

## Schema Migration

**BEFORE (v0.1.0):**

```json
{
  "findings": {
    "byFile": {
      "file1.ts": [{ "id": "no-async", "message": "...", "file": "file1.ts", ... }]
    },
    "byRule": { "..." }
  }
}
```

**AFTER (v0.2.0):**

```json
{
  "findings": {
    "rules": [{ "id": "no-async", "kind": "pattern", "severity": "warning", "message": "..." }],
    "files": ["file1.ts"],
    "results": [{ "rule": 0, "file": 0, "range": [1, 1, 1, 10] }],
    "groups": {
      "byFile": { "0": [0] },
      "byRule": { "0": [0] }
    }
  }
}
```

**Key changes:**

- Rules/files deduplicated (stored once, referenced by index)
- Compact range tuples (67% smaller than objects)
- Deterministic ordering (sorted rules/files)
- Content-based keys for future delta computation

## Checklist

- [x] Code follows Effect-TS best practices
- [x] TypeScript strict mode passes
- [x] All tests pass (308 total)
- [x] Linter passes
- [x] Build succeeds
- [x] Changeset created
- [x] Breaking change documented (schema version bump, migration guide)

## Agent Context

**Implementation approach:**

Normalized schema:

- Extracted `RULE_KINDS` constant for type safety
- Implemented `normalizeResults()` with deterministic ordering (sorted rules/files)
- Stable content-based keys via `deriveResultKey()` for cross-checkpoint diffing
- Integrated into context-writer with path normalization

Loaders migration:

- Moved `mergeConfig`, `PresetLoader`, `rulesFromConfig` to core
- Created `PresetLoaderWorkspaceLive` layer for CLI workspace resolution
- Refactored CLI loaders to orchestrate core services

TypeScript project references:

- Split tsconfig.json into solution with src/test projects
- Fixed NodeNext module resolution (.js extensions)
- Removed redundant tests

**Amp Threads:**

- https://ampcode.com/threads/T-ce504221-dac5-4e22-86b2-317735faffb2 (schema implementation)
- https://ampcode.com/threads/T-dadffd74-9b38-4d2d-bb50-2f7dfcebd980 (loaders migration)
- https://ampcode.com/threads/T-301625dd-8e95-4ccc-94aa-3301f9fd6966 (this thread)

**Related docs:**

- @docs/agents/plans/pr2-normalized-schema.md
- @docs/agents/plans/loaders-to-core-migration.md
- @docs/agents/prs/reviews/amp/pr2-normalized-schema.md

## Migration Impact

**For external consumers:** None (pre-1.0, no published versions)

**For internal development:** Regenerate via `effect-migrate audit` (no migration script needed)

## Commits

26 commits organized in 3 phases:

1. **Normalized schema** (commits 1-17) - Schema design, normalizer, tests, changeset
2. **Loaders migration** (commits 18-23) - Move business logic to core, refactor CLI
3. **Build quality** (commits 24-26) - TypeScript project references, import fixes
