/**
 * Configuration Loader - Load and validate effect-migrate config files
 *
 * This module provides utilities for loading configuration from .json, .js,
 * and .ts files with automatic validation via ConfigSchema. Supports dynamic
 * import of TypeScript configs using tsx loader.
 *
 * @module @effect-migrate/core/schema/loader
 * @since 0.1.0
 */

import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { pathToFileURL } from "node:url"
import { ConfigSchema } from "./Config.js"

/**
 * Error thrown when configuration loading fails.
 *
 * Includes specific message about the failure cause (file not found,
 * parse error, validation error, etc.).
 *
 * @category Error
 * @since 0.1.0
 */
export class ConfigLoadError extends Schema.TaggedError<ConfigLoadError>()("ConfigLoadError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

/**
 * Type helper for defining typed configuration in .ts files.
 *
 * Provides autocomplete and type checking when authoring config files.
 * Pass-through function that returns config unchanged.
 *
 * Accepts the encoded input format (e.g., pattern as string, not RegExp)
 * which will be validated and transformed by the loader.
 *
 * @param config - Configuration object (input/encoded format)
 * @returns Same config object (typed)
 *
 * @category Helper
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * import { defineConfig } from "@effect-migrate/core"
 *
 * export default defineConfig({
 *   version: 1,
 *   paths: { exclude: ["node_modules"] },
 *   patterns: [{
 *     id: "no-async",
 *     pattern: "async function",
 *     files: "src",
 *     message: "Use Effect.gen",
 *     severity: "warning"
 *   }]
 * })
 * ```
 */
export const defineConfig = (
  config: Schema.Schema.Encoded<typeof ConfigSchema>
): Schema.Schema.Encoded<typeof ConfigSchema> => config

/**
 * Load and validate configuration from file.
 *
 * Supports .json, .js, and .ts config files. TypeScript configs require
 * the 'tsx' package for dynamic loading. Validates loaded config against
 * ConfigSchema and returns typed Config object.
 *
 * @param configPath - Path to config file (relative or absolute)
 * @returns Effect containing validated Config
 *
 * @category Effect
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const config = yield* loadConfig("./effect-migrate.config.ts")
 * // config is fully typed and validated
 * ```
 */
export const loadConfig = (configPath: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const exists = yield* fs.exists(configPath).pipe(Effect.catchAll(() => Effect.succeed(false)))

    if (!exists) {
      return yield* Effect.fail(
        new ConfigLoadError({
          message: `Config file not found: ${configPath}`
        })
      )
    }

    const ext = path.extname(configPath)
    let rawConfig: unknown

    if (ext === ".json") {
      const content = yield* fs.readFileString(configPath)
      rawConfig = JSON.parse(content)
    } else if (ext === ".ts" || ext === ".js") {
      const absolutePath = path.isAbsolute(configPath)
        ? configPath
        : path.resolve(process.cwd(), configPath)

      const fileUrl = pathToFileURL(absolutePath).href

      // For .ts files, register tsx loader first
      const loadModule = ext === ".ts"
        ? Effect.gen(function*() {
          const tsx = yield* Effect.tryPromise({
            try: () => import("tsx/esm/api"),
            catch: () =>
              new ConfigLoadError({
                message: `TypeScript config requires 'tsx' package. Install with: pnpm add tsx`
              })
          })

          const unregister = tsx.register()

          const module = yield* Effect.tryPromise({
            try: () => import(fileUrl),
            catch: error =>
              new ConfigLoadError({
                message: `Failed to load config module: ${configPath}. Error: ${
                  error instanceof Error ? error.message : String(error)
                }`,
                cause: error
              })
          }).pipe(Effect.ensuring(Effect.sync(() => unregister())))

          return module
        })
        : Effect.tryPromise({
          try: () => import(fileUrl),
          catch: error =>
            new ConfigLoadError({
              message: `Failed to load config module: ${configPath}`,
              cause: error
            })
        })

      const module = yield* loadModule
      rawConfig = module.default ?? module
    } else {
      return yield* Effect.fail(
        new ConfigLoadError({
          message: `Unsupported config file extension: ${ext}. Use .json, .ts, or .js`
        })
      )
    }

    const config = yield* Schema.decodeUnknown(ConfigSchema)(rawConfig).pipe(
      Effect.mapError(
        error =>
          new ConfigLoadError({
            message: `Config validation failed: ${error}`,
            cause: error
          })
      )
    )

    yield* Console.log(`✓ Loaded config from ${configPath}`)

    return config
  })
