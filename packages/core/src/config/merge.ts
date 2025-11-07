/**
 * Config Merging - Utilities for merging preset defaults with user config
 *
 * This module provides utilities for merging preset default configurations
 * with user-provided configuration. User config always takes precedence.
 *
 * @module @effect-migrate/core/config/merge
 * @since 0.3.0
 */

import type { Config } from "../schema/Config.js"
import { deepMerge, isPlainObject } from "../utils/merge.js"

/**
 * Merge preset defaults with user configuration.
 *
 * Performs deep merge where user config always wins. Useful for combining
 * preset defaults with explicit user overrides.
 *
 * **Arrays are replaced, not concatenated.** When user config specifies an array,
 * it completely overrides the preset's array rather than appending to it.
 *
 * This function is type-safe because:
 * 1. Input `userConfig` is already a validated Config
 * 2. We only add values for undefined Config fields
 * 3. We never override user-specified values
 * 4. All Config fields are optional except version/paths/patterns
 * 5. The spread + merge operations preserve the Config structure
 *
 * @param defaults - Defaults from presets (unvalidated)
 * @param userConfig - User's explicit configuration (already validated)
 * @returns Merged configuration with user overrides
 *
 * @category Config
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * const presetDefaults = {
 *   paths: { exclude: ["node_modules/**"] },
 *   concurrency: 4
 * }
 * const userConfig: Config = {
 *   version: 1,
 *   paths: { root: process.cwd(), exclude: ["dist/**"] },
 *   patterns: []
 * }
 * const effective = mergeConfig(presetDefaults, userConfig)
 * // => { version: 1, paths: { root: ..., exclude: ["dist/**"] }, concurrency: 4, patterns: [] }
 * // Note: exclude array is replaced, not concatenated
 * ```
 */
export const mergeConfig = (defaults: Record<string, unknown>, userConfig: Config): Config => {
  // Start with validated Config - all required fields present
  const base: Config = userConfig

  // Build result by merging defaults for undefined fields
  const merged: Record<string, unknown> = { ...base }

  for (const key in defaults) {
    if (!Object.hasOwn(defaults, key)) continue

    const defaultValue = defaults[key]
    const currentValue = merged[key]

    if (currentValue === undefined) {
      // Field not set by user - add default
      merged[key] = defaultValue
    } else if (isPlainObject(currentValue) && isPlainObject(defaultValue)) {
      // Both are plain objects - deep merge (user wins)
      merged[key] = deepMerge(
        defaultValue as Record<string, unknown>,
        currentValue as Record<string, unknown>
      )
    }
    // else: user value exists - don't override
  }

  // Type assertion is safe here because:
  // - base is Config (required fields present)
  // - we only added optional Config fields from defaults
  // - merge logic preserves Config structure
  return merged as unknown as Config
}
