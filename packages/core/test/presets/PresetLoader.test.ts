import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  type Preset,
  PresetLoader,
  PresetLoadError,
  type PresetLoaderService
} from "../../src/presets/PresetLoader.js"
import type { Rule } from "../../src/rules/types.js"

const mockRule: Rule = {
  id: "test-rule",
  kind: "pattern",
  run: () => Effect.succeed([])
}

const mockRule2: Rule = {
  id: "test-rule-2",
  kind: "boundary",
  run: () => Effect.succeed([])
}

const validPreset: Preset = {
  rules: [mockRule],
  defaults: { concurrency: 4 }
}

const validPreset2: Preset = {
  rules: [mockRule2],
  defaults: { paths: { exclude: ["node_modules/**"] } }
}

const MockPresetLoaderSuccess = Layer.succeed(
  PresetLoader,
  {
    loadPreset: (name: string): Effect.Effect<Preset, PresetLoadError> => {
      if (name === "@effect-migrate/preset-basic") {
        return Effect.succeed(validPreset)
      }
      if (name === "@effect-migrate/preset-advanced") {
        return Effect.succeed(validPreset2)
      }
      return Effect.fail(
        new PresetLoadError({
          preset: name,
          message: "Failed to import: Module not found"
        })
      )
    },
    loadPresets: (names: ReadonlyArray<string>) =>
      Effect.forEach(names, name => {
        if (name === "@effect-migrate/preset-basic") {
          return Effect.succeed(validPreset)
        }
        if (name === "@effect-migrate/preset-advanced") {
          return Effect.succeed(validPreset2)
        }
        return Effect.fail(
          new PresetLoadError({
            preset: name,
            message: "Failed to import: Module not found"
          })
        )
      }).pipe(
        Effect.map(presets => ({
          rules: presets.flatMap(p => p.rules),
          defaults: presets.reduce(
            (acc, p) => ({ ...acc, ...p.defaults }),
            {} as Record<string, unknown>
          )
        }))
      )
  } satisfies PresetLoaderService
)

const MockPresetLoaderInvalid = Layer.succeed(
  PresetLoader,
  {
    loadPreset: (name: string): Effect.Effect<Preset, PresetLoadError> =>
      Effect.fail(
        new PresetLoadError({
          preset: name,
          message: "Invalid preset shape: must have 'rules' array"
        })
      ),
    loadPresets: () => Effect.succeed({ rules: [], defaults: {} })
  } satisfies PresetLoaderService
)

it.effect("should load valid preset successfully", () =>
  Effect.gen(function*() {
    const loader = yield* PresetLoader
    const preset = yield* loader.loadPreset("@effect-migrate/preset-basic")

    expect(preset).toEqual(validPreset)
    expect(preset.rules).toHaveLength(1)
    expect(preset.rules[0].id).toBe("test-rule")
    expect(preset.defaults).toEqual({ concurrency: 4 })
  }).pipe(Effect.provide(MockPresetLoaderSuccess)))

it.effect("should fail to load invalid preset", () =>
  Effect.gen(function*() {
    const loader = yield* PresetLoader
    const result = yield* loader.loadPreset("invalid-preset").pipe(
      Effect.catchTag("PresetLoadError", error => Effect.succeed(error as PresetLoadError))
    )

    if ("_tag" in result && result._tag === "PresetLoadError") {
      expect(result._tag).toBe("PresetLoadError")
      expect(result.message).toContain("Invalid preset shape")
    }
  }).pipe(Effect.provide(MockPresetLoaderInvalid)))

it.effect("should fail to load non-existent preset", () =>
  Effect.gen(function*() {
    const loader = yield* PresetLoader
    const result = yield* loader.loadPreset("@effect-migrate/preset-nonexistent").pipe(
      Effect.catchTag("PresetLoadError", error => Effect.succeed(error as PresetLoadError))
    )

    if ("_tag" in result && result._tag === "PresetLoadError") {
      expect(result._tag).toBe("PresetLoadError")
      expect(result.preset).toBe("@effect-migrate/preset-nonexistent")
      expect(result.message).toContain("Failed to import")
    }
  }).pipe(Effect.provide(MockPresetLoaderSuccess)))

it.effect("should load multiple presets and merge defaults", () =>
  Effect.gen(function*() {
    const loader = yield* PresetLoader
    const result = yield* loader.loadPresets([
      "@effect-migrate/preset-basic",
      "@effect-migrate/preset-advanced"
    ])

    expect(result.rules).toHaveLength(2)
    expect(result.rules[0].id).toBe("test-rule")
    expect(result.rules[1].id).toBe("test-rule-2")
    expect(result.defaults).toHaveProperty("concurrency", 4)
    expect(result.defaults).toHaveProperty("paths")
  }).pipe(Effect.provide(MockPresetLoaderSuccess)))

it.effect("should handle empty presets array", () =>
  Effect.gen(function*() {
    const loader = yield* PresetLoader
    const result = yield* loader.loadPresets([])

    expect(result.rules).toEqual([])
    expect(result.defaults).toEqual({})
  }).pipe(Effect.provide(MockPresetLoaderSuccess)))

it.effect("should propagate errors when loading multiple presets", () =>
  Effect.gen(function*() {
    const loader = yield* PresetLoader
    const result = yield* loader
      .loadPresets(["@effect-migrate/preset-basic", "@effect-migrate/preset-nonexistent"])
      .pipe(Effect.catchTag("PresetLoadError", error => Effect.succeed(error as PresetLoadError)))

    if ("_tag" in result && result._tag === "PresetLoadError") {
      expect(result._tag).toBe("PresetLoadError")
      expect(result.preset).toBe("@effect-migrate/preset-nonexistent")
    }
  }).pipe(Effect.provide(MockPresetLoaderSuccess)))
