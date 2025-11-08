/**
 * Amp Context Schemas - Structured schemas for MCP-compatible context output
 *
 * This module defines the Schema definitions for Amp AI coding agent context files.
 * These schemas ensure type-safe validation and transformation of migration state
 * that persists across Amp coding sessions.
 *
 * @module @effect-migrate/core/schema/amp
 * @since 0.1.0
 */

import * as Schema from "effect/Schema"
import { RuleKindSchema } from "../rules/types.js"
import { Semver } from "./common.js"

/**
 * Rule result schema matching RuleResult from @effect-migrate/core.
 *
 * Defines the structure of a single migration rule violation or finding,
 * including location information, severity, and documentation references.
 *
 * @category Schema
 * @since 0.1.0
 */
export const RuleResultSchema = Schema.Struct({
  /** Unique rule identifier */
  id: Schema.String,
  /** Rule type (pattern, boundary, etc.) */
  ruleKind: RuleKindSchema,
  /** Severity level */
  severity: Schema.Literal("error", "warning", "info"),
  /** Human-readable message */
  message: Schema.String,
  /** File path where violation occurred */
  file: Schema.optional(Schema.String),
  /** Line and column range */
  range: Schema.optional(Schema.Struct({
    start: Schema.Struct({
      line: Schema.Number,
      column: Schema.Number
    }),
    end: Schema.Struct({
      line: Schema.Number,
      column: Schema.Number
    })
  })),
  /** Documentation URL */
  docsUrl: Schema.optional(Schema.String),
  /** Rule tags */
  tags: Schema.optional(Schema.Array(Schema.String))
})

/**
 * Thread reference schema for tracking Amp threads where migration work occurred.
 *
 * Captures metadata about Amp coding sessions, including thread URLs, timestamps,
 * and which files/rules were addressed. Used to build an audit trail of migration
 * work across multiple coding sessions.
 *
 * Thread references are populated via:
 * - Manual `effect-migrate thread add` command for explicit linking
 * - Auto-detection using AMP_CURRENT_THREAD_ID environment variable during audit
 *
 * @category Schema
 * @since 0.1.0
 */
export const ThreadReference = Schema.Struct({
  /** Thread URL in format: https://ampcode.com/threads/T-{uuid} */
  url: Schema.String.pipe(
    Schema.pattern(/^https:\/\/ampcode\.com\/threads\/T-[a-f0-9-]+$/)
  ),
  /** ISO timestamp when thread was created or linked */
  timestamp: Schema.DateTimeUtc,
  /** Audit revision associated with this thread */
  auditRevision: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1)
  ),
  /** User-provided description of work done in this thread */
  description: Schema.optional(Schema.String),
  /** Files modified in this thread */
  filesChanged: Schema.optional(Schema.Array(Schema.String)),
  /** Rule IDs resolved or addressed in this thread */
  rulesResolved: Schema.optional(Schema.Array(Schema.String)),
  /** Tags for categorizing threads */
  tags: Schema.optional(Schema.Array(Schema.String)),
  /** Scope filter for grouping threads */
  scope: Schema.optional(Schema.Array(Schema.String))
})

/**
 * Summary statistics for migration findings.
 *
 * Provides high-level metrics about the migration state, including counts of
 * errors, warnings, info-level findings, affected files, and total findings.
 * Used for quick assessment of migration progress and health.
 *
 * @category Schema
 * @since 0.1.0
 */
export const FindingsSummary = Schema.Struct({
  /** Number of error-severity findings */
  errors: Schema.Number,
  /** Number of warning-severity findings */
  warnings: Schema.Number,
  /** Number of info-severity findings */
  info: Schema.Number,
  /** Total number of files with findings */
  totalFiles: Schema.Number,
  /** Total number of findings across all files */
  totalFindings: Schema.Number
})

