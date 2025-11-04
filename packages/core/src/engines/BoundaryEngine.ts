import type { PlatformError } from "@effect/platform/Error"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import type { ImportIndexResult, Rule, RuleContext, RuleResult } from "../rules/types.js"
import type { Config } from "../schema/Config.js"

export interface FileDiscoveryService {
  readonly listFiles: (
    globs: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>
  ) => Effect.Effect<string[], PlatformError>
  readonly readFile: (path: string) => Effect.Effect<string, PlatformError>
  readonly isTextFile: (path: string) => boolean
}

export interface ImportIndexData {
  fileToImports: Map<string, string[]>
  moduleToFiles: Map<string, string[]>
}

export interface ImportIndexService {
  buildIndex: (files: Map<string, string>) => Effect.Effect<ImportIndexData>
  extractImports: (content: string) => string[]
  getImports: (file: string, index: ImportIndexData) => string[]
  getImporters: (module: string, index: ImportIndexData) => string[]
}

const matchGlob = (pattern: string, path: string): boolean => {
  const regexPattern = pattern
    .replace(/\*\*/g, "DOUBLE_STAR")
    .replace(/\*/g, "[^/]*")
    .replace(/DOUBLE_STAR/g, ".*")
    .replace(/\?/g, "[^/]")

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(path)
}

export const runBoundaryRules = (
  rules: ReadonlyArray<Rule>,
  config: Config,
  discovery: FileDiscoveryService,
  importIndexService: ImportIndexService
): Effect.Effect<ReadonlyArray<RuleResult>, PlatformError> =>
  Effect.gen(function*() {
    const boundaryRules = rules.filter(r => r.kind === "boundary")

    if (boundaryRules.length === 0) {
      return []
    }

    const includeGlobs = config.paths?.include ?? ["**/*.{ts,tsx,js,jsx}"]
    const excludeGlobs = config.paths?.exclude ?? []
    const cwd = process.cwd()
    const rootPath = config.paths?.root ?? "."
    const concurrency = config.concurrency ?? 4

    const files = yield* discovery.listFiles([...includeGlobs], [...excludeGlobs])

    const fileIndex = new Map<string, string>()
    yield* Effect.forEach(
      files,
      file =>
        Effect.gen(function*() {
          const content = yield* discovery.readFile(file)
          fileIndex.set(file, content)
        }),
      { concurrency }
    )

    const importIndexData = yield* importIndexService.buildIndex(fileIndex)

    const allResults = yield* Effect.forEach(
      files,
      file =>
        Effect.gen(function*() {
          const matchingRules = boundaryRules.filter(rule => {
            const boundaryConfig = config.boundaries?.find(b => b.id === rule.id)
            if (!boundaryConfig) return false

            const fromPattern = boundaryConfig.from
            return matchGlob(fromPattern, file)
          })

          if (matchingRules.length === 0) {
            return []
          }

          const indexResult: ImportIndexResult = {
            getImports: f => Effect.succeed(importIndexService.getImports(f, importIndexData)),
            getImporters: m => Effect.succeed(importIndexService.getImporters(m, importIndexData))
          }

          const ctx: RuleContext = {
            cwd,
            path: rootPath,
            listFiles: globs => discovery.listFiles(globs, [...excludeGlobs]),
            readFile: path => discovery.readFile(path),
            getImportIndex: () => Effect.succeed(indexResult),
            config: config.extensions ?? {},
            logger: {
              debug: msg => Console.debug(msg),
              info: msg => Console.log(msg)
            }
          }

          const fileResults: RuleResult[] = []
          for (const rule of matchingRules) {
            const results = yield* rule.run(ctx)
            fileResults.push(...results)
          }

          return fileResults
        }),
      { concurrency }
    )

    return allResults.flat()
  })
