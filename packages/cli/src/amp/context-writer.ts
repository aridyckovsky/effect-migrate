/**
 * Amp Context Writer - Generate structured context files for Amp AI coding agents
 *
 * This module generates MCP-compatible context output that persists migration state
 * across Amp coding sessions, eliminating the need to repeatedly explain migration
 * status in every thread.
 *
 * ## Purpose
 *
 * effect-migrate is purpose-built to work with {@link https://ampcode.com | Amp},
 * providing persistent migration context that survives across coding sessions.
 * This eliminates the need to repeatedly explain "we're migrating to Effect" in
 * every thread.
 *
 * ## Output Structure
 *
 * The writer generates three files in the output directory:
 *
 * - **audit.json**: Complete audit findings grouped by file and rule
 * - **index.json**: Navigation index pointing to other context files
 * - **badges.md**: Markdown badges for README integration
 *
 * ## Usage
 *
 * ```bash
 * effect-migrate audit --amp-out .amp/effect-migrate
 * ```
 *
 * ## Thread References
 *
 * Future versions will track Amp thread URLs where migration work occurred,
 * creating an audit trail of changes. Thread format:
 *
 * ```
 * https://ampcode.com/threads/T-{uuid}
 * ```
 *
 * @see {@link https://github.com/aridyckovsky/effect-migrate#amp-integration | Amp Integration Guide}
 * @module @effect-migrate/cli/amp
 */

import type { Config, RuleResult } from "@effect-migrate/core"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Clock from "effect/Clock"
import * as Console from "effect/Console"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { readThreads } from "./thread-manager.js"

/**
 * Thread reference schema for tracking Amp threads where migration work occurred.
 *
 * @category Schema
 * @since 0.1.0
 * @planned Will be populated by `effect-migrate thread add` command
 */
/**
 * Rule result schema matching RuleResult from @effect-migrate/core.
 *
 * @category Schema
 * @since 0.1.0
 */
