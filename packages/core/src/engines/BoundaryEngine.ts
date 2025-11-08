/**
 * Boundary Engine - Execute boundary rules with import graph analysis
 *
 * This module provides the execution engine for boundary-based rules that
 * enforce architectural constraints by analyzing import dependencies.
 * Builds import index upfront, then processes files concurrently.
 *
 * Boundary rules require import graph building, making them slower than
 * pattern rules but enabling powerful architectural enforcement.
 *
 * @module @effect-migrate/core/engines/BoundaryEngine
 * @since 0.1.0
 * @internal
 */

import type { PlatformError } from "@effect/platform/Error"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import type { ImportIndexResult, Rule, RuleContext, RuleResult } from "../rules/types.js"
import type { Config } from "../schema/Config.js"
import type { FileDiscoveryService } from "../services/FileDiscovery.js"
import type { ImportIndexService } from "../services/ImportIndex.js"
import { matchGlob } from "../utils/glob.js"

/**
 * Execute boundary rules across project files.
 *
 * Filters rules to boundary kind, builds import index for all project files,
 * then processes files concurrently. Only runs rules on files matching the
 * rule's `from` pattern to optimize performance.
 *
 * Import index provides getImports/getImporters for dependency analysis.
 *
 * @param rules - All rules (filtered to boundary kind internally)
 * @param config - Migration configuration with paths and concurrency
 * @param discovery - File discovery service for listing/reading files
 * @param importIndexService - Import index service for building dependency graph
 * @returns Effect containing all rule results flattened
 *
 * @category Engine
 * @since 0.1.0
 * @internal
 *
 * @example
 * ```typescript
 * const results = yield* runBoundaryRules(
 *   [noUiInCoreRule, noDatabaseInViewRule],
 *   config,
 *   discovery,
 *   importIndexService
 * )
 * // Returns array of RuleResult from boundary violations
 * ```
 */
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

    const files = yield* discovery.listFiles(includeGlobs, excludeGlobs)

    // Build import index using the ImportIndex service
    yield* importIndexService.getImportIndex(includeGlobs, excludeGlobs, concurrency)

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
            getImports: f =>
              importIndexService
                .getImportsOf(f)
                .pipe(Effect.map(arr => [...arr])),
            getImporters: m =>
              importIndexService
                .getDependentsOf(m)
                .pipe(Effect.map(arr => [...arr]))
          }

          const ctx: RuleContext = {
            cwd,
            path: rootPath,
            listFiles: globs => discovery.listFiles(globs, excludeGlobs),
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
