/**
 * Metrics context writer for Amp integration
 *
 * Generates metrics.json with migration progress tracking and per-rule breakdown.
 * Complements audit.json with time-series metrics for tracking migration velocity.
 *
 * @module @effect-migrate/cli/amp/metrics-writer
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
  /** Context version */
  version: Schema.Number,
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
 * Extracted TypeScript type from AmpMetricsContext schema.
 *
 * @category Types
 * @since 0.2.0
 */
export type AmpMetricsContext = typeof AmpMetricsContext.Type

/**
 * Write metrics context to the Amp output directory.
 *
 * Generates metrics.json with migration progress tracking and per-rule breakdown.
 * Also updates index.json to include metrics file reference.
 *
 * @param outputDir - Directory to write metrics.json
 * @param results - Rule violation results from audit
 * @param config - Migration configuration
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
 *   yield* writeMetricsContext(".amp/effect-migrate", results, config)
 * })
 * ```
 */
export const writeMetricsContext = (
  outputDir: string,
  results: RuleResult[],
  config: Config
) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const now = yield* Clock.currentTimeMillis
    const timestamp = DateTime.unsafeMake(now)
    const projectRoot = process.cwd()

    // Calculate metrics
    const errors = results.filter(r => r.severity === "error").length
    const warnings = results.filter(r => r.severity === "warning").length
    const filesAffected = new Set(results.map(r => r.file).filter(Boolean)).size

    // Calculate progress (simple heuristic: fewer violations = higher progress)
    // In a real scenario, this could compare against initial baseline
    const totalViolations = results.length
    const progressPercentage = Math.max(0, 100 - totalViolations * 5) // Example formula

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
      version: 1,
      toolVersion: "0.1.0",
      projectRoot,
      timestamp,
      summary: {
        totalViolations,
        errors,
        warnings,
        filesAffected,
        progressPercentage
      },
      ruleBreakdown
    }

    // Encode and write
    const encode = Schema.encodeSync(AmpMetricsContext)
    const metricsJson = encode(metricsContext)

    const metricsPath = path.join(outputDir, "metrics.json")
    yield* fs.writeFileString(metricsPath, JSON.stringify(metricsJson, null, 2))

    yield* Console.log(`  ✓ metrics.json`)

    // Update index.json to include metrics
    const indexPath = path.join(outputDir, "index.json")
    const indexExists = yield* fs.exists(indexPath).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    )

    if (indexExists) {
      const indexContent = yield* fs.readFileString(indexPath)
      const index = JSON.parse(indexContent)
      index.files.metrics = "metrics.json"
      yield* fs.writeFileString(indexPath, JSON.stringify(index, null, 2))
      yield* Console.log(`  ✓ Updated index.json`)
    }
  })
