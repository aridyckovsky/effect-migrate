/**
 * Config Merging - Utilities for merging preset defaults with user config
 *
 * This module provides utilities for merging preset default configurations
 * with user-provided configuration. User config always takes precedence.
 *
 * @module @effect-migrate/cli/loaders/config
 * @since 0.3.0
 */

import type { Config } from "@effect-migrate/core"

/**
 * Merge preset defaults with user configuration.
 *
 * Performs deep merge where user config always wins. Useful for combining
 * preset defaults with explicit user overrides.
 *
 * @param defaults - Defaults from presets
 * @param userConfig - User's explicit configuration
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
 * const userConfig = {
 *   paths: { exclude: ["dist/**"] },
 *   patterns: [...]
 * }
 * const effective = mergeConfig(presetDefaults, userConfig)
 * // => { paths: { exclude: ["dist/**"] }, concurrency: 4, patterns: [...] }
 * ```
 */
export const mergeConfig = (defaults: Record<string, unknown>, userConfig: Config): Config => {
  // User config is the base (highest priority)
  const merged: any = { ...userConfig }

  // Only apply defaults for fields not explicitly set by user
  for (const key in defaults) {
    if (Object.prototype.hasOwnProperty.call(defaults, key)) {
      const defaultValue = defaults[key]
      const userValue = merged[key]

      if (userValue === undefined) {
        // User didn't set this field, use preset default
        merged[key] = defaultValue
      } else if (isPlainObject(userValue) && isPlainObject(defaultValue)) {
        // Both are objects, merge recursively (user values win)
        merged[key] = deepMerge(
          defaultValue as Record<string, unknown>,
          userValue as Record<string, unknown>
        )
      }
      // else: user value wins, don't override
    }
  }

  return merged
}

/**
 * Deep merge two objects, with source taking precedence.
 *
 * @param target - Base object (lower priority)
 * @param source - Override object (higher priority)
 * @returns Merged object
 *
 * @category Utilities
 * @since 0.3.0
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target }

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = result[key]

      if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        )
      } else {
        // Source wins
        result[key] = sourceValue
      }
    }
  }

  return result
}

/**
 * Check if value is a plain object.
 *
 * @param value - Value to check
 * @returns True if plain object, false otherwise
 *
 * @category Utilities
 * @since 0.3.0
 */
function isPlainObject(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}
