import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Rule } from "../rules/types.js"
import { deepMerge } from "../utils/merge.js"

export class PresetLoadError extends Data.TaggedError("PresetLoadError")<{
  readonly preset: string
  readonly message: string
}> {}

export interface LoadPresetsResult {
  readonly rules: ReadonlyArray<Rule>
  readonly defaults: Record<string, unknown>
}

export interface Preset {
  readonly rules: ReadonlyArray<Rule>
  readonly defaults?: Record<string, unknown>
}

export interface PresetLoaderService {
  readonly loadPreset: (name: string) => Effect.Effect<Preset, PresetLoadError>
  readonly loadPresets: (
    names: ReadonlyArray<string>
  ) => Effect.Effect<LoadPresetsResult, PresetLoadError>
}

export class PresetLoader extends Context.Tag("PresetLoader")<
  PresetLoader,
  PresetLoaderService
>() {}

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
