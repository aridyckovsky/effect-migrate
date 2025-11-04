import type { PlatformError } from "@effect/platform/Error"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import type { Rule, RuleContext, RuleResult } from "../rules/types.js"
import type { Config } from "../schema/Config.js"

export interface FileDiscoveryService {
  readonly listFiles: (
    globs: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>
  ) => Effect.Effect<string[], PlatformError>
  readonly readFile: (path: string) => Effect.Effect<string, PlatformError>
  readonly isTextFile: (path: string) => boolean
}

export const runPatternRules = (
  rules: ReadonlyArray<Rule>,
  config: Config,
  discovery: FileDiscoveryService
): Effect.Effect<ReadonlyArray<RuleResult>, PlatformError> =>
  Effect.gen(function*() {
    const patternRules = rules.filter(r => r.kind === "pattern")

    if (patternRules.length === 0) {
      return []
    }

    const includeGlobs = config.paths?.include ?? ["**/*.{ts,tsx,js,jsx}"]
    const excludeGlobs = config.paths?.exclude ?? []
    const cwd = process.cwd()
    const rootPath = config.paths?.root ?? "."
    const concurrency = config.concurrency ?? 4

    const files = yield* discovery.listFiles([...includeGlobs], [...excludeGlobs])

    const allResults = yield* Effect.forEach(
      files,
      file =>
        Effect.gen(function*() {
          const ctx: RuleContext = {
            cwd,
            path: rootPath,
            listFiles: globs => discovery.listFiles(globs, [...excludeGlobs]),
            readFile: path => discovery.readFile(path),
            getImportIndex: () =>
              Effect.succeed({
                getImports: () => Effect.succeed([]),
                getImporters: () => Effect.succeed([])
              }),
            config: config.extensions ?? {},
            logger: {
              debug: msg => Console.debug(msg),
              info: msg => Console.log(msg)
            }
          }

          const fileResults: RuleResult[] = []
          for (const rule of patternRules) {
            const results = yield* rule.run(ctx)
            fileResults.push(...results)
          }

          return fileResults
        }),
      { concurrency }
    )

    return allResults.flat()
  })
