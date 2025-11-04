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
