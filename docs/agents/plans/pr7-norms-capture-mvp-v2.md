---
created: 2025-11-08
lastUpdated: 2025-11-08
author: Generated via Amp (Oracle analysis + improvements)
status: ready
thread: https://ampcode.com/threads/T-394eed7a-c9d8-46d7-8dfe-293134910db1
audience: Development team and AI coding agents
tags: [pr-plan, norms-capture, agents-md, documentation, mvp, wave2, effect-first]
related:
  - ./agents-doc-generation-mvp.md
  - ./checkpoint-based-audit-persistence.md
  - ../../packages/core/AGENTS.md
  - ../../packages/cli/AGENTS.md
dependencies:
  - PR #46 (JSON checkpoints + checkpoints CLI) - MERGED
improvements:
  - Reuse existing amp schemas (Severity, CheckpointSummary) for DRY
  - Define explicit TaggedError types for better error handling
  - Split pure logic from IO for testability
  - Use Schema.encodeSync for JSON serialization
  - Proper Layer composition with NodeContext
  - Use Cause.pretty for error logging
---

# PR7: Norms Capture MVP - Prepare-Only Mode (v2)

## Goal

Capture directory-specific migration norms from checkpoint history using Effect-first patterns, proper service abstraction, and maximum code reuse from existing checkpoint infrastructure.

**Estimated Effort:** 3-5 hours (improved from 2-4h due to higher quality implementation)

**Dependencies:**

- PR #46 (JSON checkpoints) - ✅ MERGED
- Uses existing `checkpoint-manager.ts`, `schema/amp.js`

---

## Key Improvements Over V1

Based on oracle analysis:

1. **✅ Reuse Existing Schemas** - Import `Severity`, `CheckpointSummary` from `../schema/amp.js` instead of redefining
2. **✅ Explicit Tagged Errors** - Define `NoCheckpointsError`, `InvalidDirectoryError`, `NormDetectionError` instead of generic `PlatformError`
3. **✅ Pure + IO Separation** - Extract pure helpers (`detectExtinctNorms`, `computeDirectoryStats`) for unit testing
4. **✅ Schema-Based JSON** - Use `Schema.encodeSync` for type-safe serialization with proper Date handling
5. **✅ Proper Layer Composition** - Provide `DirectorySummarizerLive` layer with NodeContext dependencies
6. **✅ Better Error Logging** - Use `Cause.pretty` in CLI instead of string interpolation
7. **✅ Lookback Algorithm** - Precise norm detection: zero across K checkpoints AND prior non-zero

---

## Implementation

### Phase 1: Types with Schema Reuse (30-45 min)

#### File: `packages/core/src/norms/types.ts` (NEW)

**Purpose:** Type-safe schemas reusing existing amp schemas to avoid drift.

