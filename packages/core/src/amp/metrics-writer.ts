/**
 * Metrics context writer for Amp integration
 *
 * Generates metrics.json with migration progress tracking and per-rule breakdown.
 * Complements audit.json with time-series metrics for tracking migration velocity.
 *
 * @module @effect-migrate/core/amp/metrics-writer
 * @since 0.2.0
 */

import type { Config, RuleResult } from "@effect-migrate/core"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Clock from "effect/Clock"
import * as Console from "effect/Console"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as AmpSchema from "../schema/amp.js"
import { SCHEMA_VERSION } from "../schema/versions.js"
import { getPackageMeta } from "./package-meta.js"

// Local type alias for internal use
type AmpMetricsContext = AmpSchema.AmpMetricsContext

/**
 * Write metrics context to the Amp output directory.
 *
 * Generates metrics.json with migration progress tracking and per-rule breakdown.
 * Also updates index.json to include metrics file reference.
 *
 * @param outputDir - Directory to write metrics.json
 * @param results - Rule violation results from audit
 * @param config - Migration configuration (reserved for future use with migration goals)
 * @param revision - Audit revision number (links metrics to audit.json)
 * @returns Effect that writes metrics files
 *
 * @category Effect
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const results = yield* runAudit()
 *   const config = yield* loadConfig()
 *
 *   yield* writeMetricsContext(".amp/effect-migrate", results, config, 1)
 * })
 * ```
 *
 * @remarks
 * The `config` parameter is currently unused but reserved for future features:
 * - Mapping `config.migrations[].goal` to AmpMetricsContext.goals
 * - Using `config.paths.root` for project root path
 * - Extracting concurrency settings or other metadata
 */
export const writeMetricsContext = (
  outputDir: string,
  results: RuleResult[],
  config: Config,
  revision: number
) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Ensure output directory exists
    yield* fs.makeDirectory(outputDir, { recursive: true }).pipe(Effect.catchAll(() => Effect.void))

    const now = yield* Clock.currentTimeMillis
    const timestamp = DateTime.unsafeMake(now)
    const projectRoot = process.cwd()

    // Get dynamic metadata from package.json
    const { toolVersion } = yield* getPackageMeta

    // Calculate metrics
    const errors = results.filter(r => r.severity === "error").length
    const warnings = results.filter(r => r.severity === "warning").length
    const info = results.filter(r => r.severity === "info").length
    const filesAffected = new Set(results.map(r => r.file).filter(Boolean)).size

    // Attempt to read previous metrics for baseline calculation
    const previousMetricsPath = path.join(outputDir, "metrics.json")
    const previousMetrics = yield* fs.readFileString(previousMetricsPath).pipe(
      Effect.flatMap(content =>
        Effect.try({
          try: () => {
            const data = JSON.parse(content)
            return data
          },
          catch: () => new Error("Invalid JSON")
        }).pipe(Effect.flatMap(data => Schema.decodeUnknown(AmpSchema.AmpMetricsContext)(data)))
      ),
      Effect.catchAll(() => Effect.succeed(undefined))
    )

    /**
     * Calculate migration progress percentage with revision-aware baseline.
     *
     * Progress is calculated relative to the previous revision's violation count:
     * - No previous metrics: totalViolations === 0 ? 100% : 0%
     * - Previous baseline was 0: totalViolations === 0 ? 100% : 0%
     * - Previous baseline > 0: clamp(0, 100, round(100 * (1 - current / previous)))
     *
     * This provides accurate progress tracking as violations are resolved over time.
     *
     * Examples:
     * - 100 → 50 violations: 50% progress
     * - 100 → 0 violations: 100% progress
     * - 50 → 75 violations: 0% progress (regression, clamped)
     */
    const totalViolations = results.length
    const previousTotal = previousMetrics?.summary.totalViolations
    const progressPercentage = previousTotal === undefined || previousTotal === 0
      ? (totalViolations === 0 ? 100 : 0)
      : Math.max(0, Math.min(100, Math.round(100 * (1 - totalViolations / previousTotal))))

    // Group by rule
    const ruleMap = new Map<string, RuleResult[]>()
    for (const result of results) {
      const existing = ruleMap.get(result.id) ?? []
      existing.push(result)
      ruleMap.set(result.id, existing)
    }

    const ruleBreakdown = Array.from(ruleMap.entries()).map(([id, violations]) => ({
      id,
      violations: violations.length,
      severity: violations[0].severity,
      filesAffected: new Set(violations.map(v => v.file).filter(Boolean)).size
    }))

    const metricsContext: AmpMetricsContext = {
      schemaVersion: SCHEMA_VERSION,
      revision,
      toolVersion,
      projectRoot,
      timestamp,
      summary: {
        totalViolations,
        errors,
        warnings,
        info,
        filesAffected,
        progressPercentage
      },
      ruleBreakdown
    }

    // Encode and write
    const encode = Schema.encodeSync(AmpSchema.AmpMetricsContext)
    const metricsJson = encode(metricsContext)

    const metricsPath = path.join(outputDir, "metrics.json")
    yield* fs.writeFileString(metricsPath, JSON.stringify(metricsJson, null, 2))

    yield* Console.log(`  ✓ metrics.json`)
  })