/**
 * Configuration snapshot included in context output.
 *
 * Captures the subset of configuration that's relevant to understanding the
 * audit results, including which rules were active and what failure criteria
 * were applied.
 *
 * @category Schema
 * @since 0.1.0
 */
export const ConfigSnapshot = Schema.Struct({
  /** Rule IDs that produced findings */
  rulesEnabled: Schema.Array(Schema.String),
  /** Severity levels that cause audit failure */
  failOn: Schema.Array(Schema.String)
})

/**
 * Rule definition with metadata stored once per rule.
 *
 * Normalizes rule information to avoid duplication across findings.
 * Each rule is stored once with its metadata, and individual findings
 * reference rules by index.
 *
 * @category Schema
 * @since 0.1.0
 */
export const RuleDef = Schema.Struct({
  /** Unique rule identifier */
  id: Schema.String,
  /** Rule type (pattern, boundary, docs, metrics) */
  kind: RuleKindSchema,
  /** Severity level */
  severity: Schema.Literal("error", "warning", "info"),
  /** Human-readable message */
  message: Schema.String,
  /** Documentation URL */
  docsUrl: Schema.optional(Schema.String),
  /** Rule tags */
  tags: Schema.optional(Schema.Array(Schema.String))
})

/**
 * Compact range representation as a 4-element tuple.
 *
 * Stores position information in a space-efficient format:
 * [startLine, startColumn, endLine, endColumn]
 *
 * @category Schema
 * @since 0.1.0
 */
export const CompactRange = Schema.Tuple(
  Schema.Number, // startLine
  Schema.Number, // startColumn
  Schema.Number, // endLine
  Schema.Number // endColumn
)

/**
 * Compact result with indices pointing to normalized rules and files.
 *
 * Each result references a rule by index into the rules array, and optionally
 * a file by index into the files array. This avoids duplicating rule metadata
 * and file paths across thousands of findings.
 *
 * @category Schema
 * @since 0.1.0
 */
export const CompactResult = Schema.Struct({
  /** Index into rules array */
  rule: Schema.Number,
  /** Index into files array */
  file: Schema.optional(Schema.Number),
  /** Compact range (optional) */
  range: Schema.optional(CompactRange),
  /** Message override (optional, overrides rule.message) */
  message: Schema.optional(Schema.String)
})

/**
 * Normalized findings structure with deduplicated rules and files.
 *
 * Organizes findings efficiently by storing rules and files once, with compact
 * results referencing them by index. Provides two grouping views:
 * - groups.byFile: Stringified file index → result indices (e.g., "0": [0, 1, 2])
 * - groups.byRule: Stringified rule index → result indices (e.g., "0": [0, 2])
 *
 * The groups field is optional as it can be derived from results[], though
 * the current implementation always emits it for performance.
 *
 * This structure reduces JSON size and parsing overhead for large migration audits.
 *
 * @category Schema
 * @since 0.1.0
 */
export const FindingsGroup = Schema.Struct({
  /** Rule definitions (stored once, referenced by index) */
  rules: Schema.Array(RuleDef),
  /** File paths (stored once, referenced by index) */
  files: Schema.Array(Schema.String),
  /** Compact results array */
  results: Schema.Array(CompactResult),
  /**
   * Groupings by file and rule for O(1) lookup performance.
   *
   * Always emitted by normalizeResults(). Can be reconstructed from results
   * using rebuildGroups() if needed for custom serialization.
   */
  groups: Schema.Struct({
    /** Result indices grouped by file path */
    byFile: Schema.Record({ key: Schema.String, value: Schema.Array(Schema.Number) }),
    /** Result indices grouped by rule ID */
    byRule: Schema.Record({ key: Schema.String, value: Schema.Array(Schema.Number) })
  }),
  /** Summary statistics */
  summary: FindingsSummary
})