```typescript
/**
 * Norms Types - Directory summary schemas for norm capture.
 *
 * **Design Principles:**
 * - Reuse existing schemas (Severity, CheckpointSummary) from ../schema/amp.js
 * - All types use Schema for runtime validation and encoding
 * - DirectorySummary can be serialized via Schema.encodeSync for consistent Date handling
 *
 * @module @effect-migrate/core/norms/types
 * @since 0.4.0
 */

import * as Schema from "effect/Schema"
import { Severity, CheckpointSummary } from "../schema/amp.js"

/**
 * Directory migration status.
 *
 * - **migrated**: No violations, norms established
 * - **in-progress**: Some violations remain, norms partially established
 * - **not-started**: No meaningful migration activity
 */
export const DirectoryStatus = Schema.Literal("migrated", "in-progress", "not-started")
export type DirectoryStatus = typeof DirectoryStatus.Type

/**
 * Norm - a rule that went to zero and stayed there.
 *
 * **Detection Algorithm:**
 * For each rule within a directory, build time series over last N checkpoints (sorted ascending):
 * 1. Last K checkpoints (K = lookbackWindow, default 5) all have count === 0
 * 2. There exists an earlier checkpoint with count > 0
 * 3. establishedAt = timestamp of first checkpoint where count transitioned to zero
 *
 * **Why this matters:**
 * Norms represent established team agreements. We require lookback window consensus
 * to avoid false positives from temporary fixes that later regress.
 */
export const Norm = Schema.Struct({
  /** Rule ID (e.g., "no-async-await") */
  ruleId: Schema.String,

  /** Rule kind (e.g., "pattern", "boundary") */
  ruleKind: Schema.String,

  /** Severity (reuse existing schema for consistency) */
  severity: Severity,

  /** When this norm was established (timestamp of zero transition) */
  establishedAt: Schema.DateTimeUtc,

  /** Total violations fixed to establish this norm */
  violationsFixed: Schema.Number,

  /** Optional documentation URL */
  docsUrl: Schema.optional(Schema.String)
})
export type Norm = typeof Norm.Type

/**
 * Directory summary for norms capture.
 *
 * Combines file statistics, established norms, thread associations, and latest checkpoint.
 */
export const DirectorySummary = Schema.Struct({
  /** Directory path relative to project root (e.g., "src/services") */
  directory: Schema.String,

  /** Migration status */
  status: DirectoryStatus,

  /** When directory became clean (if migrated) */
  cleanSince: Schema.optional(Schema.DateTimeUtc),

  /** File statistics within directory */
  files: Schema.Struct({
    total: Schema.Number,
    clean: Schema.Number,
    withViolations: Schema.Number
  }),

  /** Established norms (rules that went to zero) */
  norms: Schema.Array(Norm),

  /** Threads associated with this directory's migration */
  threads: Schema.Array(
    Schema.Struct({
      threadId: Schema.String,
      timestamp: Schema.DateTimeUtc,
      relevance: Schema.String
    })
  ),

  /** Latest checkpoint metadata (reuse entire CheckpointSummary schema) */
  latestCheckpoint: CheckpointSummary
})
export type DirectorySummary = typeof DirectorySummary.Type
```

**Key Changes:**

- ✅ Import `Severity` and `CheckpointSummary` from existing schemas
- ✅ Use `typeof Schema.Type` pattern (simpler than `Schema.Schema.Type`)
- ✅ Document norm detection algorithm clearly
- ✅ Reuse `CheckpointSummary` instead of redefining timestamp/errors/warnings

---

### Phase 2: Tagged Errors (15 min)

#### File: `packages/core/src/norms/errors.ts` (NEW)

**Purpose:** Explicit error types for norms capture with structured context.

```typescript
/**
 * Norms Errors - Tagged errors for norm capture operations.
 *
 * Following Effect best practices:
 * - Use Data.TaggedError for domain errors
 * - Include context for debugging (paths, IDs, causes)
 * - Avoid generic PlatformError in public APIs
 *
 * @module @effect-migrate/core/norms/errors
 * @since 0.4.0
 */

import { Data } from "effect"

/**
 * No checkpoints found in specified directory.
 */
export class NoCheckpointsError extends Data.TaggedError("NoCheckpointsError")<{
  readonly ampOut: string
  readonly reason?: string
}> {}

/**
 * Invalid directory path provided.
 */
export class InvalidDirectoryError extends Data.TaggedError("InvalidDirectoryError")<{
  readonly directory: string
  readonly reason?: string
}> {}

/**
 * Error during norm detection algorithm.
 */
export class NormDetectionError extends Data.TaggedError("NormDetectionError")<{
  readonly directory?: string
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Error writing norm summary to filesystem.
 */
export class SummaryWriteError extends Data.TaggedError("SummaryWriteError")<{
  readonly path: string
  readonly cause: unknown
}> {}

/**
 * Union of all norm capture errors.
 */
export type NormCaptureError =
  | NoCheckpointsError
  | InvalidDirectoryError
  | NormDetectionError
  | SummaryWriteError
```

**Benefits:**

- ✅ Explicit error types instead of generic `PlatformError`
- ✅ Structured context for debugging
- ✅ CLI can use `Effect.catchTag` for specific error handling
- ✅ Better TypeScript inference and exhaustiveness checking

---

### Phase 3: Pure Helper Functions (45 min - 1 hour)

#### File: `packages/core/src/norms/pure.ts` (NEW)

**Purpose:** Pure, unit-testable logic for norm detection and directory analysis.

