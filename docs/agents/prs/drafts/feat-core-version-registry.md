---
created: 2025-11-06
lastUpdated: 2025-11-06
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-c96fd392-d95e-4d15-ad65-5128dcd1751f
audience: Development team and reviewers
tags: [pr-draft, schema-versioning, amp-context, core-refactor]
---

# feat(core,cli): schema version registry and revision utilities for Amp context artifacts

## What

Establishes the schema version registry foundation for effect-migrate, introducing a unified versioning system for all Amp context artifacts. This PR refactors Amp utilities from CLI to core, enabling future MCP server reuse while adding structured schema versioning.

**Key additions:**

- Unified `SCHEMA_VERSION` in `packages/core/src/schema/versions.ts`
- Amp context schemas in `packages/core/src/schema/amp.ts`
- Core Amp utilities in `packages/core/src/amp/` (context-writer, thread-manager, metrics-writer)
- Tri-state `--amp-out` option (None, Default path, Custom path)
- Schema fields: `schemaVersion` and `revision` in audit.json and index.json

## Why

**Problem:** Current Amp context files lack versioning, making schema evolution and backward compatibility impossible. The CLI package tightly couples Amp output logic, preventing reuse by future MCP server (PR9).

**Solution:** Create a centralized schema registry with unified versioning, move Amp utilities to core for reusability, and implement graceful schema migration handling.

**Design decision:** Use unified `SCHEMA_VERSION` (0.1.0) instead of per-artifact versions to simplify mental model and ensure all artifacts evolve together.

## Scope

Packages affected:

- **`@effect-migrate/core`** (major additions)
  - New: `src/schema/versions.ts`, `src/schema/amp.ts`
  - New: `src/amp/` directory (context-writer, thread-manager, metrics-writer)
  - Updated: Public exports via subpath `@effect-migrate/core/amp`

- **`@effect-migrate/cli`** (refactored)
  - New: `src/amp/normalizeArgs.ts`, `src/amp/options.ts`
  - Updated: `src/commands/audit.ts`, `src/commands/metrics.ts`, `src/commands/thread.ts`
  - Removed: Inline Amp logic (moved to core)

## Changeset

- [x] Changeset added

**Changeset summary:**

> Introduce schema version registry with unified versioning for all Amp context artifacts. Move Amp utilities from CLI to core to enable MCP server reuse. Add tri-state --amp-out option for improved UX.

**Type:** minor (additive changes, no breaking changes in this PR)

## Testing

All checks passing:

```bash
pnpm build:types  # ✅ Types valid
pnpm typecheck    # ✅ Strict mode passes
pnpm lint         # ✅ No violations
pnpm build        # ✅ Builds successfully
pnpm test         # ✅ 172 tests passing
```

**New tests:**

- `packages/core/test/amp/context-writer.test.ts` - Schema version validation, revision counter, legacy file handling
- `packages/core/test/amp/thread-manager.test.ts` - URL validation, read error handling, tag/scope merging, schema migration
- `packages/core/test/schema/amp.test.ts` - Schema validation for all Amp context types

**Updated tests:**

- `packages/cli/test/commands/audit.test.ts` - Updated for tri-state `--amp-out` option
- `packages/cli/test/commands/metrics.test.ts` - Updated for core utilities usage

**Test coverage:** Comprehensive (context writing, thread management, schema validation, error handling, legacy file migration)

## Architecture Changes

### Before: Amp Logic in CLI

```
@effect-migrate/cli
└── src/commands/
    ├── audit.ts (inline Amp writing)
    └── metrics.ts (inline Amp writing)
```

### After: Amp Utilities in Core

```
@effect-migrate/core
├── src/schema/
│   ├── versions.ts       # Single source of truth: SCHEMA_VERSION
│   └── amp.ts            # Schemas for all Amp context files
└── src/amp/
    ├── context-writer.ts # Write audit.json, index.json, badges.md
    ├── thread-manager.ts # Manage threads.json
    └── metrics-writer.ts # Write metrics.json

@effect-migrate/cli
├── src/amp/
│   ├── normalizeArgs.ts  # Parser workaround for bare --amp-out flag
│   └── options.ts        # Tri-state AmpOutMode handling
└── src/commands/
    └── audit.ts          # Uses core/amp utilities
```

