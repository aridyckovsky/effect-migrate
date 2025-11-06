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
import { SCHEMA_VERSIONS, Semver } from "@effect-migrate/core/schema"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Clock from "effect/Clock"
import * as Console from "effect/Console"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { readThreads, type ThreadEntry, type ThreadsFile } from "./thread-manager.js"

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
  /** Findings grouped by file path (relative to project root, POSIX-style) */
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
 * Index schema that points to other context files.
 *
 * @category Schema
 * @since 0.1.0
 */
export const AmpContextIndex = Schema.Struct({
  /** Version of index.json format itself */
  schemaVersion: Semver,
  /** Schema versions for generated artifacts */
  versions: Schema.optional(
    Schema.Struct({
      /** audit.json format version */
      audit: Semver,
      /** metrics.json format version */
      metrics: Schema.optional(Semver),
      /** threads.json format version */
      threads: Schema.optional(Semver)
    })
  ),
  /** effect-migrate tool version */
  toolVersion: Schema.String,
  /** Project root directory (relative, defaults to ".") */
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
    badges: Schema.optional(Schema.String),
    /** Path to threads.json (present when threads exist) */
    threads: Schema.optional(Schema.String)
  })
})

/**
 * Extract TypeScript types from schemas.
 *
 * @category Types
 * @since 0.1.0
 */
export type AmpAuditContext = Schema.Schema.Type<typeof AmpAuditContext>
export type AmpContextIndex = Schema.Schema.Type<typeof AmpContextIndex>
export type ThreadReference = Schema.Schema.Type<typeof ThreadReference>

/**
 * Transform ThreadEntry to ThreadReference format.
 *
 * Transforms ThreadEntry (from threads.json) to ThreadReference (for audit.json):
 * - Renames createdAt to timestamp
 * - Preserves optional fields (description, tags, scope)
 * - Handles empty arrays by omitting them
 *
 * **Type Safety:** This function is type-safe without Schema transformation because:
 * 1. Both ThreadEntry and ThreadReference are defined with Schema (compile-time validated)
 * 2. The mapping preserves readonly semantics with proper conditional spreading
 * 3. exactOptionalPropertyTypes is satisfied by conditional spreading (no undefined assignment)
 * 4. The returned type is inferred and validated against ThreadReference schema
 *
 * **Why No Schema.transform:**
 * Schema.transformOrFail would be redundant here since we're mapping between two
 * already-validated schema types. The function signature provides type safety at
 * compile time, and the ThreadReference schema validates at encode time in writeAmpContext.
 *
 * @param entry - Thread entry from threads.json
 * @returns ThreadReference object for audit.json
 *
 * @category Pure Function
 * @since 0.2.0
 */
const threadEntryToReference = (entry: ThreadEntry): ThreadReference => ({
  url: entry.url,
  timestamp: entry.createdAt,
  ...(entry.description && { description: entry.description }),
  ...(entry.tags && entry.tags.length > 0 && { tags: entry.tags }),
  ...(entry.scope && entry.scope.length > 0 && { scope: entry.scope })
})

/**
 * Transform ThreadsFile to ReadonlyArray<ThreadReference>.
 *
 * Maps thread entries from threads.json format to audit.json format using
 * type-safe transformation. This is a pure function with no side effects.
 *
 * @param threadsFile - ThreadsFile from thread-manager
 * @returns ReadonlyArray of ThreadReference objects
 *
 * @category Pure Function
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const threadsFile = { version: 1, threads: [...] }
 * const auditThreads = toAuditThreads(threadsFile)
 * ```
 */
export const toAuditThreads = (threadsFile: ThreadsFile): ReadonlyArray<ThreadReference> => {
  return threadsFile.threads.map(threadEntryToReference)
}

/**
 * Package JSON schema for validation.
 *
 * @category Schema
 * @since 0.2.0
 */
const PackageJson = Schema.Struct({
  version: Schema.String,
  effectMigrate: Schema.optional(Schema.Struct({ schemaVersion: Schema.String }))
})
type PackageJson = Schema.Schema.Type<typeof PackageJson>

/**
 * Package metadata interface.
 *
 * @category Types
 * @since 0.2.0
 */
export interface PackageMeta {
  readonly toolVersion: string
  readonly schemaVersion: string
}

/**
 * Get package metadata from package.json.
 *
 * Reads both version and schemaVersion from package.json at runtime.
 * Falls back to "1.0.0" for schemaVersion if effectMigrate.schemaVersion is not defined.
 *
 * @returns Effect containing toolVersion and schemaVersion
 * @category Effect
 * @since 0.2.0
 */
const getPackageMeta = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  // Resolve path to package.json relative to this file
  // In production (build): build/esm/amp/context-writer.js -> ../../../package.json
  // In test (tsx): src/amp/context-writer.ts (via tsx) -> ../../package.json
  const dirname = path.dirname(new URL(import.meta.url).pathname)

  // Try production path first (3 levels up)
  let packageJsonPath = path.join(dirname, "..", "..", "..", "package.json")
  const prodExists = yield* fs.exists(packageJsonPath)

  // If not found, try dev/test path (2 levels up)
  if (!prodExists) {
    packageJsonPath = path.join(dirname, "..", "..", "package.json")
  }

  const content = yield* fs.readFileString(packageJsonPath)
  const pkg = yield* Effect.try({
    try: () => JSON.parse(content) as unknown,
    catch: e => new Error(`Invalid JSON in ${packageJsonPath}: ${String(e)}`)
  }).pipe(Effect.flatMap(Schema.decodeUnknown(PackageJson)))

  return {
    toolVersion: pkg.version,
    schemaVersion: pkg.effectMigrate?.schemaVersion ?? "1.0.0"
  }
})

