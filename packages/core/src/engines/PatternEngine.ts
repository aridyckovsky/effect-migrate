/**
 * Pattern Engine - Execute pattern-based rules with concurrent file processing
 *
 * This module provides the execution engine for pattern-based rules that
 * search files using regex patterns. Processes files concurrently while
 * running rules sequentially within each file to avoid conflicts.
 *
 * Pattern rules do NOT require import index building, making them faster
 * than boundary rules for simple pattern matching tasks.
 *
 * @module @effect-migrate/core/engines/PatternEngine
 * @since 0.1.0
 * @internal
 */

import type { PlatformError } from "@effect/platform/Error"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import type { Rule, RuleContext, RuleResult } from "../rules/types.js"
import type { Config } from "../schema/Config.js"
import type { FileDiscoveryService } from "../services/FileDiscovery.js"

/**
 * Execute pattern-based rules across project files.
 *
 * Filters rules to pattern kind, lists files using discovery service,
 * then processes files concurrently while running rules sequentially
 * per file to avoid race conditions.
 *
 * Import index is stubbed (empty) since pattern rules don't need it.
 *
 * @param rules - All rules (filtered to pattern kind internally)
 * @param config - Migration configuration with paths and concurrency
 * @param discovery - File discovery service for listing/reading files
 * @returns Effect containing all rule results flattened
 *
 * @category Engine
 * @since 0.1.0
 * @internal
 *
 * @example
 * ```typescript
 * const results = yield* runPatternRules(
 *   [asyncAwaitRule, promiseRule],
 *   config,
 *   discovery
 * )
 * // Returns array of RuleResult from all pattern rules
 * ```
 */
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
