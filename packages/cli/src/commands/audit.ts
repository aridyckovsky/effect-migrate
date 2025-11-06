/**
 * Audit Command - Run migration rules and report violations
 *
 * This module provides the main `audit` CLI command that loads configuration,
 * executes pattern and boundary rules, and reports violations in multiple formats
 * (console, JSON, Amp context).
 *
 * ## Usage
 *
 * ```bash
 * # Run audit with default config
 * effect-migrate audit
 *
 * # Use custom config file
 * effect-migrate audit --config my-config.ts
 *
 * # Output as JSON
 * effect-migrate audit --json
 *
 * # Generate Amp context
 * effect-migrate audit --amp-out .amp/effect-migrate
 *
 * # Fail on warnings (strict mode)
 * effect-migrate audit --strict
 * ```
 *
 * @module @effect-migrate/cli/commands/audit
 * @since 0.1.0
 */

import { RuleRunner, RuleRunnerLayer } from "@effect-migrate/core"
import { writeAmpContext } from "@effect-migrate/core/amp"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { ampOutOption } from "../amp/options.js"
import { formatConsoleOutput } from "../formatters/console.js"
import { formatJsonOutput } from "../formatters/json.js"
import { loadRulesAndConfig } from "../loaders/rules.js"

/**
 * CLI command to run migration audit.
 *
 * Loads configuration, constructs rules from patterns and boundaries,
 * runs rules via RuleRunner service, and outputs results in requested format.
 *
 * Exit codes:
 * - 0: Audit passed (no violations or violations below failOn threshold)
 * - 1: Audit failed (violations exceed failOn threshold or error occurred)
 *
 * Formats:
 * - Console (default): Human-readable colored output with icons
 * - JSON (--json): Machine-readable structured output
 * - Amp context (--amp-out): MCP-compatible context files
 *
 * @category CLI Command
 * @since 0.1.0
 *
 * @example
 * ```bash
 * # Run audit with default config
 * effect-migrate audit
 * # => Colored console output with file-grouped violations
 *
 * # Generate Amp context for persistent migration state
 * effect-migrate audit --amp-out .amp/effect-migrate
 * # => Creates .amp/effect-migrate/audit.json, index.json, badges.md
 * ```
 */
export const auditCommand = Command.make(
  "audit",
  {
    config: Options.text("config").pipe(
      Options.withAlias("c"),
      Options.withDefault("effect-migrate.config.ts")
    ),
    json: Options.boolean("json").pipe(Options.withDefault(false)),
    strict: Options.boolean("strict").pipe(Options.withDefault(false)),
    ampOut: ampOutOption()
  },
  ({ config: configPath, json, strict, ampOut }) =>
    Effect.gen(function*() {
      // Load configuration, presets, and construct all rules
      const { rules, config: effectiveConfig } = yield* loadRulesAndConfig(configPath)

      if (rules.length === 0) {
        yield* Console.log("⚠️  No rules configured")
        return 0
      }

      // Run rules via RuleRunner service
      const runner = yield* RuleRunner
      const results = yield* runner.runRules(rules, effectiveConfig)

      // Format output
      if (json) {
        const output = formatJsonOutput(results, effectiveConfig)
        yield* Console.log(JSON.stringify(output, null, 2))
      } else {
        const output = formatConsoleOutput(results, effectiveConfig)
        yield* Console.log(output)
      }

      // Write Amp context if requested
      if (ampOut._tag === "Some") {
        yield* writeAmpContext(ampOut.value, results, effectiveConfig)
        yield* Console.log(`\n✓ Wrote Amp context to ${ampOut.value}`)
      }

      // Determine exit code
      const errors = results.filter(r => r.severity === "error")
      const warnings = results.filter(r => r.severity === "warning")

      const failOn = effectiveConfig.report?.failOn ?? ["error", "warning"]
      const shouldFail = (failOn.includes("error") && errors.length > 0) ||
        (failOn.includes("warning") && warnings.length > 0) ||
        (strict && (errors.length > 0 || warnings.length > 0))

      if (shouldFail) {
        yield* Console.error(`\n❌ Audit failed`)
        return 1
      }

      yield* Console.log(`\n✓ Audit passed`)
      return 0
    }).pipe(
      Effect.provide(RuleRunnerLayer),
      Effect.catchAll(error =>
        Effect.gen(function*() {
          yield* Console.error(`Audit failed: ${error}`)
          return 1
        })
      )
    )
)