export const RuleResultSchema = Schema.Struct({
  /** Unique rule identifier */
  id: Schema.String,
  /** Rule type (pattern, boundary, etc.) */
  ruleKind: Schema.String,
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

export const ThreadReference = Schema.Struct({
  /** Thread URL in format: https://ampcode.com/threads/T-{uuid} */
  url: Schema.String.pipe(
    Schema.pattern(/^https:\/\/ampcode\.com\/threads\/T-[a-f0-9-]+$/)
  ),
  /** ISO timestamp when thread was created or linked */
  timestamp: Schema.DateTimeUtc,
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
 * @category Schema
 * @since 0.1.0
 */
export const FindingsSummary = Schema.Struct({
  /** Number of error-severity findings */
  errors: Schema.Number,
  /** Number of warning-severity findings */
  warnings: Schema.Number,
  /** Total number of files with findings */
  totalFiles: Schema.Number,
  /** Total number of findings across all files */
  totalFindings: Schema.Number
})

/**
 * Configuration snapshot included in context output.
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
 * Grouped findings by file and by rule.
 *
 * @category Schema
 * @since 0.1.0
 */
export const FindingsGroup = Schema.Struct({
  /** Findings grouped by file path (POSIX-style) */
  byFile: Schema.Record({ key: Schema.String, value: Schema.Array(RuleResultSchema) }),
  /** Findings grouped by rule ID */
  byRule: Schema.Record({ key: Schema.String, value: Schema.Array(RuleResultSchema) }),
  /** Summary statistics */
  summary: FindingsSummary
})

/**
 * Complete audit context schema.
 *
 * @category Schema
 * @since 0.1.0
 */
export const AmpAuditContext = Schema.Struct({
  /** Context format version */
  version: Schema.Number,
  /** effect-migrate tool version */
  toolVersion: Schema.String,
  /** Absolute path to project root */
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
 * Index schema that points to other context files.
 *
 * @category Schema
 * @since 0.1.0
 */
export const AmpContextIndex = Schema.Struct({
  /** Index format version */
  version: Schema.Number,
  /** Schema version for compatibility tracking */
  schemaVersion: Schema.String,
  /** effect-migrate tool version */
  toolVersion: Schema.String,
  /** Absolute path to project root */
  projectRoot: Schema.String,
  /** ISO timestamp when index was generated */
  timestamp: Schema.DateTimeUtc,
  /** Relative paths to context files */
  files: Schema.Struct({
    /** Path to audit.json */
    audit: Schema.String,
    /** Path to metrics.json (future) */
    metrics: Schema.optional(Schema.String),
    /** Path to badges.md */
    badges: Schema.optional(Schema.String)
  })
})

/**
 * Extract TypeScript types from schemas.
 *
 * @category Types
 * @since 0.1.0
 */
export type AmpAuditContext = typeof AmpAuditContext.Type
export type AmpContextIndex = typeof AmpContextIndex.Type
export type ThreadReference = typeof ThreadReference.Type

/**
 * Write Amp context files to the specified output directory.
 *
 * Generates multiple context files:
 * - `audit.json`: Complete audit findings with grouping
 * - `index.json`: Navigation index
 * - `badges.md`: Markdown badges for README
 *
 * @param outputDir - Directory to write context files (created if missing)
 * @param results - Rule violation results from audit
 * @param config - Migration configuration
 * @returns Effect that writes context files and logs progress
 *
 * @category Effect
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * import { writeAmpContext } from "@effect-migrate/cli/amp"
 *
 * const program = Effect.gen(function* () {
 *   const results = yield* runAudit()
 *   const config = yield* loadConfig()
 *
 *   yield* writeAmpContext(".amp/effect-migrate", results, config)
 * })
 * ```
 */
export const writeAmpContext = (outputDir: string, results: RuleResult[], config: Config) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Ensure output directory exists
    yield* fs.makeDirectory(outputDir, { recursive: true }).pipe(Effect.catchAll(() => Effect.void))

    const now = yield* Clock.currentTimeMillis
    const timestamp = DateTime.unsafeMake(now)
    const projectRoot = process.cwd()

    // Group findings by file and rule
    const byFile: Record<string, RuleResult[]> = {}
    const byRule: Record<string, RuleResult[]> = {}

    for (const result of results) {
      // Group by file (normalize to POSIX paths)
      if (result.file) {
        const normalizedFile = result.file.split(path.sep).join("/")
        if (!byFile[normalizedFile]) {
          byFile[normalizedFile] = []
        }
        byFile[normalizedFile].push(result)
      }

      // Group by rule
      if (!byRule[result.id]) {
        byRule[result.id] = []
      }
      byRule[result.id].push(result)
    }

    const errors = results.filter(r => r.severity === "error").length
    const warnings = results.filter(r => r.severity === "warning").length

    // Read and attach threads if they exist
    const threadsFile = yield* readThreads(outputDir).pipe(
      Effect.catchAll(() => Effect.succeed({ version: 1, threads: [] }))
    )

    // Create audit context (validated by schema) with conditional threads
    const auditContext: AmpAuditContext = {
      version: 1,
      toolVersion: "0.1.0",
      projectRoot,
      timestamp,
      findings: {
        byFile,
        byRule,
        summary: {
          errors,
          warnings,
          totalFiles: Object.keys(byFile).length,
          totalFindings: results.length
        }
      },
      config: {
        rulesEnabled: Array.from(new Set(results.map(r => r.id))),
        failOn: [...(config.report?.failOn ?? ["error"])]
      },
      ...([...threadsFile.threads].length > 0 && {
        threads: [...threadsFile.threads].map(entry => ({
          url: entry.url,
          timestamp: entry.createdAt,
          ...(entry.description && { description: entry.description }),
          ...(entry.tags && entry.tags.length > 0 && { tags: [...entry.tags] }),
          ...(entry.scope && entry.scope.length > 0 && { scope: [...entry.scope] })
        }))
      })
    }

    // Encode audit context to JSON
    const encodeAudit = Schema.encodeSync(AmpAuditContext)
    const auditJson = encodeAudit(auditContext)

    // Write audit.json
    const auditPath = path.join(outputDir, "audit.json")
    yield* fs.writeFileString(auditPath, JSON.stringify(auditJson, null, 2))

    // Create index (validated by schema)
    const index: AmpContextIndex = {
      version: 1,
      schemaVersion: "1.0.0",
      toolVersion: "0.1.0",
      projectRoot,
      timestamp,
      files: {
        audit: "audit.json",
        badges: "badges.md"
      }
    }

    // Encode index to JSON
    const encodeIndex = Schema.encodeSync(AmpContextIndex)
    const indexJson = encodeIndex(index)

    // Write index.json
    const indexPath = path.join(outputDir, "index.json")
    yield* fs.writeFileString(indexPath, JSON.stringify(indexJson, null, 2))

    // Generate badges.md for README integration
    const errorBadge = errors === 0
      ? "![errors](https://img.shields.io/badge/errors-0-success)"
      : `![errors](https://img.shields.io/badge/errors-${errors}-critical)`

    const warningBadge = warnings === 0
      ? "![warnings](https://img.shields.io/badge/warnings-0-success)"
      : `![warnings](https://img.shields.io/badge/warnings-${warnings}-yellow)`

    const badgesContent = `# Migration Status

${errorBadge} ${warningBadge}

Last updated: ${new Date().toLocaleString()}

## Summary

- **Errors**: ${errors}
- **Warnings**: ${warnings}
- **Files checked**: ${Object.keys(byFile).length}

## Using with Amp

Reference this context in your Amp threads:

\`\`\`
I'm working on migrating this project to Effect.
Read @${outputDir}/audit.json for current migration state.
\`\`\`

Amp will automatically understand:
- Which files have migration issues
- What patterns to avoid (based on active rules)
- Migration progress and severity breakdown
`

    const badgesPath = path.join(outputDir, "badges.md")
    yield* fs.writeFileString(badgesPath, badgesContent)

    // Log completion
    yield* Console.log(`  ✓ audit.json`)
    yield* Console.log(`  ✓ index.json`)
    yield* Console.log(`  ✓ badges.md`)
  })
