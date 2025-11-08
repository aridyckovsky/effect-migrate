/**
 * Rules Loader - Thin orchestrator for loading config and rules
 *
 * This module orchestrates core services to load configuration, presets,
 * and construct the final rules array. It handles user-facing concerns like
 * logging and error presentation while delegating business logic to core.
 *
 * @module @effect-migrate/cli/loaders/rules
 * @since 0.3.0
 */

import {
  type Config,
  type ConfigLoadError,
  loadConfig,
  mergeConfig,
  PresetLoader,
  type Rule,
  rulesFromConfig
} from "@effect-migrate/core"
import type { PlatformError } from "@effect/platform/Error"
import type { FileSystem } from "@effect/platform/FileSystem"
import type { Path } from "@effect/platform/Path"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"

/**
 * Result of loading and combining all rules (preset + user-defined)
 */
export interface LoadRulesResult {
  /** Combined rules from presets and user config */
  readonly rules: ReadonlyArray<Rule>
  /** Effective config after merging preset defaults with user config */
  readonly config: Config
}

/**
 * Load configuration, presets, and construct all rules.
 *
 * This function orchestrates core services to:
 * 1. Load config file (via core.loadConfig)
 * 2. Load preset modules if configured (via PresetLoader service)
 * 3. Merge preset defaults with user config (via core.mergeConfig, user wins)
 * 4. Construct rules from effective config (via core.rulesFromConfig)
 * 5. Return combined rules and effective config
 *
 * CLI-specific concerns:
 * - Progress logging (Console service)
 * - User-friendly error messages
 * - Graceful preset load failures (warnings, not failures)
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
 * const { rules, config } = yield* loadRulesAndConfig("effect-migrate.config.ts").pipe(
 *   Effect.provide(PresetLoaderWorkspaceLive)
 * )
 *
 * // Use rules with RuleRunner
 * const runner = yield* RuleRunner
 * const results = yield* runner.runRules(rules, config)
 * ```
 */
export const loadRulesAndConfig = (
  configPath: string
): Effect.Effect<
  LoadRulesResult,
  ConfigLoadError | PlatformError,
  PresetLoader | FileSystem | Path
> =>
  Effect.gen(function*() {
    // Load configuration (from core)
    yield* Effect.logInfo("🔍 Loading configuration...")
    const config = yield* loadConfig(configPath).pipe(
      Effect.catchAll(error =>
        Effect.gen(function*() {
          yield* Console.error(`Failed to load config: ${error}`)
          return yield* Effect.fail(error)
        })
      )
    )

    // Load presets if configured
    let presetRules: ReadonlyArray<Rule> = []
    let presetDefaults: Record<string, unknown> = {}

    if (config.presets && config.presets.length > 0) {
      yield* Effect.logInfo(`📦 Loading ${config.presets.length} preset(s)...`)

      const loader = yield* PresetLoader
      const result = yield* loader.loadPresets(config.presets).pipe(
        Effect.catchTag("PresetLoadError", error =>
          Effect.gen(function*() {
            yield* Console.warn(`⚠️  Failed to load preset: ${error.message}`)
            return { rules: [], defaults: {} }
          }))
      )

      presetRules = result.rules
      presetDefaults = result.defaults
    }

    // Merge preset defaults with user config (user config wins) - from core
    const effectiveConfig = mergeConfig(presetDefaults, config)

    // Construct rules from effective config (both preset-defined and user-defined) - from core
    const configRules = rulesFromConfig(effectiveConfig)

    // Combine preset rules with config rules
    const allRules = [...presetRules, ...configRules]

    yield* Effect.logInfo(`✓ Loaded ${allRules.length} rule(s)`)

    return {
      rules: allRules,
      config: effectiveConfig
    }
  })
