---
created: 2025-11-06
lastUpdated: 2025-11-06
author: Generated via Amp (Oracle + Librarian analysis)
status: ready
thread: https://ampcode.com/threads/T-5bd34c50-9752-4d71-8768-e8290de2c380
audience: Development team and AI coding agents
tags: [pr-plan, checkpoints, persistence, wave1, time-series, delta-computation]
related:
  - ./pr1-version-registry.md
  - ./pr2-normalized-schema.md
  - ./checkpoint-based-audit-persistence.md
  - ./comprehensive-data-architecture.md
  - ../concepts/amp-integration.md
---

# PR3: JSON Checkpoints Implementation Plan

## Goal

Implement time-series checkpoint persistence with thread linking and delta computation for tracking migration progress over time.

**Estimated Effort:** 4-6 hours coding + 1-2 hours testing

**Dependencies:**
- PR1: Version Registry (schema versioning infrastructure)
- PR2: Normalized Schema (efficient data structure)

---

## Overview

This PR implements the JSON checkpoint system from the comprehensive data architecture, enabling:

1. **Historical tracking**: Preserve audit snapshots instead of overwriting
2. **Progress monitoring**: Calculate deltas between consecutive audits
3. **Thread association**: Auto-link checkpoints to Amp threads via `AMP_THREAD_ID`
4. **Agent navigation**: Provide O(1) access to latest audit via symlink and index

**Key Principle:** Use normalized schema from PR2 for efficient storage (50-70% size reduction).

---

## Implementation Order

### Phase 1: Checkpoint Manager Module (2-3 hours)

Create core checkpoint persistence logic with Effect-TS patterns.

#### File: packages/cli/src/amp/checkpoint-manager.ts

**Purpose:** Checkpoint creation, listing, reading, and delta computation.

**Code:**

