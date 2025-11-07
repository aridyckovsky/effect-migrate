---
created: 2025-11-07
lastUpdated: 2025-11-07
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-ce504221-dac5-4e22-86b2-317735faffb2, https://ampcode.com/threads/T-dadffd74-9b38-4d2d-bb50-2f7dfcebd980
audience: Development team and reviewers
tags: [pr-draft, normalized-schema, breaking-change, performance, wave1, loaders-migration]
---

# feat(core,cli): normalized audit schema + move business logic to core

## What

1. **Normalized Schema**: Reduce audit.json file size by 40-70% through normalized, index-based schema with deduplication
2. **Loaders Migration**: Move all business logic from CLI to core, making CLI a thin orchestrator

Replaces duplicated `byFile` and `byRule` structures with deduplicated `rules[]`, `files[]`, and `results[]` arrays. Rules and files are stored once and referenced by index.

**Breaking Changes:**

- Schema version 0.1.0 → 0.2.0 (audit.json - no backwards compatibility)
- CLI loaders removed (config.ts, presets.ts) - logic moved to @effect-migrate/core

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

- `@effect-migrate/core` - Breaking schema change (0.1.0 → 0.2.0) + new business logic exports
- `@effect-migrate/cli` - Loaders removed, new workspace preset layer

**Core files modified:**

Normalized schema:

- `packages/core/src/schema/amp.ts` - Normalized schema definitions
- `packages/core/src/schema/versions.ts` - Version bump to 0.2.0
- `packages/core/src/amp/normalizer.ts` - NEW: Deduplication logic
- `packages/core/src/amp/context-writer.ts` - Integration with normalizer, fixed docstrings
- `packages/core/src/amp/metrics-writer.ts` - Fixed docstrings (@core not @cli)
- `packages/core/src/amp/thread-manager.ts` - Fixed docstrings (@core not @cli)
- `packages/core/src/rules/types.ts` - Extract RULE_KINDS constant
- `packages/core/src/types.ts` - Export RuleKind type
- `packages/core/src/index.ts` - Export normalizer + new utilities
- `packages/core/src/amp/index.ts` - Export normalizer utilities

Business logic migration:

- `packages/core/src/config/merge.ts` - NEW: Config merging utilities
- `packages/core/src/presets/PresetLoader.ts` - NEW: Preset loading service
- `packages/core/src/rules/builders.ts` - NEW: rulesFromConfig builder
- `packages/core/src/utils/merge.ts` - NEW: Deep merge utilities
- `packages/core/src/schema/Config.ts` - Add presets field
- `packages/core/src/util/glob.ts` - DELETED: Consolidated into utils/
- `packages/core/src/services/FileDiscovery.ts` - Fix barrel imports
- `packages/core/src/services/RuleRunner.ts` - Fix barrel imports
- `packages/core/src/engines/BoundaryEngine.ts` - Fix barrel imports

TypeScript config:

- `packages/core/tsconfig.json` - NEW: Solution file with project references
- `packages/core/tsconfig.src.json` - NEW: Source project config
- `packages/core/tsconfig.test.json` - Updated with project reference to src
- `packages/core/tsconfig.build.json` - Updated to match src config

**CLI files modified:**

New layers and refactored loaders:

- `packages/cli/src/layers/PresetLoaderWorkspace.ts` - NEW: Workspace-aware preset resolution
- `packages/cli/src/loaders/rules.ts` - Refactored to orchestrate core services
- `packages/cli/src/loaders/config.ts` - DELETED: Moved to core
- `packages/cli/src/loaders/presets.ts` - DELETED: Replaced by PresetLoader service
- `packages/cli/src/commands/audit.ts` - Use loadRulesAndConfig orchestrator
- `packages/cli/src/commands/metrics.ts` - Use loadRulesAndConfig orchestrator
- `packages/cli/src/index.ts` - Provide PresetLoaderWorkspaceLive layer
- `packages/cli/package.json` - No new dependencies (uses core exports)

TypeScript config:

- `packages/cli/tsconfig.json` - Updated for new structure
- `packages/cli/tsconfig.src.json` - NEW: Source project config
- `packages/cli/tsconfig.test.json` - Updated for test consolidation
- `packages/cli/tsconfig.build.json` - Updated to match src config

**Preset-basic files modified:**

- `packages/preset-basic/tsconfig.json` - Updated for consistency
- `packages/preset-basic/tsconfig.src.json` - NEW: Source project config
- `packages/preset-basic/tsconfig.test.json` - Updated for consistency
- `packages/preset-basic/tsconfig.build.json` - Updated for consistency
- `packages/preset-basic/test/patterns.test.ts` - Fix imports
- `packages/preset-basic/package.json` - Updated peerDependencies

**Tests added:**

