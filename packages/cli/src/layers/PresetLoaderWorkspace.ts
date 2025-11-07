/**
 * Workspace-Aware Preset Loader - CLI layer with monorepo support
 *
 * This module provides a PresetLoader implementation optimized for CLI usage
 * in monorepo environments. It resolves presets from the local workspace first,
 * enabling faster development iteration without rebuilding/publishing packages.
 *
 * **Resolution strategy:**
 * 1. Check `packages/{package-name}/build/esm/index.js` in current workspace
 * 2. Fall back to npm package resolution if workspace file not found
 *
 * This is especially useful for:
 * - Developing presets within the effect-migrate monorepo
 * - Testing preset changes without publishing
 * - Running CLI commands in workspace root during development
 *
 * @module @effect-migrate/cli/layers/PresetLoaderWorkspace
 * @since 0.4.0
 */

import {
  type LoadPresetsResult,
  type Preset,
  PresetLoader,
  PresetLoadError,
  type PresetLoaderService
} from "@effect-migrate/core"
import { deepMerge } from "@effect-migrate/core"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { pathToFileURL } from "node:url"

/**
 * Workspace-aware PresetLoader layer for CLI.
 *
 * Attempts to resolve presets from local workspace (monorepo) first,
 * then falls back to npm resolution.
 *
 * Resolution strategy:
 * 1. Try workspace path: packages/{packageName}/build/esm/index.js
 * 2. Fall back to npm import if workspace file not found
 *
 * @category Layers
 * @since 0.4.0
 *
 * @example
 * ```ts
 * const program = Effect.gen(function*() {
 *   const loader = yield* PresetLoader
 *   const preset = yield* loader.loadPreset("@effect-migrate/preset-basic")
 *   return preset
 * }).pipe(Effect.provide(PresetLoaderWorkspaceLive))
 * ```
 */
export const PresetLoaderWorkspaceLive: Layer.Layer<
  PresetLoader,
  never,
  FileSystem.FileSystem | Path.Path
> = Layer.effect(
  PresetLoader,
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    /**
     * Attempt to resolve preset from workspace monorepo
     * Returns file:// URL if found, undefined otherwise
     */
    const resolveWorkspaceUrl = (name: string): Effect.Effect<string | undefined, never> =>
      Effect.gen(function*() {
        // Extract package name from scoped package (@effect-migrate/preset-basic → preset-basic)
        const parts = name.split("/")
        const packageName = parts.length > 1 ? parts[parts.length - 1] : name

        // Try workspace path: packages/{packageName}/build/esm/index.js
        const workspacePath = path.join(
          process.cwd(), // CLI is allowed to use process.cwd
          "packages",
          packageName,
          "build",
          "esm",
          "index.js"
        )

        const exists = yield* fs.exists(workspacePath).pipe(
          Effect.catchAll(() => Effect.succeed(false))
        )

        return exists ? pathToFileURL(workspacePath).href : undefined
      })

    /**
     * Validate preset shape (must have rules array)
     */
    const isValidPreset = (u: unknown): u is Preset => {
      if (!u || typeof u !== "object") return false
      const obj = u as any
      return Array.isArray(obj.rules)
    }

    /**
     * Merge defaults from multiple presets
     */
    const mergeDefaults = (presets: ReadonlyArray<Preset>): Record<string, unknown> => {
      let result: Record<string, unknown> = {}
      for (const preset of presets) {
        if (preset.defaults) {
          result = deepMerge(result, preset.defaults)
        }
      }
      return result
    }

    /**
     * Load preset with workspace fallback
     */
    const loadPreset = (name: string): Effect.Effect<Preset, PresetLoadError> =>
      Effect.gen(function*() {
        // First attempt: workspace resolution
        const workspaceUrl = yield* resolveWorkspaceUrl(name)

        if (workspaceUrl) {
          // Try workspace import
          const workspaceResult = yield* Effect.tryPromise({
            try: () => import(workspaceUrl),
            catch: () => undefined // Fall through to npm on workspace import failure
          }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))

          if (workspaceResult) {
            const preset = workspaceResult.default ?? workspaceResult.preset ??
              workspaceResult.presetBasic
            if (isValidPreset(preset)) {
              return preset
            }
          }
        }

        // Second attempt: npm resolution
        return yield* Effect.tryPromise({
          try: () => import(name),
          catch: error =>
            new PresetLoadError({
              preset: name,
              message: `Failed to import from npm: ${String(error)}`
            })
        }).pipe(
          Effect.flatMap(m => {
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
      })

    /**
     * Load multiple presets and merge defaults
     */
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
