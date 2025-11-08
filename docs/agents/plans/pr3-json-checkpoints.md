---
created: 2025-11-06
lastUpdated: 2025-11-08
author: Generated via Amp (Oracle + Librarian analysis) - Revised based on PR1/PR2 actuals
status: ready
thread: https://ampcode.com/threads/T-5bd34c50-9752-4d71-8768-e8290de2c380
audience: Development team and AI coding agents
tags: [pr-plan, checkpoints, persistence, wave1, time-series, delta-computation]
related:
  - ./checkpoint-based-audit-persistence.md
  - ./comprehensive-data-architecture.md
  - ../concepts/amp-integration.md
---

# PR3: JSON Checkpoints Implementation Plan

## Goal

Implement time-series checkpoint persistence with thread linking and delta computation for tracking migration progress over time.

**Estimated Effort:** 4-6 hours coding + 1-2 hours testing

**Dependencies:**
- ✅ PR2: Normalized Schema (complete - schema 0.2.0 with FindingsGroup)
- ✅ Schema versioning infrastructure (complete - SCHEMA_VERSION in core)

---

## Overview

This PR implements the JSON checkpoint system from the comprehensive data architecture, enabling:

1. **Historical tracking**: Preserve audit snapshots instead of overwriting
2. **Progress monitoring**: Calculate deltas between consecutive audits
3. **Thread association**: Auto-link checkpoints to Amp threads via `AMP_CURRENT_THREAD_ID`
4. **Agent navigation**: Provide O(1) access to latest audit via symlink and index

**Key Principle:** Use normalized schema (FindingsGroup) from PR2 for efficient storage (40-70% size reduction).

---

## What We Already Have (from PR1/PR2)

### Schema Infrastructure ✅

**Location:** `packages/core/src/schema/`

- `versions.ts`: Single `SCHEMA_VERSION = "0.2.0"` for all artifacts
- `amp.ts`: Complete schemas including:
  - `AmpAuditContext`: Main audit schema with `FindingsGroup`
  - `AmpContextIndex`: Navigation index schema
  - `ThreadEntry`: Thread entry for threads.json
  - `ThreadsFile`: Threads file schema
  - `FindingsSummary`: Summary statistics (errors, warnings, info, totalFiles, totalFindings)

### Amp Context Writer ✅

**Location:** `packages/core/src/amp/context-writer.ts`

- ✅ Auto-detects `AMP_CURRENT_THREAD_ID` environment variable
- ✅ Auto-adds threads to threads.json with smart tags and descriptions
- ✅ Writes audit.json, index.json, badges.md
- ✅ Increments revision number on each audit
- ✅ Uses `FindingsGroup` (normalized schema) for findings

### Thread Management ✅

**Location:** `packages/core/src/amp/thread-manager.ts`

- ✅ `addThread()`: Add thread entries
- ✅ `readThreads()`: Read threads.json
- ✅ Thread auto-registration during audit if `AMP_CURRENT_THREAD_ID` is set

### Normalization ✅

**Location:** `packages/core/src/amp/normalizer.ts`

- ✅ `normalizeResults()`: Convert RuleResult[] to FindingsGroup
- ✅ `expandResult()`: Convert back to flat format
- ✅ `deriveResultKey()`: Generate stable content-based keys for delta computation
- ✅ `rebuildGroups()`: Rebuild groups from results array

---

## What We Need to Implement

### 1. Checkpoint Directory Structure

```
.amp/effect-migrate/
├── index.json                    # Updated with checkpoint info
├── audit.json                    # Symlink to latest checkpoint
├── checkpoints/
│   ├── 2025-11-08T10-00-00Z.json # First checkpoint
│   ├── 2025-11-08T11-30-00Z.json # Second checkpoint
│   ├── 2025-11-08T14-15-00Z.json # Third checkpoint
│   └── manifest.json             # Checkpoint metadata
├── threads.json                  # Existing thread tracking
├── metrics.json                  # Existing metrics
└── badges.md                     # Existing badges
```

### 2. New Schemas (in packages/core/src/schema/amp.ts)

Add checkpoint-specific schemas alongside existing ones:

```typescript
/**
 * Checkpoint summary for index navigation (last N checkpoints).
 */
export const CheckpointSummary = Schema.Struct({
  /** Checkpoint ID (filesystem-safe timestamp) */
  id: Schema.String,
  
  /** ISO timestamp */
  timestamp: Schema.String,

  /** Amp thread ID if audit was run during a thread */
  thread: Schema.optional(Schema.String),

  /** Findings summary */
  summary: FindingsSummary,

  /** Delta from previous checkpoint */
  delta: Schema.optional(
    Schema.Struct({
      errors: Schema.Number,
      warnings: Schema.Number,
      info: Schema.Number,
      totalFindings: Schema.Number
    })
  )
})

/**
 * Checkpoint metadata in manifest.json.
 */
export const CheckpointMetadata = Schema.Struct({
  /** Checkpoint ID (filesystem-safe timestamp) */
  id: Schema.String,

  /** ISO timestamp */
  timestamp: Schema.DateTimeUtc,

  /** Relative path to checkpoint file */
  path: Schema.String,

  /** Amp thread ID */
  thread: Schema.optional(Schema.String),

  /** Audit schema version */
  schemaVersion: Schema.String,

  /** Tool version */
  toolVersion: Schema.String,

  /** Summary statistics */
  summary: FindingsSummary,

  /** Delta from previous */
  delta: Schema.optional(
    Schema.Struct({
      errors: Schema.Number,
      warnings: Schema.Number,
      info: Schema.Number,
      totalFindings: Schema.Number
    })
  ),

  /** User description (optional) */
  description: Schema.optional(Schema.String),

  /** Tags (optional) */
  tags: Schema.optional(Schema.Array(Schema.String))
})

/**
 * Checkpoint manifest (complete history).
 */
export const CheckpointManifest = Schema.Struct({
  /** Manifest schema version */
  schemaVersion: Semver,

  /** Project root */
  projectRoot: Schema.String,

  /** All checkpoints (newest first) */
  checkpoints: Schema.Array(CheckpointMetadata)
})

/**
 * Individual checkpoint file (full audit snapshot).
 * 
 * This is essentially AmpAuditContext with a checkpointId field.
 */
export const AuditCheckpoint = Schema.Struct({
  /** Audit format version */
  schemaVersion: Semver,
  
  /** Audit revision number */
  revision: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1)
  ),

  /** Checkpoint ID (matches filename) */
  checkpointId: Schema.String,

  /** effect-migrate version */
  toolVersion: Schema.String,

  /** Project root */
  projectRoot: Schema.String,

  /** ISO timestamp */
  timestamp: Schema.DateTimeUtc,

  /** Amp thread ID */
  thread: Schema.optional(Schema.String),

  /** Normalized findings (FindingsGroup from PR2) */
  findings: FindingsGroup,

  /** Config snapshot */
  config: ConfigSnapshot,

  /** Thread references (if any) */
  threads: Schema.optional(Schema.Array(ThreadReference))
})
```

### 3. Update AmpContextIndex Schema

**File:** `packages/core/src/schema/amp.ts`

Update the existing index schema to include checkpoint navigation:

```diff
export const AmpContextIndex = Schema.Struct({
  /** Schema version for all artifacts */
  schemaVersion: Semver,
  /** effect-migrate tool version */
  toolVersion: Schema.String,
  /** Project root directory */
  projectRoot: Schema.String,
  /** ISO timestamp when index was generated */
  timestamp: Schema.DateTimeUtc,
+ /** Latest checkpoint ID (if checkpoints exist) */
+ latestCheckpoint: Schema.optional(Schema.String),
+ /** Recent checkpoint history (last 10) */
+ checkpoints: Schema.optional(Schema.Array(CheckpointSummary)),
  /** Relative paths to context files */
  files: Schema.Struct({
    /** Path to audit.json */
    audit: Schema.String,
+   /** Path to checkpoints directory (if exists) */
+   checkpoints: Schema.optional(Schema.String),
+   /** Path to checkpoint manifest (if exists) */
+   manifest: Schema.optional(Schema.String),
    /** Path to metrics.json (future) */
    metrics: Schema.optional(Schema.String),
    /** Path to badges.md */
    badges: Schema.optional(Schema.String),
    /** Path to threads.json (present when threads exist) */
    threads: Schema.optional(Schema.String)
  })
})
```