```typescript
/**
 * Norms Pure Logic - Stateless helpers for norm detection.
 *
 * **Design:**
 * - All functions are pure (no IO, no side effects)
 * - Easily unit-testable with simple inputs
 * - High performance (no async overhead)
 *
 * @module @effect-migrate/core/norms/pure
 * @since 0.4.0
 */

import type { AuditCheckpoint } from "../schema/checkpoint.js"
import type { NormalizedAudit } from "../schema/normalized.js"
import type { Norm, DirectoryStatus } from "./types.js"

/**
 * Extract directory key from file path.
 *
 * @param filePath - File path (e.g., "src/services/UserService.ts")
 * @param depth - Directory depth (default 2)
 * @returns Directory key (e.g., "src/services")
 *
 * @example
 * dirKeyFromPath("src/services/auth/UserService.ts", 2) // "src/services"
 * dirKeyFromPath("packages/core/src/index.ts", 3) // "packages/core/src"
 */
export const dirKeyFromPath = (filePath: string, depth = 2): string => {
  const parts = filePath.split(/[\\/]/)
  return parts.slice(0, Math.min(depth, parts.length)).join("/")
}

/**
 * Check if time series is zero across entire window.
 */
const zeroedAcross = (series: readonly number[]): boolean => series.every((n) => n === 0)

/**
 * Find index where count transitioned to zero (and stayed zero).
 *
 * Returns index of first checkpoint where:
 * - count === 0
 * - All subsequent counts are also 0
 * - Previous count was > 0 (or is first in series)
 *
 * Returns -1 if no transition found.
 */
const findZeroTransitionIdx = (series: readonly number[]): number => {
  for (let i = series.length - 1; i >= 0; i--) {
    const current = series[i]
    const allZeroAfter = series.slice(i).every((n) => n === 0)
    const hadViolationsBefore = i === 0 || series[i - 1] > 0

    if (current === 0 && allZeroAfter && hadViolationsBefore) {
      return i
    }
  }
  return -1
}

/**
 * Detect norms from checkpoint time series.
 *
 * A norm is established when a rule's violation count:
 * 1. Goes to zero
 * 2. Stays zero across lookback window
 * 3. Had violations in prior checkpoint
 *
 * @param checkpoints - Checkpoints in ascending time order
 * @param directory - Directory to analyze
 * @param lookbackWindow - Number of recent checkpoints to require zero
 * @returns Array of detected norms
 */
export const detectExtinctNorms = (
  checkpoints: readonly {
    readonly id: string
    readonly timestamp: string
    readonly normalized: NormalizedAudit
  }[],
  directory: string,
  lookbackWindow = 5
): readonly Norm[] => {
  if (checkpoints.length === 0) return []

  // Build rule time series for this directory
  const ruleTimeSeries = new Map<string, number[]>()

  for (const cp of checkpoints) {
    // Filter results for this directory
    const dirResults = cp.normalized.results.filter((r) => {
      const file = cp.normalized.files[r[1]] // [ruleIdx, fileIdx, ...]
      return file?.startsWith(directory)
    })

    // Count violations per rule
    const ruleCounts = new Map<number, number>()
    for (const result of dirResults) {
      const ruleIdx = result[0]
      ruleCounts.set(ruleIdx, (ruleCounts.get(ruleIdx) || 0) + 1)
    }

    // Update time series for each rule
    for (let i = 0; i < cp.normalized.rules.length; i++) {
      const count = ruleCounts.get(i) || 0
      if (!ruleTimeSeries.has(cp.normalized.rules[i].id)) {
        ruleTimeSeries.set(cp.normalized.rules[i].id, [])
      }
      ruleTimeSeries.get(cp.normalized.rules[i].id)!.push(count)
    }
  }

  // Identify norms
  const norms: Norm[] = []

  for (const [ruleId, series] of ruleTimeSeries.entries()) {
    // Check if zero across lookback window
    const recentSeries = series.slice(-lookbackWindow)
    if (!zeroedAcross(recentSeries)) continue

    // Find when it went to zero
    const transitionIdx = findZeroTransitionIdx(series)
    if (transitionIdx === -1) continue

    // Count violations fixed
    const violationsFixed = series.slice(0, transitionIdx).reduce((sum, n) => sum + n, 0)

    // Find rule metadata from latest checkpoint
    const latestCp = checkpoints[checkpoints.length - 1]
    const ruleMetadata = latestCp.normalized.rules.find((r) => r.id === ruleId)
    if (!ruleMetadata) continue

    norms.push({
      ruleId,
      ruleKind: ruleMetadata.kind,
      severity: ruleMetadata.severity,
      establishedAt: new Date(checkpoints[transitionIdx].timestamp),
      violationsFixed,
      docsUrl: ruleMetadata.docsUrl
    })
  }

  return norms
}

/**
 * Compute file statistics for directory from latest checkpoint.
 */
export const computeDirectoryStats = (
  checkpoint: NormalizedAudit,
  directory: string
): { total: number; clean: number; withViolations: number } => {
  // Files in directory
  const filesInDir = checkpoint.files.filter((f) => f.startsWith(directory))

  // Files with violations
  const filesWithViolations = new Set(
    checkpoint.results
      .filter((r) => {
        const file = checkpoint.files[r[1]]
        return file?.startsWith(directory)
      })
      .map((r) => checkpoint.files[r[1]])
  )

  return {
    total: filesInDir.length,
    clean: filesInDir.length - filesWithViolations.size,
    withViolations: filesWithViolations.size
  }
}

/**
 * Determine directory migration status.
 */
export const determineStatus = (
  files: { total: number; clean: number; withViolations: number },
  norms: readonly Norm[]
): DirectoryStatus => {
  if (files.total === 0) return "not-started"
  if (files.withViolations === 0 && norms.length > 0) return "migrated"
  if (norms.length > 0) return "in-progress"
  return "not-started"
}
```