**Benefits:**

- Core utilities can be reused by MCP server (PR9)
- Cleaner separation of concerns (CLI = interface, core = logic)
- Subpath exports (`@effect-migrate/core/amp`) provide clean API

## Key Implementation Details

### 1. Unified Schema Versioning

**File:** `packages/core/src/schema/versions.ts`

```typescript
export const SCHEMA_VERSION = "0.1.0"
```

- Single version for all artifacts (audit, index, metrics, threads)
- Follows semver: major.minor.patch
- Version bumps when any artifact schema changes

### 2. Revision Counter

**File:** `packages/core/src/amp/context-writer.ts`

```typescript
export const getNextAuditRevision = (/* ... */)
```

- Increments on each audit run
- Handles legacy files (missing `revision` → starts at 1)
- Stored in `audit.json` as `revision: number`

### 3. Tri-State `--amp-out` Option

**Mode types:**

- `None` - No Amp output
- `Default` - Output to `.amp/`
- `Custom` - Output to user-specified path

**Parser workaround:** `normalizeArgs.ts` converts bare `--amp-out` flag to `--amp-out=__DEFAULT__` before @effect/cli parses arguments (handles parser limitation with optional values).

### 4. Schema Migration

**Thread manager handles:**

- Missing `version` field (legacy) → treats as version 0
- Future versions > current → fail with clear error
- Graceful degradation for malformed JSON

## Breaking Changes

**None in this PR.** Changes are additive only:

- ✅ `audit.json` gains `schemaVersion` and `revision` fields
- ✅ `index.json` gains `schemaVersion` field
- ⚠️ Removal of legacy `audit.version` **deferred to PR2** (normalized schema)

**Rationale:** Conservative rollout - avoid breaking consumers before normalized schema (PR2) is complete.

## Migration Impact

### For Consumers Reading audit.json

**Before (no versioning):**

```json
{
  "timestamp": "...",
  "findings": [...]
}
```

**After (v0.1.0):**

```json
{
  "schemaVersion": "0.1.0",
  "revision": 1,
  "timestamp": "...",
  "findings": [...]
}
```

**Impact:** ✅ Backward compatible - consumers can ignore new fields if desired.

## Dependency Upgrades

Minor version bumps (all tests passing, low risk):

- `effect`: 3.18.4 → 3.19.2
- `@effect/platform`: 0.92.1 → 0.93.0
- `@effect/platform-node`: 0.98.4 → 0.100.0
- `@effect/cli`: 0.71.0 → 0.72.0
- `@effect/vitest`: 0.26.0 → 0.27.0

## Checklist

- [ ] Code follows Effect-TS best practices
- [ ] TypeScript strict mode passes
- [ ] All tests pass (172 total)
- [ ] Linter passes
- [ ] Build succeeds
- [ ] Changeset created
- [ ] Documentation updated (inline JSDoc, schema comments)
- [ ] No breaking changes introduced
- [ ] Architecture improved (core/CLI separation)

## Agent Context (for AI agents)

**Implementation approach:**

- Used unified `SCHEMA_VERSION` instead of per-artifact versions (simpler mental model)
- Moved Amp utilities to core for MCP server reuse (PR9 prerequisite)
- Implemented tri-state `--amp-out` with parser workaround for bare flag handling
- Conservative versioning (0.1.0, defer breaking changes to PR2)
- Comprehensive error handling with graceful fallbacks for legacy files

**Amp Thread(s):**

- Review + implementation: https://ampcode.com/threads/T-2933f616-8665-4925-8ace-ee1589f26b28
- PR draft creation: https://ampcode.com/threads/T-c96fd392-d95e-4d15-ad65-5128dcd1751f

**Related docs:**

- Root AGENTS.md - PR workflow and conventions
- docs/agents/AGENTS.md - PR draft requirements

**Scope expansion:** ~2000+ lines (vs planned 200) due to Amp utilities refactor, test migration, and tri-state option implementation. Justified by improved architecture and reusability.