---

## Implementation Order

### Phase 1: Checkpoint Manager Module (2-3 hours)

**File:** `packages/core/src/amp/checkpoint-manager.ts`

**Purpose:** Checkpoint creation, listing, reading, and delta computation.

**Implementation:**

```typescript
/**
 * Checkpoint Manager - Time-series audit persistence.
 *
 * @module @effect-migrate/core/amp/checkpoint-manager
 * @since 0.5.0
 */

import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Clock from "effect/Clock"
import * as Console from "effect/Console"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Data from "effect/Data"
import type { FindingsGroup, FindingsSummary } from "../schema/amp.js"
import { 
  CheckpointSummary, 
  CheckpointMetadata, 
  CheckpointManifest,
  AuditCheckpoint 
} from "../schema/amp.js"
import type { Config } from "../schema/Config.js"
import { SCHEMA_VERSION } from "../schema/versions.js"
import { getPackageMeta } from "./package-meta.js"
import { readThreads } from "./thread-manager.js"

// ============================================================================
// Errors
// ============================================================================

export class CheckpointNotFoundError extends Data.TaggedError("CheckpointNotFoundError")<{
  readonly checkpointId: string
  readonly message: string
}> {}

export class CheckpointWriteError extends Data.TaggedError("CheckpointWriteError")<{
  readonly reason: string
}> {}

export class ManifestReadError extends Data.TaggedError("ManifestReadError")<{
  readonly path: string
  readonly reason: string
}> {}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate checkpoint ID from timestamp.
 * Format: "2025-11-08T10-00-00Z" (filesystem-safe).
 */
export const generateCheckpointId = (timestamp: DateTime.DateTime): string => {
  const iso = DateTime.formatIso(timestamp)
  return iso.replace(/:/g, "-").replace(/\.\d{3}/, "")
}

/**
 * Detect Amp thread ID from environment.
 *
 * Amp sets AMP_CURRENT_THREAD_ID when running commands during a thread.
 */
export const detectThreadId = (): string | undefined => {
  return process.env.AMP_CURRENT_THREAD_ID
}

/**
 * Compute delta between two summaries.
 */
export const computeDelta = (
  previous: FindingsSummary,
  current: FindingsSummary
) => ({
  errors: current.errors - previous.errors,
  warnings: current.warnings - previous.warnings,
  info: current.info - previous.info,
  totalFindings: current.totalFindings - previous.totalFindings
})

// ============================================================================
// Checkpoint Persistence
// ============================================================================

/**
 * Create a new checkpoint.
 *
 * Steps:
 * 1. Generate checkpoint ID from current time
 * 2. Write checkpoint file to checkpoints/
 * 3. Update manifest.json with metadata
 * 4. Update audit.json symlink (or copy on Windows)
 * 5. Return checkpoint metadata
 */
export const createCheckpoint = (
  outputDir: string,
  findings: FindingsGroup,
  config: Config,
  revision: number
): Effect.Effect<
  CheckpointMetadata,
  CheckpointWriteError | ManifestReadError,
  FileSystem.FileSystem | Path.Path | Clock.Clock
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // 1. Generate checkpoint ID
    const now = yield* Clock.currentTimeMillis.pipe(
      Effect.map((millis) => DateTime.unsafeMake(millis))
    )
    const checkpointId = generateCheckpointId(now)

    yield* Console.log(`Creating checkpoint: ${checkpointId}`)

    // 2. Get metadata
    const { toolVersion } = yield* getPackageMeta
    const threadId = detectThreadId()

    // Read threads to include in checkpoint
    const threadsFile = yield* readThreads(outputDir).pipe(
      Effect.catchAll(() => Effect.succeed({ 
        schemaVersion: SCHEMA_VERSION, 
        toolVersion, 
        threads: [] 
      }))
    )
    const currentThread = threadsFile.threads.find(t => t.auditRevision === revision)
    const auditThreads = currentThread ? [{
      url: currentThread.url,
      timestamp: currentThread.createdAt,
      auditRevision: currentThread.auditRevision ?? revision,
      ...(currentThread.description && { description: currentThread.description }),
      ...(currentThread.tags && currentThread.tags.length > 0 && { tags: currentThread.tags }),
      ...(currentThread.scope && currentThread.scope.length > 0 && { scope: currentThread.scope })
    }] : []

    // Build checkpoint object (matches AuditCheckpoint schema)
    const checkpoint = {
      schemaVersion: SCHEMA_VERSION,
      revision,
      checkpointId,
      toolVersion,
      projectRoot: ".",
      timestamp: now,
      ...(threadId && { thread: threadId }),
      findings,
      config: {
        rulesEnabled: findings.rules.map(r => r.id).sort(),
        failOn: [...(config.report?.failOn ?? ["error"])].sort()
      },
      ...(auditThreads.length > 0 && { threads: auditThreads })
    }

    // 3. Write checkpoint file
    const checkpointsDir = path.join(outputDir, "checkpoints")
    yield* fs.makeDirectory(checkpointsDir, { recursive: true })

    const checkpointPath = path.join(checkpointsDir, `${checkpointId}.json`)
    
    // Encode with schema validation
    const encodeCheckpoint = Schema.encodeSync(AuditCheckpoint)
    const checkpointJson = encodeCheckpoint(checkpoint as any)
    
    yield* fs.writeFileString(checkpointPath, JSON.stringify(checkpointJson, null, 2)).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new CheckpointWriteError({
            reason: `Failed to write checkpoint: ${error}`
          })
        )
      )
    )

    yield* Console.log(`✓ Wrote checkpoint to ${checkpointPath}`)

    // 4. Update manifest.json
    const manifest = yield* readManifest(checkpointsDir).pipe(
      Effect.catchTag("ManifestReadError", () =>
        Effect.succeed({
          schemaVersion: SCHEMA_VERSION,
          projectRoot: ".",
          checkpoints: []
        })
      )
    )

    // Compute delta from previous checkpoint
    const previousSummary = manifest.checkpoints[0]?.summary
    const currentSummary = findings.summary
    const delta = previousSummary ? computeDelta(previousSummary, currentSummary) : undefined

    const metadata: CheckpointMetadata = {
      id: checkpointId,
      timestamp: now,
      path: `./${checkpointId}.json`,
      ...(threadId && { thread: threadId }),
      schemaVersion: SCHEMA_VERSION,
      toolVersion,
      summary: currentSummary,
      ...(delta && { delta })
    }

    const updatedManifest = {
      ...manifest,
      checkpoints: [metadata, ...manifest.checkpoints] // Newest first
    }

    const manifestPath = path.join(checkpointsDir, "manifest.json")
    const encodeManifest = Schema.encodeSync(CheckpointManifest)
    const manifestJson = encodeManifest(updatedManifest as any)
    
    yield* fs.writeFileString(manifestPath, JSON.stringify(manifestJson, null, 2)).pipe(
      Effect.catchAll((error) =>
        Effect.fail(new CheckpointWriteError({ reason: `Failed to update manifest: ${error}` }))
      )
    )

    yield* Console.log(`✓ Updated manifest with ${updatedManifest.checkpoints.length} checkpoints`)

    // 5. Update audit.json symlink (latest checkpoint)
    const auditPath = path.join(outputDir, "audit.json")
    yield* updateLatestSymlink(auditPath, checkpointPath)

    yield* Console.log(`✓ Updated audit.json -> ${checkpointId}.json`)

    return metadata
  })

/**
 * Update audit.json to point to latest checkpoint.
 *
 * Uses symlink on Unix, file copy on Windows.
 */
const updateLatestSymlink = (
  auditPath: string,
  checkpointPath: string
): Effect.Effect<void, CheckpointWriteError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Remove existing audit.json if it exists
    const exists = yield* fs.exists(auditPath)
    if (exists) {
      yield* fs.remove(auditPath, { recursive: false }).pipe(
        Effect.catchAll(() => Effect.void)
      )
    }

    // Check if platform supports symlinks
    const isWindows = process.platform === "win32"

    if (isWindows) {
      // Copy file on Windows
      const content = yield* fs.readFileString(checkpointPath).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new CheckpointWriteError({ reason: `Failed to read checkpoint: ${error}` }))
        )
      )
      yield* fs.writeFileString(auditPath, content).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new CheckpointWriteError({ reason: `Failed to copy audit.json: ${error}` }))
        )
      )
    } else {
      // Symlink on Unix
      const relativePath = path.relative(path.dirname(auditPath), checkpointPath)
      yield* Effect.promise(() => 
        import("node:fs/promises").then((fs) => fs.symlink(relativePath, auditPath))
      ).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new CheckpointWriteError({ reason: `Failed to create symlink: ${error}` }))
        )
      )
    }
  })

// ============================================================================
// Checkpoint Reading
// ============================================================================

/**
 * Read checkpoint manifest.
 */
export const readManifest = (
  checkpointsDir: string
): Effect.Effect<CheckpointManifest, ManifestReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const manifestPath = path.join(checkpointsDir, "manifest.json")

    const content = yield* fs.readFileString(manifestPath).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ManifestReadError({
            path: manifestPath,
            reason: `Failed to read manifest: ${error}`
          })
        )
      )
    )

    const decoded = yield* Schema.decodeUnknown(CheckpointManifest)(JSON.parse(content)).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ManifestReadError({
            path: manifestPath,
            reason: `Invalid manifest schema: ${error}`
          })
        )
      )
    )

    return decoded
  })

/**
 * List checkpoint summaries (newest first).
 */
export const listCheckpoints = (
  outputDir: string,
  limit?: number
): Effect.Effect<
  readonly CheckpointSummary[],
  ManifestReadError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    const checkpointsDir = path.join(outputDir, "checkpoints")

    const manifest = yield* readManifest(checkpointsDir)

    const checkpoints = manifest.checkpoints.slice(0, limit)
    
    return checkpoints.map(meta => ({
      id: meta.id,
      timestamp: DateTime.formatIso(meta.timestamp),
      ...(meta.thread && { thread: meta.thread }),
      summary: meta.summary,
      ...(meta.delta && { delta: meta.delta })
    }))
  })

/**
 * Get latest checkpoint metadata.
 */
export const getLatestCheckpoint = (
  outputDir: string
): Effect.Effect<
  Option.Option<CheckpointMetadata>,
  ManifestReadError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    const checkpointsDir = path.join(outputDir, "checkpoints")

    const manifest = yield* readManifest(checkpointsDir)

    return manifest.checkpoints.length > 0
      ? Option.some(manifest.checkpoints[0])
      : Option.none()
  })

/**
 * Read a specific checkpoint by ID.
 */
export const readCheckpoint = (
  outputDir: string,
  checkpointId: string
): Effect.Effect<
  AuditCheckpoint,
  CheckpointNotFoundError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const checkpointPath = path.join(outputDir, "checkpoints", `${checkpointId}.json`)

    const content = yield* fs.readFileString(checkpointPath).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new CheckpointNotFoundError({
            checkpointId,
            message: `Checkpoint not found: ${error}`
          })
        )
      )
    )

    const decoded = yield* Schema.decodeUnknown(AuditCheckpoint)(JSON.parse(content)).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new CheckpointNotFoundError({
            checkpointId,
            message: `Invalid checkpoint format: ${error}`
          })
        )
      )
    )

    return decoded
  })

/**
 * Compare two checkpoints and return delta.
 */
export const diffCheckpoints = (
  outputDir: string,
  fromId: string,
  toId: string
) =>
  Effect.gen(function* () {
    const from = yield* readCheckpoint(outputDir, fromId)
    const to = yield* readCheckpoint(outputDir, toId)

    const delta = computeDelta(from.findings.summary, to.findings.summary)

    return {
      from: {
        id: from.checkpointId,
        timestamp: from.timestamp,
        summary: from.findings.summary
      },
      to: {
        id: to.checkpointId,
        timestamp: to.timestamp,
        summary: to.findings.summary
      },
      delta
    }
  })
```

