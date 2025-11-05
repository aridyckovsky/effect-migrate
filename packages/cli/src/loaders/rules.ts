/**
 * Rules Loader - Combine preset and user-defined rules
 *
 * This module provides a centralized function to load presets, merge config defaults,
 * and construct rules from both preset and user-defined patterns/boundaries.
 *
 * @module @effect-migrate/cli/loaders/rules
 * @since 0.3.0
 */

import { loadConfig, makeBoundaryRule, makePatternRule } from "@effect-migrate/core"
import type { Config, Rule } from "@effect-migrate/core"
import type { ConfigLoadError } from "@effect-migrate/core"
import type { PlatformError } from "@effect/platform/Error"
import type { FileSystem } from "@effect/platform/FileSystem"
import type { Path } from "@effect/platform/Path"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { mergeConfig } from "./config.js"
import { loadPresets } from "./presets.js"

/**
 * Result of loading and combining all rules (preset + user-defined)
 */
export interface LoadRulesResult {
  /** Combined rules from presets and user config */
  readonly rules: Rule[]
  /** Effective config after merging preset defaults with user config */
  readonly config: Config
}

/**
 * Load configuration, presets, and construct all rules.
 *
 * This function centralizes the logic of:
 * 1. Loading config file
 * 2. Loading preset modules (if configured)
 * 3. Merging preset defaults with user config (user wins)
 * 4. Constructing rules from preset rules
 * 5. Constructing rules from user-defined patterns and boundaries
 * 6. Combining all rules into single array
 *
 * Used by both `audit` and `metrics` commands to avoid duplication.
 *
 * @param configPath - Path to config file (e.g., "effect-migrate.config.ts")
 * @returns Effect containing all rules and effective config
 *
 * @category Loader
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * const { rules, config } = yield* loadRulesAndConfig("effect-migrate.config.ts")
 *
 * // Use rules with RuleRunner
 * const runner = yield* RuleRunner
 * const results = yield* runner.runRules(rules, config)
 * ```
 */
export const loadRulesAndConfig = (
  configPath: string
): Effect.Effect<LoadRulesResult, ConfigLoadError | PlatformError, FileSystem | Path> =>
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

    // Load presets if configured
    let allRules: Rule[] = []
    let effectiveConfig: Config = config

    if (config.presets && config.presets.length > 0) {
      const presetResult = yield* loadPresets(config.presets).pipe(
        Effect.catchTag("PresetLoadError", error =>
          Effect.gen(function*() {
            yield* Console.warn(
              `⚠️  Failed to load preset ${error.preset}: ${error.message}`
            )
            return { rules: [], defaults: {} }
          }))
      )

      yield* Console.log(
        `✓ Loaded ${config.presets.length} preset(s) with ${presetResult.rules.length} rules`
      )

      // Merge preset defaults with user config (user config wins)
      effectiveConfig = mergeConfig(presetResult.defaults, config)

      // Add preset rules
      allRules = [...presetResult.rules]
    }

    // Collect user-defined rules from config using rule factories
    const userRules: Rule[] = []

    // Pattern rules - convert config patterns to actual rules
    if (effectiveConfig.patterns) {
      for (const pattern of effectiveConfig.patterns) {
        userRules.push(
          makePatternRule({
            id: pattern.id,
            files: Array.isArray(pattern.files) ? pattern.files : [pattern.files],
            pattern: pattern.pattern,
            message: pattern.message,
            severity: pattern.severity,
            ...(pattern.negativePattern !== undefined && {
              negativePattern: pattern.negativePattern
            }),
            ...(pattern.docsUrl !== undefined && { docsUrl: pattern.docsUrl }),
            ...(pattern.tags !== undefined && { tags: [...pattern.tags] })
          })
        )
      }
    }

    // Boundary rules - convert config boundaries to actual rules
    if (effectiveConfig.boundaries) {
      for (const boundary of effectiveConfig.boundaries) {
        userRules.push(
          makeBoundaryRule({
            id: boundary.id,
            from: boundary.from,
            disallow: [...boundary.disallow],
            message: boundary.message,
            severity: boundary.severity,
            ...(boundary.docsUrl !== undefined && { docsUrl: boundary.docsUrl }),
            ...(boundary.tags !== undefined && { tags: [...boundary.tags] })
          })
        )
      }
    }

    // Combine preset and user rules
    allRules = [...allRules, ...userRules]

    return {
      rules: allRules,
      config: effectiveConfig
    }
  })