/**
 * Complete audit context schema.
 *
 * The primary schema for audit.json files generated by effect-migrate.
 * Contains all information needed to understand the current migration state,
 * including findings, configuration, and optional thread references.
 *
 * @category Schema
 * @since 0.1.0
 *
 * @example
 * ```json
 * {
 *   "schemaVersion": "0.1.0",
 *   "revision": 1,
 *   "toolVersion": "0.2.0",
 *   "projectRoot": ".",
 *   "timestamp": "2025-11-06T12:00:00.000Z",
 *   "findings": {
 *     "rules": [
 *       {
 *         "id": "no-async-await",
 *         "kind": "pattern",
 *         "severity": "error",
 *         "message": "Avoid async/await"
 *       }
 *     ],
 *     "files": ["src/index.ts"],
 *     "results": [
 *       {
 *         "rule": 0,
 *         "file": 0,
 *         "range": [10, 5, 10, 25]
 *       }
 *     ],
 *     "groups": {
 *       "byFile": {
 *         "0": [0]
 *       },
 *       "byRule": {
 *         "0": [0]
 *       }
 *     },
 *     "summary": {
 *       "errors": 1,
 *       "warnings": 0,
 *       "info": 0,
 *       "totalFiles": 1,
 *       "totalFindings": 1
 *     }
 *   },
 *   "config": {
 *     "rulesEnabled": ["no-async-await"],
 *     "failOn": ["error"]
 *   }
 * }
 * ```
 */
export const AmpAuditContext = Schema.Struct({
  /** Version of audit.json format */
  schemaVersion: Semver,
  /** Audit revision number (incremented on each write) */
  revision: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1)
  ),
  /** effect-migrate tool version */
  toolVersion: Schema.String,
  /** Project root directory (relative, defaults to ".") */
  projectRoot: Schema.String,
  /** ISO timestamp when context was generated */
  timestamp: Schema.DateTimeUtc,
  /** Grouped findings */
  findings: FindingsGroup,
  /** Config snapshot */
  config: ConfigSnapshot,
  /** Thread references (future feature) */
  threads: Schema.optional(Schema.Array(ThreadReference))
})

/**
 * Delta statistics between checkpoints.
 *
 * Represents the difference in findings between two consecutive audits.
 * Positive values indicate increase, negative values indicate decrease.
 *
 * @category Schema
 * @since 0.2.0
 */
export const DeltaStats = Schema.Struct({
  /** Change in error count */
  errors: Schema.Number,
  /** Change in warning count */
  warnings: Schema.Number,
  /** Change in info count */
  info: Schema.Number,
  /** Change in total findings */
  totalFindings: Schema.Number
})

/**
 * Checkpoint summary for index navigation (last N checkpoints).
 *
 * Lightweight summary for displaying recent checkpoint history in index.json.
 *
 * @category Schema
 * @since 0.2.0
 */
export const CheckpointSummary = Schema.Struct({
  /** Checkpoint ID (filesystem-safe timestamp) */
  id: Schema.String,
  /** ISO timestamp */
  timestamp: Schema.DateTimeUtc,
  /** Amp thread ID if audit was run during a thread */
  thread: Schema.optional(Schema.String),
  /** Findings summary */
  summary: FindingsSummary,
  /** Delta from previous checkpoint */
  delta: Schema.optional(DeltaStats)
})

/**
 * Checkpoint metadata in manifest.json.
 *
 * Full metadata for a checkpoint including path, version info, and optional
 * user-provided categorization (description, tags).
 *
 * @category Schema
 * @since 0.2.0
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
  schemaVersion: Semver,
  /** Tool version */
  toolVersion: Schema.String,
  /** Summary statistics */
  summary: FindingsSummary,
  /** Delta from previous */
  delta: Schema.optional(DeltaStats),
  /** User description (optional) */
  description: Schema.optional(Schema.String),
  /** Tags (optional) */
  tags: Schema.optional(Schema.Array(Schema.String))
})

