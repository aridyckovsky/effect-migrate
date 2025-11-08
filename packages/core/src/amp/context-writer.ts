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
 * @module @effect-migrate/core/amp
 */

import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Clock from "effect/Clock"
import * as Console from "effect/Console"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { RuleResult } from "../rules/types.js"
import {
  AmpAuditContext,
  type AmpAuditContext as AmpAuditContextType,
  AmpContextIndex,
  type AmpContextIndex as AmpContextIndexType,
  ThreadEntry,
  type ThreadReference as ThreadReferenceType,
  ThreadsFile
} from "../schema/amp.js"
import type { Config } from "../schema/Config.js"
import { SCHEMA_VERSION } from "../schema/versions.js"
import { writeMetricsContext } from "./metrics-writer.js"
import { normalizeResults } from "./normalizer.js"
import { getPackageMeta } from "./package-meta.js"
import { addThread, readThreads } from "./thread-manager.js"

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
const threadEntryToReference = (entry: ThreadEntry): ThreadReferenceType => ({
  url: entry.url,
  timestamp: entry.createdAt,
  auditRevision: entry.auditRevision ?? 1,
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
export const toAuditThreads = (threadsFile: ThreadsFile): ReadonlyArray<ThreadReferenceType> => {
  return threadsFile.threads.map(threadEntryToReference)
}

/**
 * Get next audit revision number by incrementing existing revision.
 *
 * Attempts to load existing audit.json to extract current revision,
 * incrementing it by 1. Falls back to revision 1 for:
 * - New audits (file doesn't exist)
 * - Invalid audits (schema decode fails)
 *
 * **No legacy support**: Files without proper schema are treated as revision 0.
 *
 * Uses Schema.decodeUnknown for strict validation (no duck-typing).
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

    // Try to read and decode existing audit to get current revision
    const currentRevision = yield* fs.readFileString(auditPath).pipe(
      Effect.flatMap(content =>
        Effect.try({
          try: () => JSON.parse(content) as unknown,
          catch: e => new Error(`Invalid JSON in ${auditPath}: ${String(e)}`)
        })
      ),
      Effect.flatMap(Schema.decodeUnknown(AmpAuditContext)),
      Effect.map(audit => audit.revision),
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
 * import { writeAmpContext } from "@effect-migrate/core/amp"
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

    // Pre-normalize file paths before calling normalizer
    const normalizedInput: RuleResult[] = results.map(r =>
      r.file
        ? {
          ...r,
          file: path.relative(cwd, r.file).split(path.sep).join("/")
        }
        : r
    )
    const findings = normalizeResults(normalizedInput)

    // Auto-detect current Amp thread and add it to threads.json
    const ampThreadId = process.env.AMP_CURRENT_THREAD_ID
    if (ampThreadId) {
      const threadUrl = `https://ampcode.com/threads/${ampThreadId}`

      // Generate smart tags and description from findings
      const { errors, warnings, info } = findings.summary
      const filesCount = findings.files.length

      // Count rule occurrences to find top 3 most frequent
      const ruleCounts = new Map<number, number>()
      for (const result of findings.results) {
        ruleCounts.set(result.rule, (ruleCounts.get(result.rule) || 0) + 1)
      }
      const topRules = Array.from(ruleCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([ruleIndex]) => `rule:${findings.rules[ruleIndex].id}`)

      // Build tags: base + severity counts + top rules
      const tags = [
        "amp-auto-detected",
        "audit",
        `errors:${errors}`,
        `warnings:${warnings}`,
        ...(info > 0 ? [`info:${info}`] : []),
        ...topRules
      ]

      // Build description
      const severityParts = [
        `${errors} error${errors !== 1 ? "s" : ""}`,
        `${warnings} warning${warnings !== 1 ? "s" : ""}`,
        ...(info > 0 ? [`${info} info`] : [])
      ]
      const description = `Audit revision ${revision} — ${
        severityParts.join(", ")
      } across ${filesCount} file${filesCount !== 1 ? "s" : ""}`

      yield* addThread(
        outputDir,
        {
          url: threadUrl,
          tags,
          description
        },
        revision
      ).pipe(
        Effect.catchAll(e =>
          Console.warn(`Failed to auto-add Amp thread: ${String(e)}`).pipe(
            Effect.map(() => undefined)
          )
        )
      )
    }

    // Read threads file to get current thread entry (if any)
    const threadsFile = yield* readThreads(outputDir)

    // Find the thread entry for current revision (if it exists)
    const currentThread = threadsFile.threads.find(t => t.auditRevision === revision)

    // Transform current thread only (not all threads)
    const auditThreads = currentThread
      ? toAuditThreads({
        schemaVersion: threadsFile.schemaVersion,
        toolVersion: threadsFile.toolVersion,
        threads: [currentThread]
      })
      : []

    // Create audit context (validated by schema) with conditional threads
    const auditContext: AmpAuditContextType = {
      schemaVersion: SCHEMA_VERSION,
      revision,
      toolVersion,
      projectRoot: ".",
      timestamp,
      findings,
      config: {
        rulesEnabled: Array.from(new Set(results.map(r => r.id))).sort(),
        failOn: [...(config.report?.failOn ?? ["error"])].sort()
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
    const index: AmpContextIndexType = {
      schemaVersion: SCHEMA_VERSION,
      toolVersion,
      projectRoot: ".",
      timestamp,
      files: {
        audit: "audit.json",
        metrics: "metrics.json",
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

    /**
     * Generate badge with severity-consistent coloring.
     *
     * Color scheme:
     * - error: always red (matches severity)
     * - warning: always orange (matches severity)
     * - info: always blue (matches severity)
     * - total/rules: blue (informational)
     *
     * DRY helper to avoid badge generation duplication.
     */
    const makeBadge = (label: string, count: number, color: string) =>
      `![${label}](https://img.shields.io/badge/${label}-${count}-${color})`

    const errorBadge = makeBadge("errors", findings.summary.errors, "red")
    const warningBadge = makeBadge("warnings", findings.summary.warnings, "orange")
    const infoBadge = makeBadge("info", findings.summary.info, "blue")
    const totalBadge = makeBadge(
      "total_findings",
      findings.summary.errors + findings.summary.warnings + findings.summary.info,
      "blue"
    )
    const rulesBadge = makeBadge("rules", findings.rules.length, "blue")

    const badgesContent = `# Effect Migration Status

${errorBadge} ${warningBadge} ${infoBadge} ${totalBadge} ${rulesBadge}

**Last updated:** ${new Date().toLocaleString()}  
**Audit revision:** ${revision}

---

## Summary

| Metric | Count |
|--------|-------|
| Errors | ${findings.summary.errors} |
| Warnings | ${findings.summary.warnings} |
| Info | ${findings.summary.info} |
| Total findings | ${findings.summary.errors + findings.summary.warnings + findings.summary.info} |
| Files affected | ${findings.files.length} |
| Active rules | ${findings.rules.length} |

## Top Issues

${
      findings.rules
        .slice(0, 5)
        .map(rule => `- **[${rule.id}]** (${rule.severity}): ${rule.message}`)
        .join("\n")
    }

---

## Using with Amp

Reference this migration context in your Amp threads:

\`\`\`
I'm working on migrating this project to Effect.
Read @${outputDir}/index.json for the complete migration context.
\`\`\`

**Amp will automatically understand:**
- Current audit findings and violations ([audit.json](./audit.json))
- Migration metrics and progress ([metrics.json](./metrics.json))
- Historical threads where work occurred ([threads.json](./threads.json))
- What patterns to avoid (based on active rules)

This context persists across threads, eliminating the need to re-explain migration status.
`

    const badgesPath = path.join(outputDir, "badges.md")
    yield* fs.writeFileString(badgesPath, badgesContent)

    // Write metrics.json
    yield* writeMetricsContext(outputDir, results, config, revision)

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