```typescript
/**
 * Checkpoint Manager - Time-series audit persistence.
 *
 * @module @effect-migrate/cli/amp/checkpoint-manager
 * @since 0.3.0
 */

import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Clock from "effect/Clock"
import * as Console from "effect/Console"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Array from "effect/Array"
import * as Data from "effect/Data"
import { SCHEMA_VERSIONS } from "@effect-migrate/core"
import type { RuleResult, Config } from "@effect-migrate/core"
import { normalizeResults, type NormalizedFindings } from "./schema.js"

// ============================================================================
// Schemas
// ============================================================================

/**
 * Checkpoint summary for index navigation.
 */
export const CheckpointSummary = Schema.Struct({
  /** ISO timestamp (e.g., "2025-11-06T10:00:00Z") */
  timestamp: Schema.String,

  /** Amp thread ID if audit was run during a thread */
  thread: Schema.optional(Schema.String),

  /** Findings summary */
  summary: Schema.Struct({
    errors: Schema.Number,
    warnings: Schema.Number,
    totalFiles: Schema.Number,
    totalFindings: Schema.Number
  }),

  /** Delta from previous checkpoint (positive = more, negative = fixed) */
  delta: Schema.optional(
    Schema.Struct({
      errors: Schema.Number,
      warnings: Schema.Number,
      totalFindings: Schema.Number
    })
  )
})

export type CheckpointSummary = Schema.Schema.Type<typeof CheckpointSummary>

/**
 * Checkpoint metadata in manifest.
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
  summary: Schema.Struct({
    errors: Schema.Number,
    warnings: Schema.Number,
    totalFiles: Schema.Number,
    totalFindings: Schema.Number
  }),

  /** Delta from previous */
  delta: Schema.optional(
    Schema.Struct({
      errors: Schema.Number,
      warnings: Schema.Number,
      totalFindings: Schema.Number
    })
  ),

  /** User description (optional) */
  description: Schema.optional(Schema.String),

  /** Tags (optional) */
  tags: Schema.optional(Schema.Array(Schema.String))
})

export type CheckpointMetadata = Schema.Schema.Type<typeof CheckpointMetadata>

/**
 * Checkpoint manifest (complete history).
 */
export const CheckpointManifest = Schema.Struct({
  /** Manifest schema version */
  schemaVersion: Schema.String,

  /** Project root */
  projectRoot: Schema.String,

  /** All checkpoints (newest first) */
  checkpoints: Schema.Array(CheckpointMetadata)
})

export type CheckpointManifest = Schema.Schema.Type<typeof CheckpointManifest>

/**
 * Individual checkpoint file (full audit snapshot).
 */
export const AuditCheckpoint = Schema.Struct({
  /** Audit format version */
  schemaVersion: Schema.String,

  /** Checkpoint revision number */
  revision: Schema.Number,

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

  /** Normalized findings (from PR2) - always present, never null */
  normalized: Schema.Unknown, // Will use NormalizedFindings from schema.ts

  /** Config snapshot */
  config: Schema.Struct({
    rulesEnabled: Schema.Array(Schema.String),
    failOn: Schema.Array(Schema.String)
  })
})

export type AuditCheckpoint = Schema.Schema.Type<typeof AuditCheckpoint>

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
 * Format: "2025-11-06T10-00-00Z" (filesystem-safe).
 */
export const generateCheckpointId = (timestamp: DateTime.DateTime): string => {
  const iso = DateTime.formatIso(timestamp)
  return iso.replace(/:/g, "-").replace(/\.\d{3}/, "")
}

/**
 * Detect Amp thread ID from environment.
 *
 * Amp sets AMP_THREAD_ID when running commands during a thread.
 */
export const detectThreadId = (): string | undefined => {
  return process.env.AMP_THREAD_ID
}

/**
 * Compute delta between two summaries.
 */
export const computeDelta = (
  previous: CheckpointSummary["summary"],
  current: CheckpointSummary["summary"]
): CheckpointSummary["delta"] => ({
  errors: current.errors - previous.errors,
  warnings: current.warnings - previous.warnings,
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
 * 4. Update index.json with latest checkpoint
 * 5. Update audit.json symlink (or copy on Windows)
 */
export const createCheckpoint = (
  outputDir: string,
  projectRoot: string,
  normalized: NormalizedFindings,
  config: Config
): Effect.Effect<
  CheckpointMetadata,
  CheckpointWriteError | ManifestReadError,
  FileSystem.FileSystem | Path.Path | Clock.Clock
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const clock = yield* Clock.Clock

    // 1. Generate checkpoint ID
    const now = yield* Clock.currentTimeMillis.pipe(
      Effect.map((millis) => DateTime.unsafeFromMillis(millis))
    )
    const checkpointId = generateCheckpointId(now)

    yield* Console.log(`Creating checkpoint: ${checkpointId}`)

    // 2. Build checkpoint object
    const toolVersion = SCHEMA_VERSIONS.TOOL_VERSION
    const threadId = detectThreadId()

    const checkpoint: AuditCheckpoint = {
      schemaVersion: SCHEMA_VERSIONS.AUDIT,
      revision: SCHEMA_VERSIONS.REVISION,
      checkpointId,
      toolVersion,
      projectRoot,
      timestamp: now,
      thread: threadId,
      normalized: normalized as any, // Cast to unknown for now
      config: {
        rulesEnabled: config.patterns?.map((r) => r.id) ?? [],
        failOn: ["error"] // From config.failOn
      }
    }

    // 3. Write checkpoint file
    const checkpointsDir = path.join(outputDir, "checkpoints")
    yield* fs.makeDirectory(checkpointsDir, { recursive: true })

    const checkpointPath = path.join(checkpointsDir, `${checkpointId}.json`)
    const checkpointJson = JSON.stringify(checkpoint, null, 2)
    yield* fs.writeFileString(checkpointPath, checkpointJson).pipe(
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
          schemaVersion: "1.0.0",
          projectRoot,
          checkpoints: []
        })
      )
    )

    // Compute delta from previous checkpoint
    const previousSummary = manifest.checkpoints[0]?.summary
    const currentSummary = normalized.summary
    const delta = previousSummary ? computeDelta(previousSummary, currentSummary) : undefined

    const metadata: CheckpointMetadata = {
      id: checkpointId,
      timestamp: now,
      path: `./${checkpointId}.json`,
      thread: threadId,
      schemaVersion: SCHEMA_VERSIONS.AUDIT,
      toolVersion,
      summary: currentSummary,
      delta
    }

    const updatedManifest: CheckpointManifest = {
      ...manifest,
      checkpoints: [metadata, ...manifest.checkpoints] // Newest first
    }

    const manifestPath = path.join(checkpointsDir, "manifest.json")
    yield* fs.writeFileString(manifestPath, JSON.stringify(updatedManifest, null, 2)).pipe(
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
        Effect.catchAll(() => Effect.void) // Ignore errors
      )
    }

    // Check if platform supports symlinks (Unix-like)
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
          Effect.fail(
            new CheckpointWriteError({ reason: `Failed to copy audit.json: ${error}` })
          )
        )
      )
    } else {
      // Symlink on Unix
      const relativePath = path.relative(path.dirname(auditPath), checkpointPath)
      yield* Effect.promise(() => import("node:fs/promises").then((fs) => fs.symlink(relativePath, auditPath))).pipe(
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

    const summaries: CheckpointSummary[] = manifest.checkpoints.map((meta) => ({
      timestamp: DateTime.formatIso(meta.timestamp),
      thread: meta.thread,
      summary: meta.summary,
      delta: meta.delta
    }))

    return limit ? summaries.slice(0, limit) : summaries
  })

/**
 * Get latest checkpoint summary.
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

    const manifest = yield* readManifest(checkpointsDir).pipe(
      Effect.catchTag("ManifestReadError", () =>
        Effect.succeed({ schemaVersion: "1.0.0", projectRoot: ".", checkpoints: [] })
      )
    )

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
): Effect.Effect<AuditCheckpoint, CheckpointNotFoundError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const checkpointPath = path.join(outputDir, "checkpoints", `${checkpointId}.json`)

    const exists = yield* fs.exists(checkpointPath)
    if (!exists) {
      return yield* Effect.fail(
        new CheckpointNotFoundError({
          checkpointId,
          message: `Checkpoint not found: ${checkpointId}`
        })
      )
    }

    const content = yield* fs.readFileString(checkpointPath).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new CheckpointNotFoundError({
            checkpointId,
            message: `Failed to read checkpoint: ${error}`
          })
        )
      )
    )

    const decoded = yield* Schema.decodeUnknown(AuditCheckpoint)(JSON.parse(content)).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new CheckpointNotFoundError({
            checkpointId,
            message: `Invalid checkpoint schema: ${error}`
          })
        )
      )
    )

    return decoded
  })

/**
 * Compute diff between two checkpoints.
 */
export const diffCheckpoints = (
  outputDir: string,
  fromId: string,
  toId: string
): Effect.Effect<
  {
    from: CheckpointSummary
    to: CheckpointSummary
    delta: CheckpointSummary["delta"]
  },
  CheckpointNotFoundError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fromCheckpoint = yield* readCheckpoint(outputDir, fromId)
    const toCheckpoint = yield* readCheckpoint(outputDir, toId)

    const fromSummary: CheckpointSummary = {
      timestamp: DateTime.formatIso(fromCheckpoint.timestamp),
      thread: fromCheckpoint.thread,
      summary: (fromCheckpoint.findings as any).summary
    }

    const toSummary: CheckpointSummary = {
      timestamp: DateTime.formatIso(toCheckpoint.timestamp),
      thread: toCheckpoint.thread,
      summary: (toCheckpoint.findings as any).summary
    }

    const delta = computeDelta(fromSummary.summary, toSummary.summary)

    return {
      from: fromSummary,
      to: toSummary,
      delta
    }
  })
```

