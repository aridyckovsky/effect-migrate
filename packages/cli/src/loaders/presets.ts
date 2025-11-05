/**
 * Preset Loading - Dynamic import and validation of migration presets
 *
 * This module provides utilities for loading and merging preset configurations.
 * Presets are npm packages that export rules and default configuration.
 *
 * ## Usage
 *
 * ```typescript
 * const { rules, defaults } = yield* loadPresets(["@effect-migrate/preset-basic"])
 * const effectiveConfig = mergeConfig(defaults, userConfig)
 * ```
 *
 * @module @effect-migrate/cli/loaders/presets
 * @since 0.3.0
 */

import type { Preset, Rule } from "@effect-migrate/core"
import * as Array from "effect/Array"
import * as Console from "effect/Console"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

/**
 * Error thrown when preset loading fails.
 *
 * @category Errors
 * @since 0.3.0
 */
export class PresetLoadError extends Data.TaggedError("PresetLoadError")<{
  readonly preset: string
  readonly message: string
}> {}

/**
 * Result of loading presets.
 *
 * Contains merged rules and default configuration from all loaded presets.
 *
 * @category Types
 * @since 0.3.0
 */
export interface LoadPresetsResult {
  readonly rules: ReadonlyArray<Rule>
  readonly defaults: Record<string, unknown>
}

/**
 * Load and merge multiple presets.
 *
 * Dynamically imports preset modules, validates their shape, and merges
 * their rules and defaults.
 *
 * @param names - Array of preset package names to load
 * @returns Effect containing merged rules and defaults
 *
 * @category Loaders
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * const result = yield* loadPresets(["@effect-migrate/preset-basic"])
 * // result.rules: all rules from preset
 * // result.defaults: merged default config
 * ```
 */
export const loadPresets = (
  names: ReadonlyArray<string>
): Effect.Effect<LoadPresetsResult, PresetLoadError> =>
  Effect.gen(function*() {
    yield* Console.log(`Loading ${names.length} preset(s)...`)

    const presets = yield* Effect.forEach(
      names,
      name =>
        Effect.gen(function*() {
          yield* Console.log(`  • ${name}`)
          return yield* loadPreset(name)
        }),
      { concurrency: 1 }
    )

    return {
      rules: Array.flatten(presets.map(p => p.rules)),
      defaults: mergeDefaults(presets.map(p => p.defaults ?? {}))
    }
  })

/**
 * Load a single preset module.
 *
 * Attempts to dynamically import the preset package and validates its shape.
 * Handles both default exports and named 'preset' exports.
 *
 * @param name - Preset package name (e.g., "@effect-migrate/preset-basic")
 * @returns Effect containing the loaded preset
 *
 * @category Loaders
 * @since 0.3.0
 */
const loadPreset = (name: string): Effect.Effect<Preset, PresetLoadError> =>
  Effect.gen(function*() {
    // Dynamically import preset module
    const module = yield* Effect.tryPromise({
      try: () => import(name),
      catch: error =>
        new PresetLoadError({
          preset: name,
          message: `Failed to import: ${String(error)}`
        })
    })

    // Handle default export or named preset export
    const preset = module.default ?? module.preset

    if (!isValidPreset(preset)) {
      return yield* Effect.fail(
        new PresetLoadError({
          preset: name,
          message: "Invalid preset shape: must have 'rules' array"
        })
      )
    }

    return preset
  })

/**
 * Validate preset object shape.
 *
 * Checks that the preset has required fields and correct types.
 *
 * @param preset - Object to validate
 * @returns True if valid preset, false otherwise
 *
 * @category Validation
 * @since 0.3.0
 */
function isValidPreset(preset: unknown): preset is Preset {
  if (typeof preset !== "object" || preset === null) {
    return false
  }

  const obj = preset as Record<string, unknown>

  // Must have rules array
  if (!Array.isArray(obj.rules)) {
    return false
  }

  // defaults is optional but must be object if present
  if (obj.defaults !== undefined && (typeof obj.defaults !== "object" || obj.defaults === null)) {
    return false
  }

  return true
}

/**
 * Merge default configurations from multiple presets.
 *
 * Performs deep merge of preset defaults. Later presets override earlier ones.
 * User configuration will override all preset defaults.
 *
 * @param defaultsArray - Array of default config objects from presets
 * @returns Merged defaults object
 *
 * @category Merging
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * const merged = mergeDefaults([
 *   { paths: { exclude: ["node_modules"] } },
 *   { paths: { exclude: ["dist"] }, concurrency: 4 }
 * ])
 * // => { paths: { exclude: ["dist"] }, concurrency: 4 }
 * ```
 */
export function mergeDefaults(
  defaultsArray: Array<Record<string, unknown>>
): Record<string, unknown> {
  if (defaultsArray.length === 0) {
    return {}
  }

  return defaultsArray.reduce((acc, curr) => {
    return deepMerge(acc, curr)
  }, {})
}

/**
 * Deep merge two objects.
 *
 * Recursively merges nested objects. Arrays are replaced, not concatenated.
 * Properties in 'source' override properties in 'target'.
 *
 * @param target - Base object
 * @param source - Object to merge into target
 * @returns Merged object
 *
 * @category Merging
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

      // If both are plain objects, merge recursively
      if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        )
      } else {
        // Otherwise, source wins
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