### Phase 2: Integrate Checkpoint Creation into Context Writer (30 min)

**File:** `packages/core/src/amp/context-writer.ts`

Modify the existing `writeAmpContext` to create checkpoints:

```diff
export const writeAmpContext = (outputDir: string, results: RuleResult[], config: Config) =>
  Effect.gen(function* () {
    // ... existing code for normalization and thread detection ...
    
    const findings = normalizeResults(normalizedInput)
+   
+   // Create checkpoint AFTER we have revision and findings
+   const checkpointMeta = yield* createCheckpoint(
+     outputDir,
+     findings,
+     config,
+     revision
+   ).pipe(
+     Effect.catchAll((error) =>
+       Console.warn(`Failed to create checkpoint: ${String(error)}`).pipe(
+         Effect.map(() => undefined)
+       )
+     )
+   )

    // Create audit context (existing logic)
    // ...
    
+   // Update index.json with checkpoint info
+   const recentCheckpoints = yield* listCheckpoints(outputDir, 10).pipe(
+     Effect.catchAll(() => Effect.succeed([]))
+   )
    
    const index: AmpContextIndexType = {
      schemaVersion: SCHEMA_VERSION,
      toolVersion,
      projectRoot: ".",
      timestamp,
+     ...(checkpointMeta && { latestCheckpoint: checkpointMeta.id }),
+     ...(recentCheckpoints.length > 0 && { checkpoints: recentCheckpoints }),
      files: {
        audit: "audit.json",
+       ...(checkpointMeta && { 
+         checkpoints: "./checkpoints",
+         manifest: "./checkpoints/manifest.json"
+       }),
        metrics: "metrics.json",
        badges: "badges.md",
        ...(auditThreads.length > 0 && { threads: "threads.json" })
      }
    }
    
    // ... rest of existing code
  })
```