---

### Phase 2: Integrate with Audit Command (1 hour)

Update the `audit` command to use checkpoint manager instead of overwriting `audit.json`.

#### File: packages/cli/src/commands/audit.ts (modifications)

**Changes:**

```diff
  import { formatAuditResults } from "../formatters/audit-formatter.js"
  import { writeAmpContext } from "../amp/context-writer.js"
+ import { createCheckpoint } from "../amp/checkpoint-manager.js"

  const auditCommand = Command.make("audit", {
    ampOut: Options.directory("amp-out").pipe(Options.optional),
    json: Options.boolean("json").pipe(Options.optional)
  }, (opts) =>
    Effect.gen(function* () {
      const config = yield* loadConfig()
      const results = yield* runAudit(config)

      // Console output
      if (opts.json) {
        yield* Console.log(JSON.stringify(results, null, 2))
      } else {
        yield* formatAuditResults(results, config)
      }

      // Amp context output
      if (opts.ampOut) {
-       yield* writeAmpContext(opts.ampOut, results, config)
+       // Create checkpoint instead of overwriting audit.json
+       const normalized = normalizeResults(results)
+       const metadata = yield* createCheckpoint(
+         opts.ampOut,
+         ".", // projectRoot
+         normalized,
+         config
+       )
+
+       yield* Console.log(``)
+       yield* Console.log(`Checkpoint created: ${metadata.id}`)
+       if (metadata.thread) {
+         yield* Console.log(`  Linked to thread: ${metadata.thread}`)
+       }
+       if (metadata.delta) {
+         const { errors, warnings, totalFindings } = metadata.delta
+         const errSign = errors >= 0 ? "+" : ""
+         const warnSign = warnings >= 0 ? "+" : ""
+         yield* Console.log(
+           `  Delta: ${errSign}${errors} errors, ${warnSign}${warnings} warnings`
+         )
+       }
      }
    })
  )
```

