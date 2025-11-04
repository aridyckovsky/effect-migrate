import {
  loadConfig,
  makeBoundaryRule,
  makePatternRule,
  RuleRunner,
  RuleRunnerLayer
} from "@effect-migrate/core"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { writeAmpContext } from "../amp/context-writer.js"
import { formatConsoleOutput } from "../formatters/console.js"
import { formatJsonOutput } from "../formatters/json.js"

export const auditCommand = Command.make(
  "audit",
  {
    config: Options.text("config").pipe(
      Options.withAlias("c"),
      Options.withDefault("effect-migrate.config.ts")
    ),
    json: Options.boolean("json").pipe(Options.withDefault(false)),
    strict: Options.boolean("strict").pipe(Options.withDefault(false)),
    ampOut: Options.text("amp-out").pipe(Options.optional)
  },
  ({ config: configPath, json, strict, ampOut }) =>
    Effect.gen(function*() {
      // Load configuration
      const config = yield* loadConfig(configPath).pipe(
        Effect.catchAll(error =>
          Effect.gen(function*() {
            yield* Console.error(`Failed to load config: ${error}`)
            return yield* Effect.fail(error)
          })
        )
      )

      // Collect rules from config using rule factories
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

      if (rules.length === 0) {
        yield* Console.log("⚠️  No rules configured")
        return 0
      }

      // Run rules via RuleRunner service
      const runner = yield* RuleRunner
      const results = yield* runner.runRules(rules, config)

      // Format output
      if (json) {
        const output = formatJsonOutput(results, config)
        yield* Console.log(JSON.stringify(output, null, 2))
      } else {
        const output = formatConsoleOutput(results, config)
        yield* Console.log(output)
      }

      // Write Amp context if requested
      if (ampOut._tag === "Some") {
        yield* writeAmpContext(ampOut.value, results, config)
        yield* Console.log(`\n✓ Wrote Amp context to ${ampOut.value}`)
      }

      // Determine exit code
      const errors = results.filter(r => r.severity === "error")
      const warnings = results.filter(r => r.severity === "warning")

      const failOn = config.report?.failOn ?? ["error", "warning"]
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
      Effect.provide(NodeFileSystem.layer),
      Effect.catchAll(error =>
        Effect.gen(function*() {
          yield* Console.error(`Audit failed: ${error}`)
          return 1
        })
      )
    )
)
