/**
 * JSON Formatter - CLI stdout JSON output for audit results
 *
 * This module formats audit results as structured JSON for CLI stdout consumption,
 * suitable for programmatic consumption by CI/CD systems, editors, and automation tools.
 *
 * **Important:** This is distinct from `audit.json` file output. This formatter produces
 * the JSON structure written to stdout when `--json` flag is used. The `audit.json` file
 * has additional MCP-compatible context and references to thread metadata.
 *
 * @module @effect-migrate/cli/formatters/json
 * @since 0.1.0
 */

import type { Config, RuleResult } from "@effect-migrate/core"
import { getPackageMeta } from "@effect-migrate/core/amp"
import type * as FileSystem from "@effect/platform/FileSystem"
import type * as Path from "@effect/platform/Path"
import * as Clock from "effect/Clock"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

/**
 * CLI JSON output format schema.
 *
 * This schema validates the structured JSON output written to stdout when
 * using the `--json` flag with the audit command.
 *
 * @category Schema
 * @since 0.2.0
 */
export class CliJsonOutput extends Schema.Class<CliJsonOutput>("CliJsonOutput")({
  /** Output format version for compatibility tracking */
  version: Schema.Number,
  /** effect-migrate tool version that generated this output */
  toolVersion: Schema.String,
  /** ISO 8601 timestamp when audit ran */
  timestamp: Schema.String,
  /** Grouped findings and summary statistics */
  findings: Schema.Struct({
    /** Findings grouped by file path */
    byFile: Schema.Record({ key: Schema.String, value: Schema.Any }),
    /** Aggregate summary statistics */
    summary: Schema.Struct({
      /** Count of info-severity findings */
      info: Schema.Number,
      /** Count of warning-severity findings */
      warnings: Schema.Number,
      /** Count of error-severity findings */
      errors: Schema.Number,
      /** Count of files with findings */
      totalFiles: Schema.Number,
      /** Total count of all findings */
      totalFindings: Schema.Number
    })
  })
}) {}

/**
 * Format audit results as structured JSON for CLI stdout.
 *
 * Produces machine-readable JSON output with versioning and summary statistics.
 * Output is grouped by file path for easier programmatic navigation.
 *
 * **Note:** This is CLI stdout JSON format. For Amp context JSON (`audit.json`),
 * see `@effect-migrate/core/amp/context-writer`.
 *
 * @param results - Array of rule violation results from audit
 * @param config - Migration configuration (currently unused but reserved for future options)
 * @returns Effect yielding structured JSON output object
 *
 * @category Formatter
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const jsonEffect = formatJsonOutput(results, config)
 * const json = yield* jsonEffect
 * const jsonString = JSON.stringify(json, null, 2)
 * // Output:
 * // {
 * //   "version": 1,
 * //   "toolVersion": "0.2.0",
 * //   "timestamp": "2025-11-05T12:00:00.000Z",
 * //   "findings": {
 * //     "byFile": {
 * //       "src/api/users.ts": [...]
 * //     },
 * //     "summary": {
 * //       "info": 2,
 * //       "warnings": 3,
 * //       "errors": 5,
 * //       "totalFiles": 2,
 * //       "totalFindings": 10
 * //     }
 * //   }
 * // }
 * ```
 */
export const formatJsonOutput = (
  results: readonly RuleResult[],
  config: Config
): Effect.Effect<CliJsonOutput, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    // Group results by file
    const byFile: Record<string, RuleResult[]> = {}
    for (const result of results) {
      if (result.file) {
        if (!byFile[result.file]) {
          byFile[result.file] = []
        }
        byFile[result.file].push(result)
      }
    }

    // Count by severity
    const info = results.filter(r => r.severity === "info").length
    const warnings = results.filter(r => r.severity === "warning").length
    const errors = results.filter(r => r.severity === "error").length
    const totalFiles = Object.keys(byFile).length

    // Get current timestamp using Clock and DateTime
    const millis = yield* Clock.currentTimeMillis
    const dateTime = DateTime.unsafeMake(millis)
    const timestamp = DateTime.formatIso(dateTime)

    // Get package metadata (toolVersion)
    const { toolVersion } = yield* getPackageMeta

    // Build output object matching CliJsonOutput schema
    return new CliJsonOutput({
      version: 1,
      toolVersion,
      timestamp,
      findings: {
        byFile,
        summary: {
          info,
          warnings,
          errors,
          totalFiles,
          totalFindings: results.length
        }
      }
    })
  })
