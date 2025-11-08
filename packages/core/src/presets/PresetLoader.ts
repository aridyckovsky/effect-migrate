/**
 * Preset Loader - Service for loading and resolving effect-migrate presets
 *
 * This module provides the PresetLoader service for dynamically importing
 * presets from npm packages or local modules. Presets bundle rules and
 * default configuration to simplify project setup.
 *
 * **Preset structure:**
 * - `rules`: Array of Rule objects to apply
 * - `defaults`: Optional config defaults (paths, report, concurrency, etc.)
 *
 * **Resolution order:**
 * 1. `module.default` - Standard ES module default export
 * 2. `module.preset` - Named preset export
 * 3. `module.presetBasic` - Legacy preset-basic format
 *
 * @example
 * ```typescript
 * import { PresetLoader, PresetLoaderNpmLive } from "@effect-migrate/core"
 *
 * const program = Effect.gen(function*() {
 *   const loader = yield* PresetLoader
 *   const result = yield* loader.loadPresets(["@effect-migrate/preset-basic"])
 *
 *   yield* Console.log(`Loaded ${result.rules.length} rules`)
 *   // defaults contains merged config from all presets
 * }).pipe(Effect.provide(PresetLoaderNpmLive))
 * ```
 *
 * @module @effect-migrate/core/presets/PresetLoader
 * @since 0.4.0
 */

import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Rule } from "../rules/types.js"
import { deepMerge } from "../utils/merge.js"

/**
 * Error thrown when preset loading fails.
 *
 * @category Errors
 * @since 0.4.0
 */
export class PresetLoadError extends Data.TaggedError("PresetLoadError")<{
  readonly preset: string
  readonly message: string
}> {}

/**
 * Result of loading multiple presets.
 *
 * @category Types
 * @since 0.4.0
 */
export interface LoadPresetsResult {
  /** Combined rules from all loaded presets */
  readonly rules: ReadonlyArray<Rule>
  /** Merged defaults from all presets (later presets override earlier) */
  readonly defaults: Record<string, unknown>
}

/**
 * Shape of a valid preset module.
 *
 * @category Types
 * @since 0.4.0
 */
export interface Preset {
  /** Rules provided by this preset */
  readonly rules: ReadonlyArray<Rule>
  /** Optional config defaults */
  readonly defaults?: Record<string, unknown>
}

/**
 * Service interface for loading presets.
 *
 * @category Service
 * @since 0.4.0
 */
export interface PresetLoaderService {
  /** Load a single preset by name or path */
  readonly loadPreset: (name: string) => Effect.Effect<Preset, PresetLoadError>
  /** Load multiple presets and merge their rules/defaults */
  readonly loadPresets: (
    names: ReadonlyArray<string>
  ) => Effect.Effect<LoadPresetsResult, PresetLoadError>
}

/**
 * Context tag for PresetLoader service.
 *
 * @category Service
 * @since 0.4.0
 */
export class PresetLoader extends Context.Tag("PresetLoader")<
  PresetLoader,
  PresetLoaderService
>() {}

/**
 * NPM-based preset loader implementation.
 *
 * Loads presets via dynamic `import()` from npm packages or file paths.
 * Supports standard ES module patterns (default export) and legacy
 * named exports (preset, presetBasic).
 *
 * @category Layers
 * @since 0.4.0
 *
 * @example
 * ```typescript
 * import { PresetLoader, PresetLoaderNpmLive } from "@effect-migrate/core"
 *
 * const program = Effect.gen(function*() {
 *   const loader = yield* PresetLoader
 *   const preset = yield* loader.loadPreset("@effect-migrate/preset-basic")
 *
 *   yield* Console.log(`Loaded ${preset.rules.length} rules`)
 * }).pipe(Effect.provide(PresetLoaderNpmLive))
 * ```
 */
export const PresetLoaderNpmLive = Layer.effect(
  PresetLoader,
  Effect.gen(function*() {
    const isValidPreset = (u: unknown): u is Preset => {
      if (!u || typeof u !== "object") return false
      const obj = u as any
      return Array.isArray(obj.rules)
    }

    const mergeDefaults = (presets: ReadonlyArray<Preset>): Record<string, unknown> => {
      let result: Record<string, unknown> = {}
      for (const preset of presets) {
        if (preset.defaults) {
          result = deepMerge(result, preset.defaults)
        }
      }
      return result
    }

    const loadPreset = (name: string): Effect.Effect<Preset, PresetLoadError> =>
      Effect.tryPromise({
        try: () => import(name),
        catch: error =>
          new PresetLoadError({
            preset: name,
            message: `Failed to import: ${String(error)}`
          })
      }).pipe(
        Effect.flatMap(m => {
          // Preset resolution order: module.default > module.preset > module.presetBasic
          // Default export takes precedence to support standard ES module patterns
          const preset = (m as any).default ?? (m as any).preset ?? (m as any).presetBasic
          return isValidPreset(preset)
            ? Effect.succeed(preset)
            : Effect.fail(
              new PresetLoadError({
                preset: name,
                message: "Invalid preset shape: must have 'rules' array"
              })
            )
        })
      )

    const loadPresets = (
      names: ReadonlyArray<string>
    ): Effect.Effect<LoadPresetsResult, PresetLoadError> =>
      Effect.forEach(names, loadPreset, { concurrency: 1 }).pipe(
        Effect.map(presets => ({
          rules: presets.flatMap(p => p.rules),
          defaults: mergeDefaults(presets)
        }))
      )

    return {
      loadPreset,
      loadPresets
    } satisfies PresetLoaderService
  })
)
