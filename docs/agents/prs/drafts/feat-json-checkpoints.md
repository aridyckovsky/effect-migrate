---
created: 2025-11-08
lastUpdated: 2025-11-08
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-ba142799-56ed-4e1f-bbf1-de0184c11957
audience: Development team and reviewers
tags: [pr-draft, checkpoints, persistence, wave1, time-series, delta-computation]
---

# feat(core,cli): time-series checkpoint persistence with delta computation

## What

**Time-Series Checkpoints:** Implement JSON checkpoint system for tracking audit history with automatic thread linking, delta computation, and O(1) access to latest audit via symlink.

**New Services:** Add Time and ProcessInfo services for testable date/time and environment variable access.

## Why

Enable migration progress tracking by preserving audit snapshots instead of overwriting. Each checkpoint:

- Links to Amp thread via `AMP_CURRENT_THREAD_ID`
- Computes deltas between consecutive audits  
- Uses normalized schema (FindingsGroup) for 40-70% size reduction
- Provides CLI commands for history navigation

## Scope

**Packages affected:**

- `@effect-migrate/core` - Checkpoint manager, Time/ProcessInfo services, checkpoint schemas
- `@effect-migrate/cli` - Checkpoints command for history navigation

## Changeset

- [x] Changeset added

**Changeset summary:**

> Add time-series checkpoint persistence with automatic thread linking and delta computation. New services: Time and ProcessInfo for testable date/time and environment access. New CLI command: `checkpoints` for audit history navigation.

## Testing

```bash
pnpm build:types && pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

**All checks pass:** ✅

**New tests added:**

- `packages/core/test/amp/checkpoint-manager.test.ts` (24 tests) - ID generation, manifest management, delta computation
- `packages/core/test/services/Time.test.ts` (5 tests) - Time service layer validation
- `packages/core/test/services/ProcessInfo.test.ts` (5 tests) - Environment variable access
- `packages/cli/test/commands/checkpoints.test.ts` (9 tests) - CLI command validation

**Manual testing verified:**

- Multi-session workflow with different thread IDs
- Symlink creation on Unix (macOS)
- Delta computation between consecutive audits
- CLI commands: `list`, `latest`, `show`, `diff`

## Checkpoint Structure

```
.amp/effect-migrate/
├── index.json                    # Updated with checkpoint info
├── audit.json                    # Symlink to latest checkpoint
├── checkpoints/
│   ├── 2025-11-08T10-00-00Z.json # Timestamped checkpoints
│   ├── 2025-11-08T11-30-00Z.json
│   └── manifest.json             # Navigation index
├── threads.json
├── metrics.json
└── badges.md
```

## Schema Changes

**New schemas in `@effect-migrate/core/src/schema/amp.ts`:**

- `AuditCheckpoint` - Full audit snapshot with checkpointId
- `CheckpointMetadata` - Manifest entry with delta and thread info
- `CheckpointManifest` - Complete history index
- `CheckpointSummary` - Navigation summary for index.json

**Updated schemas:**

- `AmpContextIndex` - Added `latestCheckpoint` and `checkpoints` fields

## CLI Commands

```bash
# List checkpoint history
pnpm cli checkpoints list

# Show latest checkpoint
pnpm cli checkpoints latest

# Show specific checkpoint
pnpm cli checkpoints show 2025-11-08T10-00-00Z

# Compare two checkpoints
pnpm cli checkpoints diff 2025-11-08T10-00-00Z 2025-11-08T11-30-00Z
```

## Key Features

**Automatic Thread Linking:**
- Detects `AMP_CURRENT_THREAD_ID` environment variable
- Associates checkpoint with Amp thread
- Displayed in CLI output and stored in metadata

**Delta Computation:**
- Calculates changes in errors/warnings/info between checkpoints
- Stored in manifest for O(1) access
- Formatted with +/- indicators in CLI

**Efficient Storage:**
- Uses FindingsGroup schema (normalized from PR2)
- 40-70% size reduction vs. flat format
- Symlink to latest checkpoint for compatibility

**Test Infrastructure:**
- Mock filesystem helpers for isolated testing
- Deterministic timestamps via Time service layer
- Environment variable mocking via ProcessInfo service

## Checklist

- [x] Code follows Effect-TS best practices
- [x] TypeScript strict mode passes
- [x] All tests pass
- [x] Linter passes
- [x] Build succeeds
- [x] Changeset created
- [x] Manual multi-session testing completed

## Agent Context

**Implementation approach:**

Time/ProcessInfo services:
- Created testable abstractions for date/time and environment access
- Implemented Live and Test layers for each service
- Enabled deterministic testing via controlled time/env values

Checkpoint manager:
- Filesystem-safe ID generation (ISO 8601 with hyphens)
- Thread detection via ProcessInfo service
- Delta computation from FindingsSummary structs
- Manifest management with newest-first ordering

CLI integration:
- Table formatting via cli-table3 for readable output
- JSON output support via `--json` flag
- Error handling for missing checkpoints
- Symlink validation and fallback

Test infrastructure:
- Mock filesystem helpers for isolated service testing
- Snapshot testing for CLI output formatting
- Cross-platform compatibility (symlink/copy based on OS)

**Amp Threads:**

- https://ampcode.com/threads/T-5bd34c50-9752-4d71-8768-e8290de2c380 (checkpoint planning)
- https://ampcode.com/threads/T-ba142799-56ed-4e1f-bbf1-de0184c11957 (this implementation)

**Related docs:**

- @docs/agents/plans/pr3-json-checkpoints.md
- @docs/agents/plans/checkpoint-based-audit-persistence.md
- @docs/agents/plans/comprehensive-data-architecture.md

## Migration Impact

**For external consumers:** None (pre-1.0, no published versions)

**For internal development:**
- Existing `.amp/effect-migrate/audit.json` preserved via symlink
- Checkpoints directory created on first audit after PR
- No breaking changes to audit schema (uses 0.2.0 from PR2)

## Commits

7 commits organized in 2 phases:

1. **Services infrastructure** (commits 1-2) - Time and ProcessInfo services with test layers
2. **Checkpoint implementation** (commits 3-5) - Manager, schemas, CLI command, integration
3. **Test infrastructure** (commits 6-7) - Mock helpers, refactoring, documentation