**Note:** The `writeAmpContext` function from the old implementation will be deprecated in favor of checkpoint-based persistence.

---

### Phase 3: Checkpoints CLI Subcommand (1-2 hours)

Add CLI commands for viewing and managing checkpoints.

#### File: packages/cli/src/commands/checkpoints.ts

**Purpose:** User-facing commands for checkpoint history.

**Code:**

```typescript
/**
 * Checkpoints CLI subcommand.
 *
 * @module @effect-migrate/cli/commands/checkpoints
 * @since 0.3.0
 */

import * as Command from "@effect/cli/Command"
import * as Args from "@effect/cli/Args"
import * as Options from "@effect/cli/Options"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import * as DateTime from "effect/DateTime"
import {
  listCheckpoints,
  getLatestCheckpoint,
  readCheckpoint,
  diffCheckpoints,
  type CheckpointSummary
} from "../amp/checkpoint-manager.js"

const ampOutOption = Options.directory("amp-out").pipe(
  Options.withDefault(".amp/effect-migrate")
)

/**
 * List all checkpoints.
 */
const listCommand = Command.make(
  "list",
  { ampOut: ampOutOption },
  (opts) =>
    Effect.gen(function* () {
      const checkpoints = yield* listCheckpoints(opts.ampOut, 50) // Last 50

      if (checkpoints.length === 0) {
        yield* Console.log("No checkpoints found.")
        return
      }

      // Table header
      yield* Console.log(``)
      yield* Console.log(`Recent Checkpoints (last ${checkpoints.length}):`)
      yield* Console.log(``)
      yield* Console.log(
        `┌─────────────────────────┬────────────┬────────┬──────────┬────────┬───────────────┐`
      )
      yield* Console.log(
        `│ Timestamp               │ Thread     │ Errors │ Warnings │ Total  │ Delta         │`
      )
      yield* Console.log(
        `├─────────────────────────┼────────────┼────────┼──────────┼────────┼───────────────┤`
      )

      for (const cp of checkpoints) {
        const threadCol = cp.thread?.padEnd(10) ?? "-".padEnd(10)
        const errorsCol = cp.summary.errors.toString().padStart(6)
        const warningsCol = cp.summary.warnings.toString().padStart(8)
        const totalCol = cp.summary.totalFindings.toString().padStart(6)
        const deltaCol = cp.delta
          ? `${cp.delta.errors >= 0 ? "+" : ""}${cp.delta.errors} / ${cp.delta.warnings >= 0 ? "+" : ""}${cp.delta.warnings}`.padEnd(
              13
            )
          : "-".padEnd(13)

        yield* Console.log(
          `│ ${cp.timestamp} │ ${threadCol} │ ${errorsCol} │ ${warningsCol} │ ${totalCol} │ ${deltaCol} │`
        )
      }

      yield* Console.log(
        `└─────────────────────────┴────────────┴────────┴──────────┴────────┴───────────────┘`
      )
      yield* Console.log(``)
    })
)

/**
 * Show latest checkpoint.
 */
const latestCommand = Command.make("latest", { ampOut: ampOutOption }, (opts) =>
  Effect.gen(function* () {
    const latest = yield* getLatestCheckpoint(opts.ampOut)

    if (latest._tag === "None") {
      yield* Console.log("No checkpoints found.")
      return
    }

    const meta = latest.value
    yield* Console.log(`Latest checkpoint: ${meta.id}`)
    yield* Console.log(`  Timestamp: ${DateTime.formatIso(meta.timestamp)}`)
    if (meta.thread) {
      yield* Console.log(`  Thread: ${meta.thread}`)
    }
    yield* Console.log(`  Errors: ${meta.summary.errors}`)
    yield* Console.log(`  Warnings: ${meta.summary.warnings}`)
    yield* Console.log(`  Total findings: ${meta.summary.totalFindings}`)

    if (meta.delta) {
      const errSign = meta.delta.errors >= 0 ? "+" : ""
      const warnSign = meta.delta.warnings >= 0 ? "+" : ""
      yield* Console.log(
        `  Delta: ${errSign}${meta.delta.errors} errors, ${warnSign}${meta.delta.warnings} warnings`
      )
    }
  })
)

/**
 * Show specific checkpoint.
 */
const showCommand = Command.make(
  "show",
  {
    ampOut: ampOutOption,
    checkpoint: Args.text({ name: "checkpoint-id" })
  },
  (opts) =>
    Effect.gen(function* () {
      const checkpoint = yield* readCheckpoint(opts.ampOut, opts.checkpoint)
      yield* Console.log(JSON.stringify(checkpoint, null, 2))
    })
)

/**
 * Compare two checkpoints.
 */
const diffCommand = Command.make(
  "diff",
  {
    ampOut: ampOutOption,
    from: Args.text({ name: "from-checkpoint-id" }),
    to: Args.text({ name: "to-checkpoint-id" }).pipe(Args.optional)
  },
  (opts) =>
    Effect.gen(function* () {
      const toId = opts.to
        ? opts.to
        : yield* getLatestCheckpoint(opts.ampOut).pipe(
            Effect.flatMap((latest) =>
              latest._tag === "Some"
                ? Effect.succeed(latest.value.id)
                : Effect.fail(new Error("No latest checkpoint"))
            )
          )

      const result = yield* diffCheckpoints(opts.ampOut, opts.from, toId)

      yield* Console.log(`Comparing checkpoints:`)
      yield* Console.log(`  From: ${result.from.timestamp}`)
      yield* Console.log(`  To:   ${result.to.timestamp}`)
      yield* Console.log(``)
      yield* Console.log(
        `Errors:   ${result.from.summary.errors} → ${result.to.summary.errors} (${result.delta!.errors >= 0 ? "+" : ""}${result.delta!.errors})`
      )
      yield* Console.log(
        `Warnings: ${result.from.summary.warnings} → ${result.to.summary.warnings} (${result.delta!.warnings >= 0 ? "+" : ""}${result.delta!.warnings})`
      )
      yield* Console.log(
        `Total:    ${result.from.summary.totalFindings} → ${result.to.summary.totalFindings} (${result.delta!.totalFindings >= 0 ? "+" : ""}${result.delta!.totalFindings})`
      )
    })
)

/**
 * Checkpoints subcommand with list, latest, show, diff.
 */
export const checkpointsCommand = Command.make("checkpoints").pipe(
  Command.withSubcommands([listCommand, latestCommand, showCommand, diffCommand])
)
```