**Benefits:**

- ✅ Pure functions easy to unit test
- ✅ No Effect overhead for simple logic
- ✅ Clear algorithm documentation
- ✅ Proper handling of normalized array indices

---

### Phase 4: DirectorySummarizer Service (1-2 hours)

#### File: `packages/core/src/norms/DirectorySummarizer.ts` (NEW)

**Purpose:** Effect service that orchestrates IO and calls pure helpers.

```typescript
/**
 * DirectorySummarizer - Extract migration norms from checkpoint history.
 *
 * **Architecture:**
 * - Service provides high-level API (summarize, summarizeAll)
 * - Delegates to checkpoint-manager for IO (listCheckpoints, readCheckpoint)
 * - Delegates to pure helpers for analysis (detectExtinctNorms, computeDirectoryStats)
 * - Returns explicit TaggedErrors (not generic PlatformError)
 *
 * **Dependencies:**
 * - FileSystem.FileSystem (from @effect/platform)
 * - Path.Path (from @effect/platform)
 *
 * @module @effect-migrate/core/norms/DirectorySummarizer
 * @since 0.4.0
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { FileSystem } from "@effect/platform"
import { Path } from "@effect/platform"
import { listCheckpoints, readCheckpoint } from "../amp/checkpoint-manager.js"
import type { DirectorySummary } from "./types.js"
import type {
  NoCheckpointsError,
  InvalidDirectoryError,
  NormDetectionError,
  NormCaptureError
} from "./errors.js"
import {
  detectExtinctNorms,
  computeDirectoryStats,
  determineStatus,
  dirKeyFromPath
} from "./pure.js"

/**
 * DirectorySummarizer service interface.
 */
export interface DirectorySummarizerService {
  /**
   * Summarize norms for a single directory.
   *
   * @param args - Configuration object
   * @returns Directory summary or error
   */
  readonly summarize: (args: {
    readonly ampOut: string
    readonly directory: string
    readonly lookbackWindow?: number
    readonly minFiles?: number
  }) => Effect.Effect<DirectorySummary, NormCaptureError>

  /**
   * Summarize all directories with optional status filter.
   *
   * @param args - Configuration object
   * @returns Array of directory summaries or error
   */
  readonly summarizeAll: (args: {
    readonly ampOut: string
    readonly status?: "migrated" | "in-progress" | "all"
    readonly lookbackWindow?: number
    readonly minFiles?: number
  }) => Effect.Effect<readonly DirectorySummary[], NormCaptureError>
}

export class DirectorySummarizer extends Context.Tag("DirectorySummarizer")<
  DirectorySummarizer,
  DirectorySummarizerService
>() {}

/**
 * Live implementation of DirectorySummarizer.
 */
export const DirectorySummarizerLive = Layer.effect(
  DirectorySummarizer,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const summarize: DirectorySummarizerService["summarize"] = ({
      ampOut,
      directory,
      lookbackWindow = 5,
      minFiles = 1
    }) =>
      Effect.gen(function* () {
        // Validate directory
        if (!directory || directory.trim() === "") {
          return yield* Effect.fail(
            new InvalidDirectoryError({ directory, reason: "Directory path is empty" })
          )
        }

        // List recent checkpoints
        const summaries = yield* listCheckpoints(ampOut, lookbackWindow + 1)

        if (summaries.length === 0) {
          return yield* Effect.fail(
            new NoCheckpointsError({
              ampOut,
              reason: "Run 'effect-migrate audit --amp-out .amp/effect-migrate' first"
            })
          )
        }

        // Read checkpoints concurrently
        const checkpointsWithData = yield* Effect.forEach(
          summaries,
          (summary) =>
            Effect.gen(function* () {
              const checkpoint = yield* readCheckpoint(ampOut, summary.checkpointId)
              return {
                id: summary.checkpointId,
                timestamp: summary.timestamp,
                normalized: checkpoint.normalized
              }
            }),
          { concurrency: 4 }
        )

        const latest = summaries[0]
        const latestNormalized = checkpointsWithData[0].normalized

        // Compute norms (pure)
        const norms = detectExtinctNorms(checkpointsWithData, directory, lookbackWindow)

        // Compute file stats (pure)
        const files = computeDirectoryStats(latestNormalized, directory)

        // Skip if too few files
        if (files.total < minFiles) {
          return {
            directory,
            status: "not-started" as const,
            files,
            norms: [],
            threads: [],
            latestCheckpoint: latest
          }
        }

        // Determine status (pure)
        const status = determineStatus(files, norms)

        // Find clean-since timestamp
        const cleanSince =
          status === "migrated"
            ? Option.some(
                checkpointsWithData.find(
                  (cp) => computeDirectoryStats(cp.normalized, directory).withViolations === 0
                )?.timestamp ?? latest.timestamp
              )
            : Option.none()

        // Extract thread associations
        const threads = summaries
          .filter((s) => s.thread !== undefined)
          .map((s) => ({
            threadId: s.thread!,
            timestamp: new Date(s.timestamp),
            relevance: "Migration activity"
          }))

        return {
          directory,
          status,
          cleanSince: Option.getOrUndefined(cleanSince)
            ? new Date(Option.getOrThrow(cleanSince))
            : undefined,
          files,
          norms,
          threads,
          latestCheckpoint: latest
        }
      }).pipe(
        Effect.catchAll((error) =>
          error instanceof Data.TaggedError
            ? Effect.fail(error)
            : Effect.fail(new NormDetectionError({ directory, message: String(error) }))
        )
      )

    const summarizeAll: DirectorySummarizerService["summarizeAll"] = ({
      ampOut,
      status = "all",
      lookbackWindow = 5,
      minFiles = 1
    }) =>
      Effect.gen(function* () {
        // Get latest checkpoint to extract directories
        const summaries = yield* listCheckpoints(ampOut, 1)

        if (summaries.length === 0) {
          return yield* Effect.fail(
            new NoCheckpointsError({
              ampOut,
              reason: "Run 'effect-migrate audit --amp-out .amp/effect-migrate' first"
            })
          )
        }

        const latest = summaries[0]
        const checkpoint = yield* readCheckpoint(ampOut, latest.checkpointId)

        // Extract unique directories
        const directories = [
          ...new Set(checkpoint.normalized.files.map((file) => dirKeyFromPath(file, 2)))
        ]

        // Summarize each directory
        const allSummaries = yield* Effect.forEach(
          directories,
          (dir) => summarize({ ampOut, directory: dir, lookbackWindow, minFiles }),
          { concurrency: 4 }
        )

        // Filter by status
        return allSummaries.filter((s) =>
          status === "all"
            ? true
            : status === "migrated"
              ? s.status === "migrated"
              : s.status === "in-progress"
        )
      })

    return { summarize, summarizeAll }
  })
)
```