Normalized schema:

- `packages/core/test/amp/normalizer.test.ts` - 1000+ lines, 40+ test cases

Business logic:

- `packages/core/test/config/merge.test.ts` - 9 tests for config merging
- `packages/core/test/utils/merge.test.ts` - 21 tests for deep merge utilities
- `packages/core/test/presets/PresetLoader.test.ts` - 6 tests for preset loading
- `packages/core/test/rules/builders.test.ts` - 14 tests for rule construction
- `packages/cli/test/layers/PresetLoaderWorkspace.test.ts` - 6 tests for workspace preset resolution

**Tests updated:**

- `packages/core/test/amp/context-writer.test.ts` - Updated for normalized output
- `packages/core/test/amp/schema.test.ts` - Updated for normalized schema
- `packages/core/test/rules/helpers.test.ts` - Document coverage, add .js imports
- `packages/core/test/services/ImportIndex.test.ts` - Fix .js extension in reverse index test
- `packages/core/test/fixtures/sample-project/src/*.ts` - Add .js extensions per NodeNext
- `packages/preset-basic/test/patterns.test.ts` - Fix imports
- `packages/cli/test/commands/thread.test.ts` - Remove unused imports

**Tests removed:**

- `packages/core/test/rules.test.ts` - Redundant with helpers.test.ts (documented)
- `packages/cli/test/loaders/config.test.ts` - Replaced by core/test/config tests
- `packages/cli/test/loaders/presets.test.ts` - Replaced by core/test/presets tests

**Test organization:**

- Moved all tests from `packages/*/src/__tests__/` to `packages/*/test/`
- Updated test imports to use `../../src/` paths
- Fixed test schemas to match actual Config types
- Added type guards for Effect error handling

## Changeset

- [x] Changeset added
- [ ] No changeset needed (internal change only)

**Changeset summary:**

> Add normalized schema for 40-70% audit.json size reduction and move business logic to core. Breaking changes: (1) Schema 0.1.0 → 0.2.0 - replaces byFile/byRule with deduplicated arrays. (2) CLI loaders removed - use @effect-migrate/core exports instead. New core exports: mergeConfig, PresetLoader service, rulesFromConfig builder.

## Testing

**Build and type check:**

```bash
pnpm build:types
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

**All tests pass:** ✅ (308 total tests)

**New tests:**

Normalized schema (40+ tests):

- `packages/core/test/amp/normalizer.test.ts`
  - Deterministic ordering (sorted rules/files)
  - Deduplication (rules stored once)
  - Expansion (reconstructs full RuleResult)
  - Stable keys (content-based, survives index changes)
  - Size reduction verification (40-70% on realistic datasets)
  - Edge cases (empty results, file-less results, message overrides, info severity)

Business logic (56 tests):

- `packages/core/test/config/merge.test.ts` - Config merging with preset defaults
- `packages/core/test/utils/merge.test.ts` - Deep merge utilities, array replacement
- `packages/core/test/presets/PresetLoader.test.ts` - Preset loading, validation, npm resolution
- `packages/core/test/rules/builders.test.ts` - Rule construction from config
- `packages/cli/test/layers/PresetLoaderWorkspace.test.ts` - Workspace preset resolution

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

7. **TypeScript Project References (build quality):**
   - Split tsconfig.json into solution with src/test project references
   - Test project now properly references src project (type checking)
   - Separate build infos prevent incremental build conflicts
   - Fixed NodeNext module resolution (.js extension requirements)
   - Removed redundant test files, cleaned up fixture imports

**Effect patterns used:**

- Pure functions (normalizer has no side effects)
- No Schema misuse (services use interfaces, not Schema)
- Proper type exports (`Schema.Schema.Type<typeof X>`)
- Effect.gen composition in context-writer
- No type assertions in tests (proper Effect/Schema patterns)

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
2. Gzip compression for stored audit.json (would multiply gains)
3. Delta computation between checkpoints using stable keys

## Commits

This PR contains 20 commits organized chronologically:

1. **Schema implementation** (commits 1-9):
   - Extract RULE_KINDS, implement normalized schema, normalizer logic
   - Add comprehensive test suite (40+ cases)
   - Export utilities from public API

2. **Documentation and changesets** (commits 10-13):
   - Add changeset, plan docs, PR draft
   - Update SCHEMA_VERSION references

3. **Type safety fixes** (commits 14-17):
   - Add info counter to FindingsSummary
   - Fix RuleDef typing in tests
   - Handle optional group fields properly

4. **TypeScript Project References** (commits 18-20):
   - Implement src/test project references
   - Fix NodeNext module resolution (.js extensions)
   - Remove redundant tests, apply formatting

All checks pass: `pnpm lint && pnpm typecheck && pnpm build && pnpm test` ✅