#### Register in Main CLI

**File: packages/cli/src/index.ts**

```diff
  import { auditCommand } from "./commands/audit.js"
  import { metricsCommand } from "./commands/metrics.js"
  import { docsCommand } from "./commands/docs.js"
  import { initCommand } from "./commands/init.js"
+ import { checkpointsCommand } from "./commands/checkpoints.js"

  const cli = Command.make("effect-migrate").pipe(
    Command.withSubcommands([
      auditCommand,
      metricsCommand,
      docsCommand,
-     initCommand
+     initCommand,
+     checkpointsCommand
    ])
  )
```

---

### Phase 4: Update index.json with Checkpoint History (30 min)

Modify `index.json` to include recent checkpoint history for agent navigation.

#### File: packages/cli/src/amp/index-writer.ts (modifications)

**Update schema:**

```diff
  export const AmpContextIndex = Schema.Struct({
    schemaVersion: Schema.String,
    versions: Schema.Struct({
      audit: Schema.String,
+     checkpoints: Schema.String,
      metrics: Schema.optional(Schema.String),
      threads: Schema.optional(Schema.String)
    }),
    toolVersion: Schema.String,
    projectRoot: Schema.String,
    timestamp: Schema.DateTimeUtc,
+   latestCheckpoint: Schema.String,
+   checkpoints: Schema.Array(CheckpointSummary),
    files: Schema.Struct({
      audit: Schema.String,
+     checkpoints: Schema.String,
+     manifest: Schema.String,
      metrics: Schema.optional(Schema.String),
      threads: Schema.optional(Schema.String),
      badges: Schema.optional(Schema.String)
    })
  })
```

