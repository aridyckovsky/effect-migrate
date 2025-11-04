import * as Console from "effect/Console"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { ImportIndexResult, Rule, RuleContext, RuleResult } from "../rules/types.js"
import type { Config } from "../schema/Config.js"
import { PathsSchema } from "../schema/Config.js"
import { FileDiscovery, FileDiscoveryLive } from "./FileDiscovery.js"
import { ImportIndex, ImportIndexLive } from "./ImportIndex.js"

export interface RuleRunnerService {
  /**
   * Run all rules against the project
   */
  runRules: (rules: Rule[], config: Config) => Effect.Effect<RuleResult[]>
}

export class RuleRunner extends Context.Tag("RuleRunner")<RuleRunner, RuleRunnerService>() {}

export const RuleRunnerLive = Layer.effect(
  RuleRunner,
  Effect.gen(function*() {
    const fileDiscovery = yield* FileDiscovery
    const importIndexService = yield* ImportIndex

    const runRules = (rules: Rule[], config: Config): Effect.Effect<RuleResult[]> =>
      Effect.gen(function*() {
        yield* Console.log(`Running ${rules.length} rules...`)

        const cwd = process.cwd()
        const paths = config.paths ?? new PathsSchema({ exclude: PathsSchema.defaultExclude })
        const rootPath = paths.root ?? cwd

        const listFiles = (globs: string[]): Effect.Effect<string[], any> =>
          fileDiscovery.listFiles(globs, [...paths.exclude])

        const readFile = (path: string) => fileDiscovery.readFile(path)

        const getImportIndex = (): Effect.Effect<ImportIndexResult, any> =>
          Effect.gen(function*() {
            yield* Console.log("Building import index...")
            const includePatterns = paths.include ?? ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
            const excludePatterns = [...paths.exclude]

            yield* importIndexService.getImportIndex(
              includePatterns,
              excludePatterns,
              config.concurrency ?? 4
            )
            yield* Console.log(`✓ Indexed imports`)

            return {
              getImports: (file: string) => importIndexService.getImportsOf(file),
              getImporters: (module: string) => importIndexService.getDependentsOf(module)
            }
          })

        const logger = {
          debug: (msg: string) => Console.log(`[DEBUG] ${msg}`),
          info: (msg: string) => Console.log(msg)
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
              yield* Console.log(`  Checking rule: ${rule.id}`)
              const ruleResults = yield* rule.run(ctx).pipe(
                Effect.catchAll(error =>
                  Effect.gen(function*() {
                    yield* Console.error(`  ✗ Rule ${rule.id} failed: ${error}`)
                    return []
                  })
                )
              )

              if (ruleResults.length > 0) {
                yield* Console.log(`  Found ${ruleResults.length} issue(s)`)
              }

              return ruleResults
            }),
          { concurrency: 1 }
        )

        const allResults = results.flat()
        yield* Console.log(`✓ Complete: ${allResults.length} total findings`)

        return allResults
      })

    return { runRules }
  })
)

export const RuleRunnerLayer = RuleRunnerLive.pipe(
  Layer.provide(ImportIndexLive),
  Layer.provide(FileDiscoveryLive)
)
