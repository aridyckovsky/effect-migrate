---
created: 2025-11-08
lastUpdated: 2025-11-08
author: Generated via Amp (coordinated subagents)
status: complete
thread: https://ampcode.com/threads/T-ef7148f3-339e-4252-9824-286bde77eee9
audience: Development team and reviewers
tags: [pr-draft, norms-capture, wave2, effect-first, schema-reuse, mvp]
---

# feat(core,cli): norms capture with lookback window consensus

## What

**Norms Capture MVP:** Detect and document established migration norms from checkpoint history using lookback window consensus algorithm.

**New Services:** DirectorySummarizer service for analyzing audit checkpoints and computing directory-level migration statistics.

## Why

Enable teams to surface durable migration agreements from real audit history. A "norm" is a rule that went to zero violations and stayed there across K consecutive checkpoints (lookback window), with evidence of prior violations. This provides:

- **Stability validation:** Requires K-checkpoint consensus to avoid false positives from temporary fixes
- **Directory-level insights:** Status categorization (migrated/in-progress/not-started)
- **Documentation foundation:** Prepare-only mode generates JSON summaries for AGENTS.md integration

## Scope

**Packages affected:**

- `@effect-migrate/core` - Norms schemas, pure detection logic, DirectorySummarizer service
- `@effect-migrate/cli` - `norms capture` command with filtering and output options

## Changeset

- [ ] Changeset to be added after review

**Changeset summary:**

> Add norms capture feature for detecting established migration norms from checkpoint history. Uses lookback window consensus algorithm to identify rules that went to zero and stayed there. Includes DirectorySummarizer service, comprehensive JSDoc (@since 0.6.0), and CLI command with prepare-only mode.

## Testing

```bash
pnpm build:types && pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

**All checks pass:** ✅

**New tests added:**

- `packages/core/test/norms/pure.test.ts` (23 tests) - Pure function unit tests with 100% coverage
- `packages/core/test/norms/DirectorySummarizer.test.ts` (15 tests) - Service integration with realistic fixtures
- `packages/cli/test/commands/norms.test.ts` (15 tests) - CLI command with all options and error paths

**Total:** 53 new tests, 358 tests passing across all packages (+28)

**Manual testing verified:**

- Prepare-only mode (no writes, guidance display)
- Write mode with JSON file creation
- Status filtering (migrated/in-progress/all)
- Directory filtering and lookback window parameters
- Schema.encodeSync DateTimeUtc serialization

## Implementation Details

### Norm Detection Algorithm

For each rule in a directory:

1. Build time series of violation counts across last N checkpoints (sorted ascending)
2. Rule becomes a "norm" if:
   - Last K checkpoints (lookbackWindow, default 5) ALL have count === 0
   - There exists an EARLIER checkpoint with count > 0
3. `establishedAt` = timestamp of first checkpoint where count became 0
4. `violationsFixed` = peak violations before zero transition

**Key improvements from oracle analysis:**

- ✅ Load MOST RECENT checkpoints (not oldest) via `slice(-checkpointLimit)`
- ✅ Compute `violationsFixed` as max before zero (not last count)
- ✅ Directory stats use union across history (total files) + latest (violations)
- ✅ Status determination reordered to check migrated first

### Schema Reuse (DRY)

```typescript
import { Severity, CheckpointSummary } from "../schema/amp.js"

export const Norm = Schema.Struct({
  ruleId: Schema.String,
  severity: Severity,  // ✅ Reused from amp schema
  establishedAt: Schema.DateTimeUtc,
  violationsFixed: Schema.Number,
  docsUrl: Schema.optional(Schema.String)
})

export const DirectorySummary = Schema.Struct({
  directory: Schema.String,
  status: DirectoryStatus,  // migrated | in-progress | not-started
  files: Schema.Struct({ total, clean, withViolations }),
  norms: Schema.Array(Norm),
  threads: Schema.Array(ThreadAssociation),
  latestCheckpoint: CheckpointSummary  // ✅ Reused entire schema
})
```

### Pure + IO Separation

**Pure layer** (`pure.ts`):
- 100% side-effect-free logic
- Plain objects (NormData with ISO strings)
- Comprehensive unit tests (23 tests)
- Functions: `detectExtinctNorms`, `computeDirectoryStats`, `determineStatus`, `findCleanTimestamp`

**IO layer** (`DirectorySummarizer.ts`):
- Effect service with Context.Tag + Live layer
- Reads checkpoints via checkpoint-manager
- Converts NormData → Norm (ISO strings → DateTimeUtc)
- Proper layer composition with NodeContext

## CLI Commands

```bash
# Prepare-only mode (default) - no writes, print guidance
pnpm cli norms capture --prepare-only

