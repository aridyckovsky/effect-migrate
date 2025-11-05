/**
 * JSON Formatter - Machine-readable audit output
 *
 * This module formats audit results as structured JSON suitable for
 * programmatic consumption by CI/CD systems, editors, and automation tools.
 * Output includes versioning and summary statistics.
 *
 * @module @effect-migrate/cli/formatters/json
 * @since 0.1.0
 */

import type { RuleResult } from "@effect-migrate/core"
import type { Config } from "@effect-migrate/core"

/**
 * Structured JSON output format for audit results.
 *
 * Contains versioned findings grouped by file with summary statistics.
 * Designed for machine parsing and integration with external tools.
 *
 * @category Schema
 * @since 0.1.0
 */
export interface AuditJsonOutput {
  /** Output format version for compatibility tracking */
  version: number
  /** effect-migrate tool version that generated this output */
  toolVersion: string
  /** ISO 8601 timestamp when audit ran */
  timestamp: string
  /** Grouped findings and summary statistics */
  findings: {
    /** Findings grouped by file path */
    byFile: Record<string, RuleResult[]>
    /** Aggregate summary statistics */
    summary: {
      /** Count of error-severity findings */
      errors: number
      /** Count of warning-severity findings */
      warnings: number
      /** Count of files with findings */
      totalFiles: number
      /** Total count of all findings */
      totalFindings: number
    }
  }
}

/**
 * Format audit results as structured JSON.
 *
 * Produces machine-readable JSON output with versioning and summary statistics.
 * Output is grouped by file path for easier programmatic navigation.
 *
 * @param results - Array of rule violation results from audit
 * @param config - Migration configuration (currently unused but reserved for future options)
 * @returns Structured JSON object ready for serialization
 *
 * @category Formatter
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const json = formatJsonOutput(results, config)
 * console.log(JSON.stringify(json, null, 2))
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
 * //       "errors": 5,
 * //       "warnings": 3,
 * //       "totalFiles": 2,
 * //       "totalFindings": 8
 * //     }
 * //   }
 * // }
 * ```
 */
export const formatJsonOutput = (results: RuleResult[], config: Config): AuditJsonOutput => {
  const byFile: Record<string, RuleResult[]> = {}

  for (const result of results) {
    if (result.file) {
      if (!byFile[result.file]) {
        byFile[result.file] = []
      }
      byFile[result.file].push(result)
    }
  }

  const errors = results.filter(r => r.severity === "error").length
  const warnings = results.filter(r => r.severity === "warning").length
  const totalFiles = Object.keys(byFile).length

  return {
    version: 1,
    toolVersion: "0.1.0",
    timestamp: new Date().toISOString(),
    findings: {
      byFile,
      summary: {
        errors,
        warnings,
        totalFiles,
        totalFindings: results.length
      }
    }
  }
}