### Phase 3: CLI Commands (1-2 hours)

**File:** `packages/cli/src/commands/checkpoints.ts`

(See attached plan for full implementation - uses cli-table3 for formatting)

**Register in main CLI:**

```diff
// packages/cli/src/index.ts
+ import { checkpointsCommand } from "./commands/checkpoints.js"

  const cli = Command.make("effect-migrate").pipe(
    Command.withSubcommands([
      auditCommand,
      metricsCommand,
      docsCommand,
      initCommand,
      threadCommand,
+     checkpointsCommand
    ])
  )
```

---

## Testing

### Unit Tests

**File:** `packages/core/test/amp/checkpoint-manager.test.ts`

```typescript
import { describe, it, expect } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import {
  generateCheckpointId,
  detectThreadId,
  computeDelta
} from "../../src/amp/checkpoint-manager.js"

describe("CheckpointManager", () => {
  describe("generateCheckpointId", () => {
    it("should generate filesystem-safe ID", () => {
      const dt = DateTime.unsafeMake(new Date("2025-11-08T14:30:00.000Z").getTime())
      const id = generateCheckpointId(dt)
      expect(id).toBe("2025-11-08T14-30-00Z")
    })
  })

  describe("detectThreadId", () => {
    it("should detect AMP_CURRENT_THREAD_ID from environment", () => {
      const saved = process.env.AMP_CURRENT_THREAD_ID
      process.env.AMP_CURRENT_THREAD_ID = "T-test-123"
      const threadId = detectThreadId()
      expect(threadId).toBe("T-test-123")
      if (saved) process.env.AMP_CURRENT_THREAD_ID = saved
      else delete process.env.AMP_CURRENT_THREAD_ID
    })

    it("should return undefined when not set", () => {
      const saved = process.env.AMP_CURRENT_THREAD_ID
      delete process.env.AMP_CURRENT_THREAD_ID
      const threadId = detectThreadId()
      expect(threadId).toBeUndefined()
      if (saved) process.env.AMP_CURRENT_THREAD_ID = saved
    })
  })

  describe("computeDelta", () => {
    it("should compute positive delta when findings increase", () => {
      const previous = { errors: 10, warnings: 20, info: 5, totalFiles: 5, totalFindings: 35 }
      const current = { errors: 15, warnings: 25, info: 8, totalFiles: 5, totalFindings: 48 }

      const delta = computeDelta(previous, current)

      expect(delta.errors).toBe(5)
      expect(delta.warnings).toBe(5)
      expect(delta.info).toBe(3)
      expect(delta.totalFindings).toBe(13)
    })

    it("should compute negative delta when findings decrease", () => {
      const previous = { errors: 15, warnings: 25, info: 8, totalFiles: 5, totalFindings: 48 }
      const current = { errors: 10, warnings: 20, info: 5, totalFiles: 5, totalFindings: 35 }

      const delta = computeDelta(previous, current)

      expect(delta.errors).toBe(-5)
      expect(delta.warnings).toBe(-5)
      expect(delta.info).toBe(-3)
      expect(delta.totalFindings).toBe(-13)
    })
  })
})
```

