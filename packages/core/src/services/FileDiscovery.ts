import type { PlatformError } from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".yml",
  ".yaml",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".svg",
  ".xml"
])

export interface FileDiscoveryService {
  listFiles: (globs: string[], exclude?: string[]) => Effect.Effect<string[]>

  readFile: (path: string) => Effect.Effect<string, PlatformError>

  isTextFile: (path: string) => boolean

  buildFileIndex: (
    globs: string[],
    exclude?: string[],
    concurrency?: number
  ) => Effect.Effect<Map<string, string>, PlatformError>
}

export class FileDiscovery extends Context.Tag("FileDiscovery")<
  FileDiscovery,
  FileDiscoveryService
>() {}

export const FileDiscoveryLive = Layer.effect(
  FileDiscovery,
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const contentCache = new Map<string, string>()

    const isTextFile = (filePath: string): boolean => {
      const ext = path.extname(filePath).toLowerCase()
      return TEXT_EXTENSIONS.has(ext)
    }

    const matchGlob = (pattern: string, exclude: string[] = []): Effect.Effect<string[]> =>
      Effect.gen(function*() {
        const files: string[] = []

        const walkDir = (dir: string): Effect.Effect<void> =>
          Effect.gen(function*() {
            const entries = yield* fs
              .readDirectory(dir)
              .pipe(Effect.catchAll(() => Effect.succeed([])))

            for (const entry of entries) {
              const fullPath = path.join(dir, entry)
              const relativePath = path.relative(process.cwd(), fullPath)

              const isExcluded = exclude.some(pattern =>
                relativePath.includes(pattern.replace("/**", ""))
              )

              if (isExcluded) continue

              const stat = yield* fs
                .stat(fullPath)
                .pipe(Effect.catchAll(() => Effect.succeed(null)))

              if (!stat) continue

              if (stat.type === "Directory") {
                yield* walkDir(fullPath)
              } else if (stat.type === "File" && isTextFile(fullPath)) {
                files.push(relativePath.split(path.sep).join("/"))
              }
            }
          })

        const baseDir = pattern.split("**")[0] || "."
        yield* walkDir(baseDir)

        return files
      })

    const listFiles = (globs: string[], exclude: string[] = []): Effect.Effect<string[]> =>
      Effect.gen(function*() {
        const allFiles = yield* Effect.forEach(globs, pattern => matchGlob(pattern, exclude), {
          concurrency: "unbounded"
        })

        const uniqueFiles = Array.from(new Set(allFiles.flat()))
        return uniqueFiles.sort()
      })

    const readFile = (filePath: string): Effect.Effect<string, PlatformError> =>
      Effect.gen(function*() {
        if (contentCache.has(filePath)) {
          return contentCache.get(filePath)!
        }

        const content = yield* fs.readFileString(filePath)

        contentCache.set(filePath, content)

        return content
      })

    const buildFileIndex = (
      globs: string[],
      exclude: string[] = [],
      concurrency: number = 4
    ): Effect.Effect<Map<string, string>, PlatformError> =>
      Effect.gen(function*() {
        const files = yield* listFiles(globs, exclude)

        const fileContents = yield* Effect.forEach(
          files,
          file =>
            Effect.gen(function*() {
              const content = yield* readFile(file)
              return [file, content] as const
            }),
          { concurrency }
        )

        return new Map(fileContents)
      })

    return {
      listFiles,
      readFile,
      isTextFile,
      buildFileIndex
    }
  })
)