**Key Improvements:**

- ✅ Explicit error types in return signatures
- ✅ Concurrent checkpoint reads with `Effect.forEach({ concurrency: 4 })`
- ✅ Delegates to pure helpers for analysis
- ✅ Reuses checkpoint-manager functions
- ✅ Proper error propagation with `catchAll`

---

### Phase 5: CLI Command (1-2 hours)

#### File: `packages/cli/src/commands/norms.ts` (NEW)

**Purpose:** CLI command that composes layers and writes schema-encoded JSON.

```typescript
/**
 * Norms Command - Capture migration norms from checkpoint history.
 *
 * **Architecture:**
 * - Composes DirectorySummarizerLive with NodeContext layer
 * - Uses Schema.encodeSync for type-safe JSON serialization
 * - Uses Cause.pretty for readable error messages
 * - Returns numeric exit codes (0 = success, 1 = error)
 *
 * @module @effect-migrate/cli/commands/norms
 * @since 0.4.0
 */

import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Args from "@effect/cli/Args"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Cause from "effect/Cause"
import { FileSystem } from "@effect/platform"
import { Path } from "@effect/platform"
import { NodeContext } from "@effect/platform-node/NodeContext"
import {
  DirectorySummarizer,
  DirectorySummarizerLive
} from "@effect-migrate/core/norms/DirectorySummarizer"
import { DirectorySummary } from "@effect-migrate/core/norms/types"

/**
 * Norms capture command options.
 */
const normsCaptureOptions = {
  // If any of these are already defined, import them instead of defining them here
  ampOut: Options.text("amp-out").pipe(
    Options.withDefault(".amp/effect-migrate"),
    Options.withDescription("Path to Amp context directory")
  ),

  status: Options.choice("status", ["migrated", "in-progress", "all"]).pipe(
    Options.withDefault("all" as const),
    Options.withDescription("Filter directories by migration status")
  ),

  directory: Options.text("directory").pipe(
    Options.optional,
    Options.withDescription("Capture norms for specific directory only")
  ),

  prepareOnly: Options.boolean("prepare-only").pipe(
    Options.withDefault(true),
    Options.withDescription("Only prepare JSON summaries (don't auto-generate docs)")
  ),

  overwrite: Options.boolean("overwrite").pipe(
    Options.withDefault(false),
    Options.withDescription("Overwrite existing norm summary files")
  ),

  minFiles: Options.integer("min-files").pipe(
    Options.withDefault(1),
    Options.withDescription("Minimum files required to analyze a directory")
  ),

  lookback: Options.integer("lookback").pipe(
    Options.withDefault(5),
    Options.withDescription("Number of checkpoints for norm consensus")
  )
}

/**
 * Norms capture command implementation.
 */
const normsCaptureCommand = Command.make("capture", normsCaptureOptions, (opts) =>
  Effect.gen(function* () {
    const summarizer = yield* DirectorySummarizer
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    yield* Console.log("🔍 Analyzing checkpoint history...")

    // Get directory summaries
    const summaries = yield* opts.directory
      ? Effect.map(
          summarizer.summarize({
            ampOut: opts.ampOut,
            directory: opts.directory,
            lookbackWindow: opts.lookback,
            minFiles: opts.minFiles
          }),
          (s) => [s]
        )
      : summarizer.summarizeAll({
          ampOut: opts.ampOut,
          status: opts.status === "all" ? undefined : opts.status,
          lookbackWindow: opts.lookback,
          minFiles: opts.minFiles
        })

    if (summaries.length === 0) {
      yield* Console.log("No directories found matching criteria.")
      return 0
    }

    // Prepare output directory
    const normsDir = path.join(opts.ampOut, "norms")
    yield* fs.makeDirectory(normsDir, { recursive: true })

    // Write summary files (schema-encoded)
    let written = 0

    for (const summary of summaries) {
      const filename = summary.directory.replace(/\//g, "-") + ".json"
      const filepath = path.join(normsDir, filename)

      // Check if file exists
      const exists = yield* fs.exists(filepath)
      if (exists && !opts.overwrite) {
        yield* Console.log(`  ⏭️  Skipping ${summary.directory} (already exists)`)
        continue
      }

      // Encode via schema (handles Date serialization correctly)
      const encoded = Schema.encodeSync(DirectorySummary)(summary)

      // Write to file
      yield* fs.writeFileString(filepath, JSON.stringify(encoded, null, 2))

      written++

      const statusIcon =
        summary.status === "migrated" ? "✅" : summary.status === "in-progress" ? "🔄" : "⚪"

      yield* Console.log(
        `  ${statusIcon} ${summary.directory} → ${filename} (${summary.norms.length} norms)`
      )
    }

    yield* Console.log("")
    yield* Console.log(`✓ Captured norms for ${written} director${written === 1 ? "y" : "ies"}`)
    yield* Console.log(`  Output: ${normsDir}`)

    if (opts.prepareOnly) {
      yield* Console.log("")
      yield* Console.log("📝 To document in AGENTS.md, tell Amp:")
      yield* Console.log(
        `  "Read @${normsDir}/ and document these norms in AGENTS.md for each directory"`
      )
    }

    return 0
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.gen(function* () {
        yield* Console.error("❌ Failed to capture norms:")
        yield* Console.error(Cause.pretty(cause))
        return 1
      })
    ),
    Effect.provide(DirectorySummarizerLive),
    Effect.provide(NodeContext.layer)
  )
)

/**
 * Norms command group.
 */
export const normsCommand = Command.make("norms", {}, () => Effect.succeed(0)).pipe(
  Command.withSubcommands([normsCaptureCommand])
)
```

