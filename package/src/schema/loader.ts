import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { pathToFileURL } from "node:url"
import { ConfigSchema } from "./Config.js"

export class ConfigLoadError extends Schema.TaggedError<ConfigLoadError>()("ConfigLoadError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export const defineConfig = (
  config: Schema.Schema.Type<typeof ConfigSchema>
): Schema.Schema.Type<typeof ConfigSchema> => config

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
                message: `Failed to load config module: ${configPath}`,
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
