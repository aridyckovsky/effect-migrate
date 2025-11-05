/**
 * File Discovery Service - Abstract file system operations with lazy loading and caching
 *
 * This module provides a service for discovering and reading files with:
 * - Glob pattern matching
 * - Lazy file loading (list paths without reading contents)
 * - Content caching to avoid redundant I/O
 * - Platform-agnostic file system abstraction
 *
 * @module @effect-migrate/core/services/FileDiscovery
 * @since 0.1.0
 */

import type { PlatformError } from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { matchGlob } from "../util/glob.js"

/**
 * Supported text file extensions for content reading.
 *
 * @category Constant
 * @since 0.1.0
 */
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

/**
 * File discovery service interface.
 *
 * Provides methods for listing files by glob patterns and reading file contents
 * with automatic caching. All file operations are lazy to avoid loading
 * unnecessary files into memory.
 *
 * @category Service
 * @since 0.1.0
 */
export interface FileDiscoveryService {
  /** List files matching glob patterns with optional exclusions */
  readonly listFiles: (
    globs: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>
  ) => Effect.Effect<string[], PlatformError>

  /** Read file content (cached after first read) */
  readonly readFile: (
    path: string
  ) => Effect.Effect<string, PlatformError>

  /** Check if file extension is in TEXT_EXTENSIONS set */
  readonly isTextFile: (path: string) => boolean

  /** Build complete file index with concurrent reads */
  readonly buildFileIndex: (
    globs: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>,
    concurrency?: number
  ) => Effect.Effect<Map<string, string>, PlatformError>
}

/**
 * File discovery service tag for dependency injection.
 *
 * @category Service
 * @since 0.1.0
 */
export class FileDiscovery extends Context.Tag("FileDiscovery")<
  FileDiscovery,
  FileDiscoveryService
>() {}

/**
 * Normalize path separators to forward slashes (POSIX-style).
 *
 * @category Internal
 * @since 0.1.0
 */
const normalize = (p: string) => p.replace(/\\/g, "/")

/**
 * Extract base directory from glob pattern for optimized traversal.
 *
 * Returns the longest static path prefix before any glob metacharacters.
 *
 * @category Internal
 * @since 0.1.0
 */
const getGlobBase = (pattern: string, pathSvc: Path.Path): string => {
  const p = normalize(pattern)
  const firstMeta = p.search(/[*?[{]/)
  if (firstMeta === -1) {
    return normalize(pathSvc.dirname(p))
  }
  const slashIdx = p.lastIndexOf("/", firstMeta)
  return slashIdx === -1 ? "" : p.slice(0, slashIdx)
}

/**
 * Determine if file should be included based on glob patterns.
 *
 * A file is included if it matches at least one include glob and
 * doesn't match any exclude glob.
 *
 * @category Internal
 * @since 0.1.0
 */
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

/**
 * Live implementation of FileDiscovery service.
 *
 * Provides platform-agnostic file discovery with:
 * - Lazy file loading (lists paths without reading contents upfront)
 * - Automatic content caching for performance
 * - Concurrent file reading with configurable limits
 * - Optimized glob matching by traversing from pattern base
 *
 * @category Layer
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * import { FileDiscovery, FileDiscoveryLive } from "@effect-migrate/core"
 *
 * const program = Effect.gen(function*() {
 *   const discovery = yield* FileDiscovery
 *   const files = yield* discovery.listFiles(
 *     ["src/**\/*.ts"],
 *     ["node_modules/**", "dist/**"]
 *   )
 *   return files
 * }).pipe(Effect.provide(FileDiscoveryLive))
 * ```
 */
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
                // Check if directory itself is excluded before recursing
                const relDir = normalize(path.relative(cwdNorm, full))

                // Helper to strip trailing /** from exclude patterns
                const stripTrailingGlobDir = (p: string) => p.replace(/\/\*\*$/, "")

                // Match directory path against exclude patterns (both absolute and relative)
                const isExcluded = excludePats.some(excl => {
                  const exclBase = stripTrailingGlobDir(excl)
                  return (
                    matchGlob(excl, relDir) ||
                    matchGlob(excl, full) ||
                    matchGlob(exclBase, relDir) ||
                    matchGlob(exclBase, full)
                  )
                })

                if (!isExcluded) {
                  const sub = yield* walk(full)
                  out.push(...sub)
                }
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