**Key Improvements:**

- ✅ Use `Schema.encodeSync(DirectorySummary)` for JSON serialization
- ✅ Use `Cause.pretty` for error logging instead of string interpolation
- ✅ Proper layer composition with `Effect.provide`
- ✅ Numeric exit codes (0/1)
- ✅ Clear user guidance for next steps

---

### Phase 6: Export from Core (5 min)

#### File: `packages/core/src/index.ts` (MODIFIED)

```diff
+ // Norms capture
+ export * from "./norms/types.js"
+ export * from "./norms/errors.js"
+ export * from "./norms/pure.js"
+ export * from "./norms/DirectorySummarizer.js"
```

---

### Phase 7: Register CLI Command (5 min)

#### File: `packages/cli/src/index.ts` (MODIFIED)

```diff
+ import { normsCommand } from "./commands/norms.js"

  const cli = Command.make("effect-migrate").pipe(
    Command.withSubcommands([
      auditCommand,
      metricsCommand,
      docsCommand,
      initCommand,
      checkpointsCommand,
      threadCommand,
+     normsCommand
    ])
  )
```

---

### Phase 8: Testing (1-2 hours)

#### File: `packages/core/test/norms/pure.test.ts` (NEW)

```typescript
import { describe, it, expect } from "@effect/vitest"
import {
  dirKeyFromPath,
  detectExtinctNorms,
  computeDirectoryStats,
  determineStatus
} from "../pure.js"

describe("pure helpers", () => {
  describe("dirKeyFromPath", () => {
    it("should extract directory at depth 2", () => {
      expect(dirKeyFromPath("src/services/UserService.ts", 2)).toBe("src/services")
      expect(dirKeyFromPath("packages/core/src/index.ts", 2)).toBe("packages/core")
    })

    it("should handle different depths", () => {
      expect(dirKeyFromPath("src/services/auth/UserService.ts", 3)).toBe("src/services/auth")
      expect(dirKeyFromPath("src/index.ts", 1)).toBe("src")
    })
  })

  describe("detectExtinctNorms", () => {
    it("should detect rule that went to zero", () => {
      const checkpoints = [
        {
          id: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          normalized: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error" }],
            files: ["src/services/UserService.ts"],
            results: [[0, 0, [1, 1]]] // Rule 0, File 0, Line 1 Col 1
          }
        },
        {
          id: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          normalized: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error" }],
            files: ["src/services/UserService.ts"],
            results: [] // Fixed!
          }
        }
      ]

      const norms = detectExtinctNorms(checkpoints, "src/services", 1)

      expect(norms).toHaveLength(1)
      expect(norms[0].ruleId).toBe("no-async")
      expect(norms[0].violationsFixed).toBe(1)
    })
  })

  describe("determineStatus", () => {
    it("should return migrated when clean with norms", () => {
      const status = determineStatus({ total: 10, clean: 10, withViolations: 0 }, [
        { ruleId: "test", violationsFixed: 5 }
      ])
      expect(status).toBe("migrated")
    })

    it("should return in-progress when violations remain", () => {
      const status = determineStatus({ total: 10, clean: 5, withViolations: 5 }, [
        { ruleId: "test", violationsFixed: 5 }
      ])
      expect(status).toBe("in-progress")
    })

    it("should return not-started when no activity", () => {
      const status = determineStatus({ total: 0, clean: 0, withViolations: 0 }, [])
      expect(status).toBe("not-started")
    })
  })
})
```