/**
 * Get next audit revision number by incrementing existing revision.
 *
 * Attempts to load existing audit.json to extract current revision,
 * incrementing it by 1. Falls back to revision 1 for:
 * - New audits (file doesn't exist)
 * - Legacy audits (missing revision field)
 * - Parse failures (invalid JSON or schema)
 *
 * Uses Effect combinators (no try/catch inside Effect.gen) for proper error handling.
 *
 * @param outputDir - Directory where audit.json is stored
 * @returns Effect containing the next revision number
 * @category Effect
 * @since 0.2.0
 */
const getNextAuditRevision = (outputDir: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const auditPath = path.join(outputDir, "audit.json")

    // Try to read existing audit to get current revision
    const currentRevision = yield* fs.readFileString(auditPath).pipe(
      Effect.flatMap(content =>
        Effect.try({
          try: () => JSON.parse(content) as unknown,
          catch: e => new Error(`Invalid JSON in ${auditPath}: ${String(e)}`)
        })
      ),
      Effect.map((data: any) => {
        // Extract revision field, default to 0 for legacy files without revision
        return typeof data.revision === "number" ? data.revision : 0
      }),
      Effect.catchAll(() => Effect.succeed(0))
    )

    return currentRevision + 1
  })

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
    const cwd = process.cwd()

    // Get dynamic metadata from package.json
    const { toolVersion } = yield* getPackageMeta

    // Get next audit revision (increments on each run)
    const revision = yield* getNextAuditRevision(outputDir)

    // Group findings by file and rule
    const byFile: Record<string, RuleResult[]> = {}
    const byRule: Record<string, RuleResult[]> = {}

    for (const result of results) {
      // Group by file (convert to relative paths and normalize to POSIX)
      if (result.file) {
        const relativePath = path.relative(cwd, result.file)
        const normalizedFile = relativePath.split(path.sep).join("/")
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
      Effect.catchAll(e =>
        Console.error(`Failed to read threads: ${String(e)}`).pipe(
          Effect.map(() => ({ version: 1, threads: [] }))
        )
      )
    )

    // Transform threads using type-safe mapping (validated by ThreadReference schema at encode time)
    const auditThreads = toAuditThreads(threadsFile)

    // Create audit context (validated by schema) with conditional threads
    const auditContext: AmpAuditContext = {
      schemaVersion: SCHEMA_VERSIONS.audit,
      revision,
      toolVersion,
      projectRoot: ".",
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
      ...(auditThreads.length > 0 && { threads: auditThreads })
    }

    // Encode audit context to JSON
    const encodeAudit = Schema.encodeSync(AmpAuditContext)
    const auditJson = encodeAudit(auditContext)

    // Write audit.json
    const auditPath = path.join(outputDir, "audit.json")
    yield* fs.writeFileString(auditPath, JSON.stringify(auditJson, null, 2))

    // Create index (validated by schema)
    const index: AmpContextIndex = {
      schemaVersion: SCHEMA_VERSIONS.index,
      versions: {
        audit: SCHEMA_VERSIONS.audit
      },
      toolVersion,
      projectRoot: ".",
      timestamp,
      files: {
        audit: "audit.json",
        badges: "badges.md",
        ...(auditThreads.length > 0 && { threads: "threads.json" })
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
    yield* Console.log(`  ✓ audit.json (revision ${revision})`)
    yield* Console.log(`  ✓ index.json`)
    yield* Console.log(`  ✓ badges.md`)
  })

/**
 * Update index.json to include threads.json reference if threads exist.
 *
 * This is a lightweight operation that:
 * 1. Reads the current index.json
 * 2. Checks if threads.json has entries
 * 3. Updates the files.threads field accordingly
 *
 * Used by the `thread add` command to ensure index.json stays in sync
 * without requiring a full audit re-run.
 *
 * @param outputDir - Directory containing index.json and threads.json
 * @returns Effect that updates the index file
 *
 * @category Effect
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * // After adding a thread
 * yield* addThread(outputDir, { url, tags, scope })
 * yield* updateIndexWithThreads(outputDir)
 * ```
 */
export const updateIndexWithThreads = (
  outputDir: string
): Effect.Effect<void, Error, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const indexPath = path.join(outputDir, "index.json")

    // Check if index.json exists
    const indexExists = yield* fs.exists(indexPath)
    if (!indexExists) {
      // No index.json yet - will be created by audit/metrics
      return
    }

    // Read current index.json
    const indexContent = yield* fs.readFileString(indexPath)
    const indexData = JSON.parse(indexContent)

    // Read threads.json to check if it has entries
    const threadsFile = yield* readThreads(outputDir)
    const hasThreads = threadsFile.threads.length > 0

    // Update files.threads field based on whether threads exist
    // Keep all existing fields, just update the threads reference
    const updatedIndex = {
      ...indexData,
      files: {
        ...indexData.files,
        ...(hasThreads ? { threads: "threads.json" } : {})
      }
    }

    // Write updated index.json (no schema validation - preserve existing structure)
    yield* fs.writeFileString(indexPath, JSON.stringify(updatedIndex, null, 2))
  })