### Manual Testing

```bash
# Session 1 (in Amp thread T-abc123)
export AMP_CURRENT_THREAD_ID=T-abc123-uuid
pnpm cli audit --amp-out .amp/effect-migrate

# Verify checkpoint created
cat .amp/effect-migrate/index.json | jq '.latestCheckpoint'
cat .amp/effect-migrate/checkpoints/manifest.json | jq '.checkpoints[0]'

# Make some fixes to code

# Session 2 (in Amp thread T-def456)
export AMP_CURRENT_THREAD_ID=T-def456-uuid
pnpm cli audit --amp-out .amp/effect-migrate

# Verify delta calculated
pnpm cli checkpoints list
# Should show 2 checkpoints with delta

# Compare checkpoints
pnpm cli checkpoints diff <first-id> <second-id>
# Should show improvement
```

---

## Success Criteria

### Functional Requirements

- [ ] Checkpoints written to `.amp/effect-migrate/checkpoints/` directory
- [ ] Each checkpoint has unique ID (ISO timestamp, filesystem-safe)
- [ ] `manifest.json` tracks all checkpoints with metadata
- [ ] `audit.json` points to latest checkpoint (symlink on Unix, copy on Windows)
- [ ] `index.json` includes `latestCheckpoint` and recent history (last 10)
- [ ] `AMP_CURRENT_THREAD_ID` auto-detected and linked to checkpoint
- [ ] Delta computed between consecutive checkpoints
- [ ] CLI commands work: `list`, `latest`, `show`, `diff`