#### File: `packages/core/test/norms/DirectorySummarizer.test.ts` (NEW)

```typescript
import { describe, it, expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { DirectorySummarizer, DirectorySummarizerLive } from "../DirectorySummarizer.js"

layer(DirectorySummarizerLive)("DirectorySummarizer", (it) => {
  it.effect("should summarize directory with norms", () =>
    Effect.gen(function* () {
      const summarizer = yield* DirectorySummarizer

      // Assumes test fixtures exist
      const summary = yield* summarizer.summarize({
        ampOut: ".amp/effect-migrate",
        directory: "src/services"
      })

      expect(summary.directory).toBe("src/services")
      expect(summary.files.total).toBeGreaterThan(0)
    })
  )

  it.effect("should fail with NoCheckpointsError when no data", () =>
    Effect.gen(function* () {
      const summarizer = yield* DirectorySummarizer

      const result = yield* Effect.either(
        summarizer.summarize({
          ampOut: "/nonexistent",
          directory: "src/test"
        })
      )

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("NoCheckpointsError")
      }
    })
  )
})
```

---

## Files Summary

**New files:**

- `packages/core/src/norms/types.ts` (~100 LOC)
- `packages/core/src/norms/errors.ts` (~60 LOC)
- `packages/core/src/norms/pure.ts` (~200 LOC)
- `packages/core/src/norms/DirectorySummarizer.ts` (~180 LOC)
- `packages/core/test/norms/pure.test.ts` (~100 LOC)
- `packages/core/test/norms/DirectorySummarizer.test.ts` (~50 LOC)
- `packages/cli/src/commands/norms.ts` (~150 LOC)

