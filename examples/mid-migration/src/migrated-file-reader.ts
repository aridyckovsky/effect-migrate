// MIGRATED to Effect patterns
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import { FileSystem } from "@effect/platform"

interface FileData {
  readonly path: string
  readonly content: string
  readonly size: number
}

class FileReadError {
  readonly _tag = "FileReadError"
  constructor(readonly path: string, readonly cause: unknown) {}
}

// Migrated: async/await -> Effect.gen
export const readFileWithMetadata = (
  filePath: string
): Effect.Effect<FileData, FileReadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const content = yield* fs.readFileString(filePath).pipe(
      Effect.catchAll((cause) =>
        Effect.fail(new FileReadError(filePath, cause))
      )
    )

    const stats = yield* fs.stat(filePath).pipe(
      Effect.catchAll((cause) =>
        Effect.fail(new FileReadError(filePath, cause))
      )
    )

    if (stats.type !== "File") {
      return yield* Effect.fail(
        new FileReadError(filePath, "Not a file")
      )
    }

    return {
      path: filePath,
      content,
      size: stats.size
    }
  })

// Migrated: Promise.all -> Effect.forEach with concurrency
export const readMultipleFiles = (
  filePaths: ReadonlyArray<string>
): Effect.Effect<
  ReadonlyArray<FileData>,
  FileReadError,
  FileSystem.FileSystem
> =>
  Effect.forEach(filePaths, readFileWithMetadata, {
    concurrency: 4
  })

// Migrated: Manual cleanup -> Effect.acquireRelease
export const processFileWithCleanup = (
  filePath: string
): Effect.Effect<string, FileReadError, FileSystem.FileSystem> =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem

      const handle = yield* Effect.acquireRelease(
        fs.open(filePath, { flag: "r" }).pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new FileReadError(filePath, cause))
          )
        ),
        (handle) => Effect.orDie(handle.close)
      )

      const buffer = yield* handle.read().pipe(
        Effect.catchAll((cause) =>
          Effect.fail(new FileReadError(filePath, cause))
        )
      )

      return buffer.toString().toUpperCase()
    })
  )

// Migrated: Sequential operations with proper error handling
export const copyAndTransform = (
  source: string,
  dest: string
): Effect.Effect<void, FileReadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const content = yield* fs.readFileString(source).pipe(
      Effect.catchAll((cause) =>
        Effect.fail(new FileReadError(source, cause))
      )
    )

    const transformed = content.toUpperCase()

    yield* fs.writeFileString(dest, transformed).pipe(
      Effect.catchAll((cause) =>
        Effect.fail(new FileReadError(dest, cause))
      )
    )

    const verification = yield* fs.readFileString(dest).pipe(
      Effect.catchAll((cause) =>
        Effect.fail(new FileReadError(dest, cause))
      )
    )

    if (verification !== transformed) {
      yield* Console.error("Verification failed")
      return yield* Effect.fail(
        new FileReadError(dest, "Verification failed")
      )
    }
  })