/**
 * Checkpoint manifest (complete history).
 *
 * Maintains the full list of checkpoints in newest-first order for
 * efficient navigation and delta computation.
 *
 * @category Schema
 * @since 0.2.0
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
 * A complete audit snapshot stored as a checkpoint. This is essentially
 * AmpAuditContext with an additional checkpointId field for tracking.
 *
 * @category Schema
 * @since 0.2.0
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

/**
 * Index schema that points to other context files.
 *
 * The index.json file serves as an entry point to the Amp context directory,
 * providing pointers to all generated files (audit.json, metrics.json, etc.).
 * All artifacts share the same schema version for simplicity.
 *
 * @category Schema
 * @since 0.1.0
 *
 * @example
 * ```json
 * {
 *   "schemaVersion": "0.1.0",
 *   "toolVersion": "0.2.0",
 *   "projectRoot": ".",
 *   "timestamp": "2025-11-06T12:00:00.000Z",
 *   "latestCheckpoint": "2025-11-08T14-30-00Z",
 *   "checkpoints": [
 *     {
 *       "id": "2025-11-08T14-30-00Z",
 *       "timestamp": "2025-11-08T14:30:00.000Z",
 *       "summary": { "errors": 5, "warnings": 10, "info": 2, "totalFiles": 3, "totalFindings": 17 },
 *       "delta": { "errors": -2, "warnings": 1, "info": 0, "totalFindings": -1 }
 *     }
 *   ],
 *   "files": {
 *     "audit": "audit.json",
 *     "checkpoints": "./checkpoints",
 *     "manifest": "./checkpoints/manifest.json",
 *     "badges": "badges.md",
 *     "threads": "threads.json"
 *   }
 * }
 * ```
 */
export const AmpContextIndex = Schema.Struct({
  /** Schema version for all artifacts (single unified version) */
  schemaVersion: Semver,
  /** effect-migrate tool version */
  toolVersion: Schema.String,
  /** Project root directory (relative, defaults to ".") */
  projectRoot: Schema.String,
  /** ISO timestamp when index was generated */
  timestamp: Schema.DateTimeUtc,
  /** Latest checkpoint ID (if checkpoints exist) */
  latestCheckpoint: Schema.optional(Schema.String),
  /** Recent checkpoint history (last 10) */
  checkpoints: Schema.optional(Schema.Array(CheckpointSummary)),
  /** Relative paths to context files */
  files: Schema.Struct({
    /** Path to audit.json */
    audit: Schema.String,
    /** Path to checkpoints directory */
    checkpoints: Schema.optional(Schema.String),
    /** Path to checkpoint manifest */
    manifest: Schema.optional(Schema.String),
    /** Path to metrics.json (future) */
    metrics: Schema.optional(Schema.String),
    /** Path to badges.md */
    badges: Schema.optional(Schema.String),
    /** Path to threads.json (present when threads exist) */
    threads: Schema.optional(Schema.String)
  })
})

/**
 * Thread entry schema for threads.json.
 *
 * Each entry represents an Amp thread URL where migration work occurred,
 * with optional metadata for categorization and filtering.
 *
 * @category Schema
 * @since 0.2.0
 */
export const ThreadEntry = Schema.Struct({
  id: Schema.String,
  url: Schema.String.pipe(
    Schema.pattern(
      /^https:\/\/ampcode\.com\/threads\/T-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    )
  ),
  createdAt: Schema.DateTimeUtc,
  auditRevision: Schema.optional(Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1)
  )).pipe(Schema.withDefaults({ constructor: () => 1, decoding: () => 1 })),
  tags: Schema.optional(Schema.Array(Schema.String)),
  scope: Schema.optional(Schema.Array(Schema.String)),
  description: Schema.optional(Schema.String)
})

/**
 * Threads file schema for threads.json.
 *
 * Root structure containing schema version, tool version, and array of thread entries.
 * Threads are sorted by createdAt descending (newest first).
 *
 * @category Schema
 * @since 0.2.0
 */
