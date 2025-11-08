/**
 * Rule Runner Service - Orchestrate rule execution with context
 *
 * This module provides the main service for executing migration rules.
 * It builds the RuleContext, manages dependencies (FileDiscovery, ImportIndex),
 * and coordinates concurrent rule execution.
 *
 * @module @effect-migrate/core/services/RuleRunner
 * @since 0.1.0
 */

import * as Path from "@effect/platform/Path"
import * as Console from "effect/Console"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { ImportIndexResult, Rule, RuleContext, RuleResult } from "../rules/types.js"
import type { Config } from "../schema/Config.js"
import { PathsSchema } from "../schema/Config.js"
import { FileDiscovery, FileDiscoveryLive } from "./FileDiscovery.js"
import { ImportIndex, ImportIndexLive } from "./ImportIndex.js"

/**
 * Rule runner service interface.
 *
 * Orchestrates rule execution by building context and running rules with
 * proper error handling and progress logging.
 *
 * @category Service
 * @since 0.1.0
 */
export interface RuleRunnerService {
  /**
   * Run all rules against the project
   */
  runRules: (rules: ReadonlyArray<Rule>, config: Config) => Effect.Effect<RuleResult[]>
}

/**
 * Rule runner service tag for dependency injection.
 *
 * @category Service
 * @since 0.1.0
 */
export class RuleRunner extends Context.Tag("RuleRunner")<RuleRunner, RuleRunnerService>() {}

/**
 * Live implementation of RuleRunner service.
 *
 * Builds RuleContext with lazy file/import access, executes rules sequentially
 * (to avoid concurrent file conflicts), and normalizes result paths.
 *
 * @category Layer
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * import { RuleRunner, RuleRunnerLayer } from "@effect-migrate/core"
 *
 * const program = Effect.gen(function*() {
 *   const runner = yield* RuleRunner
 *   const results = yield* runner.runRules(rules, config)
 *   return results
 * }).pipe(Effect.provide(RuleRunnerLayer))
 * ```
 */
export const RuleRunnerLive = Layer.effect(
  RuleRunner,
  Effect.gen(function*() {
    const fileDiscovery = yield* FileDiscovery
    const importIndexService = yield* ImportIndex
    const pathSvc = yield* Path.Path

    const runRules = (rules: ReadonlyArray<Rule>, config: Config): Effect.Effect<RuleResult[]> =>
      Effect.gen(function*() {
        yield* Effect.logInfo(`Running ${rules.length} rules...`)

        const cwd = process.cwd()
        const paths = config.paths ?? new PathsSchema({ exclude: PathsSchema.defaultExclude })
        const rootPath = paths.root ?? cwd

        const listFiles = (globs: string[]): Effect.Effect<string[], any> =>
          fileDiscovery.listFiles(globs, [...paths.exclude])

        const readFile = (path: string) => fileDiscovery.readFile(path)

        const getImportIndex = (): Effect.Effect<ImportIndexResult, any> =>
          Effect.gen(function*() {
            yield* Effect.logInfo("Building import index...")
            const includePatterns = paths.include ?? ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
            const excludePatterns = [...paths.exclude]

            yield* importIndexService.getImportIndex(
              includePatterns,
              excludePatterns,
              config.concurrency ?? 4
            )
            yield* Effect.logInfo(`✓ Indexed imports`)

            return {
              getImports: (file: string) => importIndexService.getImportsOf(file),
              getImporters: (module: string) => importIndexService.getDependentsOf(module)
            }
          })

        const logger = {
          debug: (msg: string) => Effect.logDebug(msg),
          info: (msg: string) => Effect.logInfo(msg)
        }

        const ctx: RuleContext = {
          cwd,
          path: rootPath,
          listFiles,
          readFile,
          getImportIndex,
          config,
          logger
        }

        const results = yield* Effect.forEach(
          rules,
          rule =>
            Effect.gen(function*() {
              yield* Effect.logInfo(`  Checking rule: ${rule.id}`)
              const ruleResults = yield* rule.run(ctx).pipe(
                Effect.catchAll(error =>
                  Effect.gen(function*() {
                    yield* Console.error(`  ✗ Rule ${rule.id} failed: ${error}`)
                    return []
                  })
                )
              )

              if (ruleResults.length > 0) {
                yield* Effect.logInfo(`  Found ${ruleResults.length} issue(s)`)
              }

              return ruleResults
            }),
          { concurrency: 1 }
        )

        const allResults = results.flat()
        yield* Effect.logInfo(`✓ Complete: ${allResults.length} total findings`)

        // Normalize file paths to be relative to cwd (project root)
        const normalizedResults = allResults.map(result => {
          if (result.file) {
            const relativePath = pathSvc.relative(cwd, result.file)
            return { ...result, file: relativePath }
          }
          return result
        })

        return normalizedResults
      })

    return { runRules }
  })
)

/**
 * Complete RuleRunner layer with all dependencies.
 *
 * Provides RuleRunner with FileDiscovery and ImportIndex services.
 * Use this layer instead of RuleRunnerLive when you don't need to
 * customize the underlying services.
 *
 * @category Layer
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * import { RuleRunner, RuleRunnerLayer } from "@effect-migrate/core"
 *
 * const program = Effect.gen(function*() {
 *   const runner = yield* RuleRunner
 *   const results = yield* runner.runRules(rules, config)
 *   return results
 * }).pipe(Effect.provide(RuleRunnerLayer))
 * ```
 */
export const RuleRunnerLayer = RuleRunnerLive.pipe(
  Layer.provide(ImportIndexLive),
  Layer.provide(FileDiscoveryLive)
)
