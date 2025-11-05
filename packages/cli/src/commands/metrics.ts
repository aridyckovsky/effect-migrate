/**
 * Metrics Command - Display migration progress dashboard
 *
 * This module provides the `metrics` CLI command that runs audit rules
 * and displays migration progress as a rich terminal dashboard with:
 * - Summary statistics table
 * - Progress bar visualization
 * - Rule breakdown by violation count
 * - Next steps recommendations
 *
 * ## Usage
 *
 * ```bash
 * # Display metrics dashboard (default)
 * effect-migrate metrics
 *
 * # Output metrics as JSON
 * effect-migrate metrics --json
 *
 * # Write metrics to Amp context
 * effect-migrate metrics --amp-out .amp/effect-migrate
 *
 * # Use custom config file
 * effect-migrate metrics --config my-config.ts
 * ```
 *
 * @module @effect-migrate/cli/commands/metrics
 * @since 0.1.0
 */

import {
  loadConfig,
  makeBoundaryRule,
  makePatternRule,
  RuleRunner,
  RuleRunnerLayer
} from "@effect-migrate/core"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { writeMetricsContext } from "../amp/metrics-writer.js"
import { calculateMetrics, formatMetricsOutput } from "../formatters/metrics.js"

/**
 * CLI command to display migration metrics dashboard.
 *
 * Runs audit rules, calculates metrics, and displays progress dashboard.
 * Dashboard includes summary table, progress bar, rule breakdown, and recommendations.
 *
 * Always returns exit code 0 (metrics are informational, not pass/fail).
 *
 * @category CLI Command
 * @since 0.1.0
 *
 * @example
 * ```bash
 * # Display dashboard
 * effect-migrate metrics
 * # => ╔═══════════════════════════════════════════════════════════╗
 * # => ║          📊 MIGRATION METRICS DASHBOARD                   ║
 * # => ╚═══════════════════════════════════════════════════════════╝
 * # => ...
 *
 * # Output as JSON for programmatic use
 * effect-migrate metrics --json
 * # => {"metrics": {"totalIssues": 15, "errors": 10, ...}}
 * ```
 */
export const metricsCommand = Command.make(
  "metrics",
  {
    config: Options.text("config").pipe(
      Options.withAlias("c"),
      Options.withDefault("effect-migrate.config.ts")
    ),
    json: Options.boolean("json").pipe(Options.withDefault(false)),
    ampOut: Options.text("amp-out").pipe(Options.optional)
  },
  ({ config: configPath, json, ampOut }) =>
    Effect.gen(function*() {
      const config = yield* loadConfig(configPath).pipe(
        Effect.catchAll(error =>
          Effect.gen(function*() {
            yield* Console.error(`Failed to load config: ${error}`)
            return yield* Effect.fail(error)
          })
        )
      )

      const runner = yield* RuleRunner
      const rules: any[] = []

      // Pattern rules - convert config patterns to actual rules
      if (config.patterns) {
        for (const pattern of config.patterns) {
          rules.push(makePatternRule({
            id: pattern.id,
            files: Array.isArray(pattern.files) ? pattern.files : [pattern.files],
            pattern: pattern.pattern,
            message: pattern.message,
            severity: pattern.severity,
            ...(pattern.negativePattern !== undefined &&
              { negativePattern: pattern.negativePattern }),
            ...(pattern.docsUrl !== undefined && { docsUrl: pattern.docsUrl }),
            ...(pattern.tags !== undefined && { tags: [...pattern.tags] })
          }))
        }
      }

      // Boundary rules - convert config boundaries to actual rules
      if (config.boundaries) {
        for (const boundary of config.boundaries) {
          rules.push(makeBoundaryRule({
            id: boundary.id,
            from: boundary.from,
            disallow: [...boundary.disallow],
            message: boundary.message,
            severity: boundary.severity,
            ...(boundary.docsUrl !== undefined && { docsUrl: boundary.docsUrl }),
            ...(boundary.tags !== undefined && { tags: [...boundary.tags] })
          }))
        }
      }

      const results = yield* runner.runRules(rules, config)

      const metricsData = calculateMetrics(results)

      if (json) {
        yield* Console.log(JSON.stringify({ metrics: metricsData }, null, 2))
      } else {
        const output = formatMetricsOutput(metricsData)
        yield* Console.log(output)
      }

      // Write Amp context if requested
      if (ampOut._tag === "Some") {
        yield* writeMetricsContext(ampOut.value, results, config)
        yield* Console.log(`\n✓ Wrote Amp metrics to ${ampOut.value}`)
      }

      return 0
    }).pipe(
      Effect.provide(RuleRunnerLayer),
      Effect.catchAll(error =>
        Effect.gen(function*() {
          yield* Console.error(`Metrics failed: ${error}`)
          return 1
        })
      )
    )
)