export const ThreadsFile = Schema.Struct({
  schemaVersion: Semver,
  toolVersion: Schema.String,
  threads: Schema.Array(ThreadEntry)
})

/**
 * Metrics summary schema.
 *
 * Aggregated statistics about migration progress and violation counts.
 *
 * @category Schema
 * @since 0.2.0
 */
export const MetricsSummary = Schema.Struct({
  /** Total violations across all rules */
  totalViolations: Schema.Number,
  /** Error-level violations */
  errors: Schema.Number,
  /** Warning-level violations */
  warnings: Schema.Number,
  /** Info-level violations */
  info: Schema.Number,
  /** Number of files with violations */
  filesAffected: Schema.Number,
  /** Migration completion percentage (0-100) */
  progressPercentage: Schema.Number
})

/**
 * Per-rule metrics schema.
 *
 * Breakdown of violations by individual rule.
 *
 * @category Schema
 * @since 0.2.0
 */
export const RuleMetrics = Schema.Struct({
  /** Rule ID */
  id: Schema.String,
  /** Number of violations */
  violations: Schema.Number,
  /** Severity level */
  severity: Schema.Literal("error", "warning", "info"),
  /** Files affected by this rule */
  filesAffected: Schema.Number
})

/**
 * Complete metrics context schema.
 *
 * Full metrics output including summary, per-rule breakdown, and optional goals.
 *
 * @category Schema
 * @since 0.2.0
 */
export const AmpMetricsContext = Schema.Struct({
  /** Schema version */
  schemaVersion: Semver,
  /** Audit revision number (links metrics to audit.json) */
  revision: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1)
  ),
  /** Tool version */
  toolVersion: Schema.String,
  /** Project root path */
  projectRoot: Schema.String,
  /** Timestamp */
  timestamp: Schema.DateTimeUtc,
  /** Summary metrics */
  summary: MetricsSummary,
  /** Per-rule breakdown */
  ruleBreakdown: Schema.Array(RuleMetrics),
  /** Migration goals (future) */
  goals: Schema.optional(Schema.Struct({
    targetDate: Schema.optional(Schema.DateTimeUtc),
    targetProgress: Schema.optional(Schema.Number)
  }))
})

/**
 * Extract TypeScript types from schemas.
 *
 * These type exports enable consumers to use the inferred TypeScript types
 * from the Schema definitions without needing to extract them manually.
 *
 * @category Types
 * @since 0.1.0
 */
export type AmpAuditContext = Schema.Schema.Type<typeof AmpAuditContext>
export type AmpContextIndex = Schema.Schema.Type<typeof AmpContextIndex>
export type ThreadReference = Schema.Schema.Type<typeof ThreadReference>
export type ThreadEntry = Schema.Schema.Type<typeof ThreadEntry>
export type ThreadsFile = Schema.Schema.Type<typeof ThreadsFile>
export type MetricsSummary = Schema.Schema.Type<typeof MetricsSummary>
export type RuleMetrics = Schema.Schema.Type<typeof RuleMetrics>
export type AmpMetricsContext = Schema.Schema.Type<typeof AmpMetricsContext>
export type RuleDef = Schema.Schema.Type<typeof RuleDef>
export type CompactRange = Schema.Schema.Type<typeof CompactRange>
export type CompactResult = Schema.Schema.Type<typeof CompactResult>
export type FindingsGroup = Schema.Schema.Type<typeof FindingsGroup>
export type DeltaStats = Schema.Schema.Type<typeof DeltaStats>
export type CheckpointSummary = Schema.Schema.Type<typeof CheckpointSummary>
export type CheckpointMetadata = Schema.Schema.Type<typeof CheckpointMetadata>
export type CheckpointManifest = Schema.Schema.Type<typeof CheckpointManifest>
export type AuditCheckpoint = Schema.Schema.Type<typeof AuditCheckpoint>