**Modified files:**

- `packages/core/src/index.ts` (+4 lines)
- `packages/cli/src/index.ts` (+2 lines)

**Total:** ~840 new LOC + ~6 modified LOC

---

## Success Criteria

### Functional

- [ ] `norms capture --prepare-only` writes JSON summaries to `.amp/effect-migrate/norms/`
- [ ] Summaries reuse existing schemas (Severity, CheckpointSummary)
- [ ] Norms correctly identify rules that went to zero across lookback window
- [ ] Directory status correctly categorizes migrated/in-progress/not-started
- [ ] `--status` filter works (migrated/in-progress/all)
- [ ] `--directory` option analyzes single directory
- [ ] `--lookback` controls norm detection window
- [ ] `--min-files` filters out small directories
- [ ] `--overwrite` flag controls file replacement

### Quality

- [ ] Pure functions in `pure.ts` have unit tests
- [ ] Service layer has integration tests
- [ ] TaggedErrors used instead of generic PlatformError
- [ ] Schema.encodeSync used for JSON serialization
- [ ] Cause.pretty used for error logging
- [ ] Proper Layer composition in CLI

### Tests

- [ ] All unit tests pass
- [ ] Integration tests cover common scenarios
- [ ] `pnpm build` succeeds
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes; use `pnpm lint:fix` to fix linting issues
- [ ] `pnpm test` passes
- [ ] `pnpm format:check` passes; use `pnpm format` to fix formatting issues

---

## Documentation Updates

Same as V1, with emphasis on Effect-first patterns and schema reuse.

---

## Why These Improvements?

1. **Schema Reuse** - Prevents type drift, maintains consistency with checkpoint data
2. **Tagged Errors** - Better error handling, easier to test, clearer failure modes
3. **Pure/IO Split** - Testability, performance, clarity
4. **Schema Encoding** - Correct Date handling, type safety, DRY
5. **Proper Layers** - Effect-first DI, composability, testability
6. **Cause.pretty** - Better UX, readable error messages

---

**Last Updated:** 2025-11-08  
**Maintainer:** @aridyckovsky  
**Status:** Ready for implementation (improved)  
**Thread:** https://ampcode.com/threads/T-394eed7a-c9d8-46d7-8dfe-293134910db1  
**Next Steps:** Implement following Effect-first patterns with schema reuse