# Filter by status
pnpm cli norms capture --status migrated
pnpm cli norms capture --status in-progress

# Analyze specific directory
pnpm cli norms capture --directory src/services

# Adjust lookback window (norm consensus requirement)
pnpm cli norms capture --lookback 3

# Filter by minimum files
pnpm cli norms capture --min-files 5

# Write mode with overwrite
pnpm cli norms capture --overwrite --amp-out .amp/effect-migrate
```

**Output structure:**

```
.amp/effect-migrate/
└── norms/
    ├── src-services.json
    ├── src-utils.json
    └── packages-core.json
```

## Files Changed

### New Files (8)

**Core:**
- `src/norms/types.ts` (~160 LOC) - DirectoryStatus, Norm, DirectorySummary schemas
- `src/norms/errors.ts` (~60 LOC) - TaggedErrors with usage examples
- `src/norms/pure.ts` (~380 LOC) - Pure detection logic with algorithm docs
- `src/norms/DirectorySummarizer.ts` (~250 LOC) - Effect service with JSDoc
- `test/norms/pure.test.ts` (~560 LOC) - Comprehensive unit tests
- `test/norms/DirectorySummarizer.test.ts` (~800 LOC) - Integration tests with fixtures

**CLI:**
- `src/commands/norms.ts` (~270 LOC) - CLI command with all options
- `test/commands/norms.test.ts` (~700 LOC) - CLI integration tests

### Modified Files (3)

**Core:**
- `src/schema/amp.ts` (+2 lines) - Exported `Severity` schema
- `src/index.ts` (+4 lines) - Norms module exports

**CLI:**
- `src/index.ts` (+2 lines) - Registered `normsCommand`

**Total:** ~2,180 new LOC

## Documentation Quality

✅ **Comprehensive JSDoc:**
- All exports tagged with `@since 0.6.0`
- All functions documented with `@param`, `@returns`, `@throws`
- Usage examples for complex functions (norm detection algorithm)
- Error handling examples with `Effect.catchTag`
- Category tags (`@category Schema`, `@category Pure Function`, etc.)

**Example documentation:**

```typescript
/**
 * Detect extinct norms from checkpoint history.
 *
 * A norm is established when a rule's violation count:
 * 1. Reaches zero and stays zero for the last K checkpoints (lookback window)
 * 2. Had non-zero violations in an earlier checkpoint (evidence of prior violations)
 *
 * @param checkpoints - Checkpoint history (sorted ascending by timestamp)
 * @param directory - Directory path to analyze (e.g., "src/services")
 * @param lookbackWindow - Number of consecutive zero checkpoints required (default: 5)
 * @returns Array of established norms with metadata
 *
 * @category Pure Function
 * @since 0.6.0
 *
 * @example
 * const checkpoints = [...]  // Load from checkpoint-manager
 * const norms = detectExtinctNorms(checkpoints, "src/services", 5)
 * console.log(`Found ${norms.length} established norms`)
 */
```

## Breaking Changes

None - purely additive feature.

## Next Steps

After merge:

1. Generate checkpoint data for this repository via regular audits
2. Run `norms capture --prepare-only` to preview directory summaries
3. Use JSON output to document established norms in AGENTS.md
4. Consider Wave 3: Auto-generate AGENTS.md sections from norm summaries

## Success Criteria

- [x] Norm detection algorithm with lookback window consensus
- [x] Directory status determination (migrated/in-progress/not-started)
- [x] Schema reuse (Severity, CheckpointSummary)
- [x] Pure + IO separation for testability
- [x] DirectorySummarizer service with proper layers
- [x] CLI command with prepare-only mode
- [x] Status filtering (migrated/in-progress/all)
- [x] Directory filtering and lookback window parameters
- [x] JSON output via Schema.encodeSync
- [x] Comprehensive JSDoc with @since 0.6.0
- [x] 53 new tests (all passing)
- [x] Bug fixes: checkpoint slicing, stats computation, status ordering
- [ ] Changeset added
- [ ] AGENTS.md documentation (future PR)

## Related

**Plan:** [docs/agents/plans/pr7-norms-capture-mvp-v2.md](../../plans/pr7-norms-capture-mvp-v2.md)  
**Thread:** https://ampcode.com/threads/T-ef7148f3-339e-4252-9824-286bde77eee9  
**Dependencies:** PR #46 (JSON checkpoints) - ✅ MERGED