**Update index writer:**

```typescript
export const writeIndex = (
  outputDir: string,
  latestCheckpointId: string
): Effect.Effect<void, IndexWriteError, FileSystem.FileSystem | Path.Path | Clock.Clock> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Get recent checkpoints (last 10)
    const checkpoints = yield* listCheckpoints(outputDir, 10).pipe(
      Effect.catchAll(() => Effect.succeed([]))
    )

    const index: AmpContextIndex = {
      schemaVersion: "1.2.0",
      versions: {
        audit: SCHEMA_VERSIONS.AUDIT,
        checkpoints: "1.0.0",
        metrics: "0.1.0",
        threads: "1.0.0"
      },
      toolVersion: SCHEMA_VERSIONS.TOOL_VERSION,
      projectRoot: ".",
      timestamp: yield* Clock.currentTimeMillis.pipe(
        Effect.map((millis) => DateTime.unsafeFromMillis(millis))
      ),
      latestCheckpoint: latestCheckpointId,
      checkpoints,
      files: {
        audit: "./audit.json",
        checkpoints: "./checkpoints",
        manifest: "./checkpoints/manifest.json",
        metrics: "./metrics.json",
        threads: "./threads.json",
        badges: "./badges.md"
      }
    }

    const indexPath = path.join(outputDir, "index.json")
    yield* fs.writeFileString(indexPath, JSON.stringify(index, null, 2)).pipe(
      Effect.catchAll((error) =>
        Effect.fail(new IndexWriteError({ reason: `Failed to write index: ${error}` }))
      )
    )
  })
```

---

## Integration

### With PR1 (Version Registry)

- Use `SCHEMA_VERSIONS.AUDIT` for checkpoint schema version
- Use `SCHEMA_VERSIONS.TOOL_VERSION` for tool version tracking
- Store schema version in each checkpoint for compatibility

### With PR2 (Normalized Schema)

- Use `NormalizedFindings` type for checkpoint data
- Leverage normalization for 50-70% size reduction
- Maintain backwards compatibility with old audit.json format

---

## Testing

### Unit Tests

**File: packages/cli/src/__tests__/checkpoint-manager.test.ts**

```typescript
import { describe, it, expect } from "@effect/vitest"
import { Effect, Option } from "effect"
import {
  generateCheckpointId,
  detectThreadId,
  computeDelta,
  createCheckpoint,
  listCheckpoints,
  getLatestCheckpoint,
  diffCheckpoints
} from "../amp/checkpoint-manager.js"
import * as DateTime from "effect/DateTime"

describe("CheckpointManager", () => {
  describe("generateCheckpointId", () => {
    it.effect("should generate filesystem-safe ID", () =>
      Effect.gen(function* () {
        const dt = DateTime.unsafeFromString("2025-11-06T14:30:00.000Z")
        const id = generateCheckpointId(dt)
        expect(id).toBe("2025-11-06T14-30-00Z")
      })
    )
  })

  describe("detectThreadId", () => {
    it.effect("should detect AMP_THREAD_ID from environment", () =>
      Effect.gen(function* () {
        process.env.AMP_THREAD_ID = "T-test-123"
        const threadId = detectThreadId()
        expect(threadId).toBe("T-test-123")
        delete process.env.AMP_THREAD_ID
      })
    )

    it.effect("should return undefined when not set", () =>
      Effect.gen(function* () {
        delete process.env.AMP_THREAD_ID
        const threadId = detectThreadId()
        expect(threadId).toBeUndefined()
      })
    )
  })

  describe("computeDelta", () => {
    it.effect("should compute positive delta when findings increase", () =>
      Effect.gen(function* () {
        const previous = { errors: 10, warnings: 20, totalFiles: 5, totalFindings: 30 }
        const current = { errors: 15, warnings: 25, totalFiles: 5, totalFindings: 40 }

        const delta = computeDelta(previous, current)

        expect(delta.errors).toBe(5)
        expect(delta.warnings).toBe(5)
        expect(delta.totalFindings).toBe(10)
      })
    )

    it.effect("should compute negative delta when findings decrease", () =>
      Effect.gen(function* () {
        const previous = { errors: 15, warnings: 25, totalFiles: 5, totalFindings: 40 }
        const current = { errors: 10, warnings: 20, totalFiles: 5, totalFindings: 30 }

        const delta = computeDelta(previous, current)

        expect(delta.errors).toBe(-5)
        expect(delta.warnings).toBe(-5)
        expect(delta.totalFindings).toBe(-10)
      })
    )
  })

  // Integration tests for createCheckpoint, listCheckpoints, etc.
  // Use temporary directory for file system operations
})
```

