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
  ".yaml"
])

export class FileDiscovery extends Context.Tag("FileDiscovery")<
  FileDiscovery,
  {
    readonly listFiles: (
      globs: ReadonlyArray<string>,
      exclude?: ReadonlyArray<string>
    ) => Effect.Effect<string[], PlatformError>
    readonly readFile: (
      path: string
    ) => Effect.Effect<string, PlatformError>
    readonly isTextFile: (path: string) => boolean
    readonly buildFileIndex: (
      globs: ReadonlyArray<string>,
      exclude?: ReadonlyArray<string>,
      concurrency?: number
    ) => Effect.Effect<Map<string, string>, PlatformError>
  }
>() {}

const normalize = (p: string) => p.replace(/\\/g, "/")

const matchGlob = (pattern: string, path: string): boolean => {
  // Expand braces like {ts,js} -> (ts|js)
  let expandedPattern = pattern.replace(/\{([^}]+)\}/g, (_match, group) => {
    const options = group.split(",")
    return `(${options.join("|")})`
  })

  const regexPattern = expandedPattern
    .replace(/\*\*\//g, "GLOBSTAR_SLASH") // **/ placeholder
    .replace(/\/\*\*/g, "SLASH_GLOBSTAR") // /** placeholder
    .replace(/\./g, "\\.") // Escape dots
    .replace(/\*/g, "[^/]*") // Single *
    .replace(/\?/g, "[^/]")
    .replace(/GLOBSTAR_SLASH/g, "(.*/)?") // **/ matches zero or more path segments
    .replace(/SLASH_GLOBSTAR/g, "(/.*)?") // /** matches zero or more path segments

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(path)
}

const getGlobBase = (pattern: string, pathSvc: Path.Path): string => {
  const p = normalize(pattern)
  const firstMeta = p.search(/[*?[{]/)
  if (firstMeta === -1) {
    return normalize(pathSvc.dirname(p))
  }
  const slashIdx = p.lastIndexOf("/", firstMeta)
  return slashIdx === -1 ? "" : p.slice(0, slashIdx)
}

const shouldInclude = (
  absPath: string,
  relPath: string,
  globs: string[],
  exclude: string[]
): boolean => {
  const matches = (pat: string) => matchGlob(pat, absPath) || matchGlob(pat, relPath)
  const include = globs.some(matches)
  const isExcluded = exclude.some(matches)
  return include && !isExcluded
}

export const FileDiscoveryLive = Layer.effect(
  FileDiscovery,
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const cache = new Map<string, string>()

    const isTextFile = (filePath: string): boolean => {
      const ext = path.extname(filePath)
      return TEXT_EXTENSIONS.has(ext)
    }

    const listFiles = (
      globs: ReadonlyArray<string>,
      exclude: ReadonlyArray<string> = []
    ): Effect.Effect<string[], PlatformError> =>
      Effect.gen(function*() {
        if (globs.length === 0) return []

        const cwd = yield* Effect.sync(() => process.cwd())
        const cwdNorm = normalize(cwd)

        const includePats = [...globs].map(normalize)
        const excludePats = [...exclude].map(normalize)

        const roots = new Set<string>()
        for (const g of includePats) {
          const base = getGlobBase(g, path)
          const absBase = base
            ? (path.isAbsolute(base) ? base : normalize(path.join(cwd, base)))
            : cwdNorm
          roots.add(absBase)
        }

        const walk = (dirAbs: string): Effect.Effect<string[], PlatformError> =>
          Effect.gen(function*() {
            const entries = yield* fs.readDirectory(dirAbs)
            const out: string[] = []

            for (const entry of entries) {
              const full = normalize(path.join(dirAbs, entry))
              const stat = yield* fs.stat(full)
              if (stat.type === "Directory") {
                const sub = yield* walk(full)
                out.push(...sub)
              } else if (stat.type === "File") {
                const rel = normalize(path.relative(cwdNorm, full))
                if (shouldInclude(full, rel, includePats, excludePats)) {
                  out.push(full)
                }
              }
            }

            return out
          })

        const allFilesNested = yield* Effect.forEach(Array.from(roots), walk, { concurrency: 4 })
        const allFiles = allFilesNested.flat()

        const uniqueFiles = Array.from(new Set(allFiles)).sort()
        return uniqueFiles
      })

    const readFile = (filePath: string): Effect.Effect<string, PlatformError> =>
      Effect.gen(function*() {
        const cached = cache.get(filePath)
        if (cached !== undefined) {
          return cached
        }

        const content = yield* fs.readFileString(filePath)
        cache.set(filePath, content)
        return content
      })

    const buildFileIndex = (
      globs: ReadonlyArray<string>,
      exclude: ReadonlyArray<string> = [],
      concurrency: number = 4
    ): Effect.Effect<Map<string, string>, PlatformError> =>
      Effect.gen(function*() {
        const files = yield* listFiles(globs, exclude)
        const textFiles = files.filter(isTextFile)

        const entries = yield* Effect.forEach(
          textFiles,
          file =>
            Effect.gen(function*() {
              const content = yield* readFile(file)
              return [file, content] as const
            }),
          { concurrency }
        )

        return new Map(entries)
      })

    return {
      listFiles,
      readFile,
      isTextFile,
      buildFileIndex
    }
  })
)