### Performance Requirements

- [ ] Checkpoint creation adds <100ms to audit runtime (10k findings)
- [ ] Checkpoint files use FindingsGroup schema (40-70% size reduction)
- [ ] Manifest reads <50ms for 100 checkpoints

### Developer Experience

- [ ] Clear console output on checkpoint creation
- [ ] Delta displayed in human-readable format
- [ ] Thread ID shown when linked
- [ ] CLI commands have helpful error messages

### Testing

- [ ] Unit tests pass for all checkpoint functions
- [ ] Integration tests pass for CLI commands
- [ ] Manual multi-session workflow verified
- [ ] Cross-platform tested (Unix symlink, Windows copy)

---

## Files Summary

**New files:**

- `packages/core/src/amp/checkpoint-manager.ts` (~400 LOC)
- `packages/cli/src/commands/checkpoints.ts` (~320 LOC)
- `packages/core/test/amp/checkpoint-manager.test.ts` (~100 LOC)
- `packages/cli/test/commands/checkpoints.test.ts` (~150 LOC)

**Modified files:**

- `packages/core/src/schema/amp.ts` (add checkpoint schemas ~100 LOC)
- `packages/core/src/amp/context-writer.ts` (integrate checkpoints ~30 LOC)
- `packages/core/src/index.ts` (export checkpoint functions ~10 LOC)
- `packages/cli/src/index.ts` (register checkpoints command ~2 LOC)

**Total effort:** 4-6 hours coding + 1-2 hours testing

---

## Key Differences from Original Plan

1. ✅ **Environment variable**: `AMP_CURRENT_THREAD_ID` (not `AMP_THREAD_ID`)
2. ✅ **Schema type**: `FindingsGroup` (not `NormalizedFindings`)
3. ✅ **Versioning**: Single `SCHEMA_VERSION` constant (not `SCHEMA_VERSIONS` object)
4. ✅ **Summary includes `info`**: `FindingsSummary` has errors, warnings, info, totalFiles, totalFindings
5. ✅ **Thread auto-detection**: Already implemented in context-writer.ts
6. ✅ **Revision tracking**: Already incremented in context-writer.ts
7. ✅ **Schema exports**: Use existing schema classes from amp.ts

---

**Last Updated:** 2025-11-08  
**Maintainer:** @aridyckovsky  
**Status:** Ready for implementation (revised based on PR1/PR2 actuals)  
**Thread:** https://ampcode.com/threads/T-5bd34c50-9752-4d71-8768-e8290de2c380
