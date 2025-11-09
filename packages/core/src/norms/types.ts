/**
 * Norms Types - Directory summary schemas for norm capture.
 *
 * This module defines the core types for capturing and representing coding norms
 * established during migration. Norms are rules that have been successfully
 * migrated to zero violations and maintained that state.
 *
 * **Design Principles:**
 * - Reuse existing schemas (Severity, CheckpointSummary) from ../schema/amp.js
 * - All types use Schema for runtime validation and encoding
 * - DirectorySummary can be serialized via Schema.encodeSync for consistent Date handling
 *
 * @module @effect-migrate/core/norms/types
 * @since 0.6.0
 */

import * as Schema from "effect/Schema"
import { CheckpointSummary, Severity } from "../schema/amp.js"

/**
 * Directory migration status enumeration.
 *
 * Represents the current state of a directory's migration progress:
 * - **migrated**: No violations remain, norms have been established
 * - **in-progress**: Some violations remain, norms are partially established
 * - **not-started**: No meaningful migration activity detected
 *
 * @category Schema
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { DirectoryStatus, DirectorySummary } from "@effect-migrate/core"
 *
 * const summary: DirectorySummary = {
 *   directory: "src/services",
 *   status: "migrated", // Type-safe literal
 *   // ...
 * }
 * ```
 */
export const DirectoryStatus = Schema.Literal("migrated", "in-progress", "not-started")

/**
 * Directory migration status type.
 *
 * @category Type
 * @since 0.6.0
 */
export type DirectoryStatus = typeof DirectoryStatus.Type

/**
 * Norm - a coding rule that reached zero violations and stayed there.
 *
 * A norm represents an established team agreement about code quality. It indicates
 * that a rule was successfully migrated (violations reduced to zero) and the team
 * has maintained that standard over time.
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
 *
 * @category Schema
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { Norm } from "@effect-migrate/core"
 * import * as Schema from "effect/Schema"
 *
 * const norm = Schema.decodeSync(Norm)({
 *   ruleId: "no-async-await",
 *   ruleKind: "pattern",
 *   severity: "warning",
 *   establishedAt: "2025-01-15T10:30:00Z",
 *   violationsFixed: 42,
 *   docsUrl: "https://effect.website/docs/gen"
 * })
 * ```
 */
export const Norm = Schema.Struct({
  /** Rule ID (e.g., "no-async-await") */
  ruleId: Schema.String,

  /** Rule kind (e.g., "pattern", "boundary") */
  ruleKind: Schema.String,

  /** Severity level of the rule */
  severity: Severity,

  /** ISO 8601 timestamp when this norm was established (first zero after non-zero) */
  establishedAt: Schema.DateTimeUtc,

  /** Total violations fixed to establish this norm */
  violationsFixed: Schema.Number,

  /** Optional documentation URL explaining the rule */
  docsUrl: Schema.optional(Schema.String)
})

/**
 * Norm type extracted from Norm schema.
 *
 * @category Type
 * @since 0.6.0
 */
export type Norm = typeof Norm.Type

/**
 * Directory summary for norms capture.
 *
 * Combines comprehensive migration data for a single directory including:
 * - File statistics (total, clean, with violations)
 * - Established norms (rules that reached zero violations)
 * - Thread associations (Amp threads related to this directory's migration)
 * - Latest checkpoint metadata
 *
 * This is the primary data structure for directory-level norm reporting and
 * can be serialized to JSON for persistent storage or API responses.
 *
 * @category Schema
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { DirectorySummary } from "@effect-migrate/core"
 * import * as Schema from "effect/Schema"
 *
 * const summary = Schema.encodeSync(DirectorySummary)({
 *   directory: "src/services",
 *   status: "migrated",
 *   cleanSince: new Date("2025-01-15"),
 *   files: {
 *     total: 25,
 *     clean: 25,
 *     withViolations: 0
 *   },
 *   norms: [
 *     {
 *       ruleId: "no-async-await",
 *       ruleKind: "pattern",
 *       severity: "warning",
 *       establishedAt: new Date("2025-01-10"),
 *       violationsFixed: 42
 *     }
 *   ],
 *   threads: [],
 *   latestCheckpoint: {
 *     checkpointId: "cp-123",
 *     timestamp: new Date(),
 *     // ...
 *   }
 * })
 * ```
 */
export const DirectorySummary = Schema.Struct({
  /** Directory path relative to project root (e.g., "src/services") */
  directory: Schema.String,

  /** Current migration status of this directory */
  status: DirectoryStatus,

  /** ISO 8601 timestamp when directory became clean (all violations resolved) */
  cleanSince: Schema.optional(Schema.DateTimeUtc),

  /** File statistics within directory */
  files: Schema.Struct({
    /** Total number of files in directory */
    total: Schema.Number,

    /** Number of files with no violations */
    clean: Schema.Number,

    /** Number of files with at least one violation */
    withViolations: Schema.Number
  }),

  /** Established norms (rules that went to zero violations and stayed there) */
  norms: Schema.Array(Norm),

  /** Amp threads associated with this directory's migration work */
  threads: Schema.Array(
    Schema.Struct({
      /** Amp thread ID (e.g., "T-abc-123") */
      threadId: Schema.String,

      /** ISO 8601 timestamp of thread creation */
      timestamp: Schema.DateTimeUtc,

      /** Description of thread's relevance to this directory */
      relevance: Schema.String
    })
  ),

  /** Latest checkpoint metadata (includes finding counts, config, etc.) */
  latestCheckpoint: CheckpointSummary
})

/**
 * Directory summary type extracted from DirectorySummary schema.
 *
 * @category Type
 * @since 0.6.0
 */
export type DirectorySummary = typeof DirectorySummary.Type