### Integration Tests

**File: packages/cli/src/__tests__/checkpoints-command.test.ts**

```typescript
import { describe, it, expect } from "@effect/vitest"
import { Effect } from "effect"
import { checkpointsCommand } from "../commands/checkpoints.js"
import { createCheckpoint } from "../amp/checkpoint-manager.js"

describe("Checkpoints Command", () => {
  it.effect("should list checkpoints", () =>
    Effect.gen(function* () {
      // Setup: Create test checkpoints
      // Execute: Run list command
      // Assert: Verify output contains checkpoints
    })
  )

  it.effect("should show latest checkpoint", () =>
    Effect.gen(function* () {
      // Setup: Create checkpoint
      // Execute: Run latest command
      // Assert: Verify latest is shown
    })
  )

  it.effect("should diff two checkpoints", () =>
    Effect.gen(function* () {
      // Setup: Create two checkpoints with different findings
      // Execute: Run diff command
      // Assert: Verify delta is correct
    })
  )
})
```

### Manual Testing

**Multi-session workflow:**

```bash
# Session 1 (in Amp thread T-abc123)
export AMP_THREAD_ID=T-abc123
pnpm effect-migrate audit --amp-out .amp/effect-migrate

# Verify checkpoint created
cat .amp/effect-migrate/index.json | jq '.latestCheckpoint'
cat .amp/effect-migrate/checkpoints/manifest.json | jq '.checkpoints[0]'

# Make some fixes to code (reduce errors)

# Session 2 (in Amp thread T-def456)
export AMP_THREAD_ID=T-def456
pnpm effect-migrate audit --amp-out .amp/effect-migrate

# Verify delta calculated
pnpm effect-migrate checkpoints list
# Should show 2 checkpoints with delta

# Compare checkpoints
pnpm effect-migrate checkpoints diff <first-id> <second-id>
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
- [ ] `AMP_THREAD_ID` auto-detected and linked to checkpoint
- [ ] Delta computed between consecutive checkpoints
- [ ] CLI commands work: `list`, `latest`, `show`, `diff`

### Performance Requirements

- [ ] Checkpoint creation adds <100ms to audit runtime (10k findings)
- [ ] Checkpoint files use normalized schema (50-70% size reduction vs. old format)
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

- `packages/cli/src/amp/checkpoint-manager.ts` (~500 LOC)
- `packages/cli/src/commands/checkpoints.ts` (~200 LOC)
- `packages/cli/src/__tests__/checkpoint-manager.test.ts` (~150 LOC)
- `packages/cli/src/__tests__/checkpoints-command.test.ts` (~100 LOC)

**Modified files:**

- `packages/cli/src/commands/audit.ts` (integrate checkpoint creation)
- `packages/cli/src/amp/index-writer.ts` (add checkpoint history)
- `packages/cli/src/index.ts` (register checkpoints subcommand)

**Total effort:** 4-6 hours coding + 1-2 hours testing

---

## Future Enhancements (Not in This PR)

- Checkpoint retention policy (max count, max age)
- Checkpoint annotations and tagging
- Progress charts (ASCII art in CLI)
- SQLite backend for large projects (Phase 2 of comprehensive plan)
- Analytics engine with nodejs-polars (Phase 3)
- OpenTelemetry monitoring (Phase 4)
- MCP server integration (Phase 5)

---

**Last Updated:** 2025-11-06  
**Maintainer:** @aridyckovsky  
**Status:** Ready for implementation  
**Thread:** https://ampcode.com/threads/T-5bd34c50-9752-4d71-8768-e8290de2c380
