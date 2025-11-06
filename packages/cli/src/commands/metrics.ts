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

import { RuleRunner, RuleRunnerLayer } from "@effect-migrate/core"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { writeMetricsContext } from "../amp/metrics-writer.js"
import { calculateMetrics, formatMetricsOutput } from "../formatters/metrics.js"
import { loadRulesAndConfig } from "../loaders/rules.js"

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
      // Load configuration, presets, and construct all rules
      const { rules, config: effectiveConfig } = yield* loadRulesAndConfig(configPath)

      // Run rules via RuleRunner service
      const runner = yield* RuleRunner
      const results = yield* runner.runRules(rules, effectiveConfig)

      const metricsData = calculateMetrics(results)

      if (json) {
        yield* Console.log(JSON.stringify({ metrics: metricsData }, null, 2))
      } else {
        const output = formatMetricsOutput(metricsData)
        yield* Console.log(output)
      }

      // Write Amp context if requested
      if (ampOut._tag === "Some") {
        yield* writeMetricsContext(ampOut.value, results, effectiveConfig)
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
