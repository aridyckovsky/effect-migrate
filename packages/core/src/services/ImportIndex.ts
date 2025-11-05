/**
 * Import Index Service - Build and query import graphs for boundary rules
 *
 * This module provides a service for analyzing project imports to enforce
 * architectural boundaries. Parses import/export/require statements and
 * builds forward/reverse dependency maps.
 *
 * @module @effect-migrate/core/services/ImportIndex
 * @since 0.1.0
 */

import type { PlatformError } from "@effect/platform/Error"
import { FileSystem } from "@effect/platform/FileSystem"
import { Path } from "@effect/platform/Path"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { FileDiscovery } from "./FileDiscovery.js"

/**
 * Error thrown when import parsing fails.
 *
 * @category Error
 * @since 0.1.0
 */
export class ImportParseError extends Data.TaggedError("ImportParseError")<{
  readonly file: string
  readonly message: string
}> {}

/**
 * Regex patterns for matching import/export/require statements.
 *
 * @category Constant
 * @since 0.1.0
 */
const IMPORT_PATTERNS = [
  /import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /export\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
]

/**
 * Supported file extensions for import resolution.
 *
 * @category Constant
 * @since 0.1.0
 */
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]

/**
 * Index file names for directory import resolution.
 *
 * @category Constant
 * @since 0.1.0
 */
const INDEX_FILES = ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"]

/**
 * Import index service interface.
 *
 * Provides methods for building import graphs and querying dependencies.
 * Used by boundary rules to detect violations of architectural constraints.
 *
 * @category Service
 * @since 0.1.0
 */
export interface ImportIndexService {
  readonly getImportIndex: (
    globs: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>,
    concurrency?: number
  ) => Effect.Effect<Map<string, ReadonlyArray<string>>, PlatformError | ImportParseError>
  readonly getImportsOf: (file: string) => Effect.Effect<ReadonlyArray<string>, ImportParseError>
  readonly getDependentsOf: (
    file: string
  ) => Effect.Effect<ReadonlyArray<string>, ImportParseError>
}

/**
 * Import index service tag for dependency injection.
 *
 * @category Service
 * @since 0.1.0
 */
export class ImportIndex extends Context.Tag("ImportIndex")<
  ImportIndex,
  ImportIndexService
>() {}

/**
 * Live implementation of ImportIndex service.
 *
 * Builds import graphs by parsing source files and caches results per
 * glob pattern set. Resolves relative imports to absolute paths and
 * prefixes npm packages with "pkg:".
 *
 * @category Layer
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * import { ImportIndex, ImportIndexLive } from "@effect-migrate/core"
 *
 * const program = Effect.gen(function*() {
 *   const indexService = yield* ImportIndex
 *   const index = yield* indexService.getImportIndex(
 *     ["src/**\/*.ts"],
 *     ["node_modules/**"]
 *   )
 *   const imports = yield* index.getImports("src/index.ts")
 *   return imports
 * }).pipe(Effect.provide(ImportIndexLive))
 * ```
 */
export const ImportIndexLive = Layer.effect(
  ImportIndex,
  Effect.gen(function*() {
    const fileDiscovery = yield* FileDiscovery
    const fs = yield* FileSystem
    const path = yield* Path

    const indexCache = new Map<
      string,
      { forward: Map<string, ReadonlyArray<string>>; reverse: Map<string, ReadonlyArray<string>> }
    >()

    const getCacheKey = (globs: ReadonlyArray<string>, exclude: ReadonlyArray<string>) =>
      JSON.stringify({ globs: [...globs].sort(), exclude: [...exclude].sort() })

    const parseImports = (content: string): ReadonlyArray<string> => {
      const imports = new Set<string>()

      for (const pattern of IMPORT_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags)
        let match
        while ((match = regex.exec(content)) !== null) {
          if (match[1]) {
            imports.add(match[1])
          }
        }
      }

      return Array.from(imports)
    }

    const resolveImport = (fromFile: string, importPath: string): Effect.Effect<string> =>
      Effect.gen(function*() {
        if (!importPath.startsWith(".")) {
          return importPath.startsWith("pkg:") ? importPath : `pkg:${importPath}`
        }

        const fromDir = path.dirname(fromFile)
        const resolvedBase = path.resolve(fromDir, importPath)

        const tryResolve = (candidate: string): Effect.Effect<Option.Option<string>> =>
          fs.exists(candidate).pipe(
            Effect.map(exists => (exists ? Option.some(candidate) : Option.none())),
            Effect.catchAll(() => Effect.succeed(Option.none()))
          )

        const candidates = [
          resolvedBase,
          ...EXTENSIONS.map(ext => `${resolvedBase}${ext}`),
          ...INDEX_FILES.map(idx => `${resolvedBase}${idx}`)
        ]

        for (const candidate of candidates) {
          const result = yield* tryResolve(candidate)
          if (Option.isSome(result)) {
            return result.value
          }
        }

        return resolvedBase
      })

    const parseFileImports = (
      file: string
    ): Effect.Effect<ReadonlyArray<string>, ImportParseError> =>
      Effect.gen(function*() {
        const content = yield* fileDiscovery.readFile(file).pipe(
          Effect.catchAll(() =>
            Effect.fail(new ImportParseError({ file, message: "Failed to read file" }))
          )
        )

        const rawImports = parseImports(content)
        const resolved = yield* Effect.forEach(
          rawImports,
          importPath => resolveImport(file, importPath),
          { concurrency: "unbounded" }
        )

        return resolved
      })

    const buildIndex = (
      globs: ReadonlyArray<string>,
      exclude: ReadonlyArray<string> = [],
      concurrency = 4
    ): Effect.Effect<
      { forward: Map<string, ReadonlyArray<string>>; reverse: Map<string, ReadonlyArray<string>> },
      PlatformError | ImportParseError
    > =>
      Effect.gen(function*() {
        const files = yield* fileDiscovery.listFiles([...globs], [...exclude])
        const cwd = yield* Effect.sync(() => process.cwd())

        const forward = new Map<string, ReadonlyArray<string>>()
        const reverse = new Map<string, ReadonlyArray<string>>()

        const results = yield* Effect.forEach(
          files,
          file =>
            parseFileImports(file).pipe(
              Effect.map(imports => ({ file, imports, error: null })),
              Effect.catchTag("ImportParseError", error =>
                Effect.succeed({ file, imports: [], error }))
            ),
          { concurrency }
        )

        for (const { file, imports } of results) {
          forward.set(file, imports)

          for (const imp of imports) {
            // Normalize absolute paths to relative
            const normalizedImp = path.isAbsolute(imp) ? path.relative(cwd, imp) : imp
            const current = reverse.get(normalizedImp) ?? []
            reverse.set(normalizedImp, [...current, file])
          }
        }

        return { forward, reverse }
      })

    let lastBuiltIndices: {
      forward: Map<string, ReadonlyArray<string>>
      reverse: Map<string, ReadonlyArray<string>>
    } | null = null

    return {
      getImportIndex: (globs, exclude = [], concurrency = 4) =>
        Effect.gen(function*() {
          const cacheKey = getCacheKey(globs, exclude)

          let indices = indexCache.get(cacheKey)
          if (!indices) {
            indices = yield* buildIndex(globs, exclude, concurrency)
            indexCache.set(cacheKey, indices)
          }

          lastBuiltIndices = indices
          return new Map(indices.forward)
        }),

      getImportsOf: file =>
        Effect.gen(function*() {
          if (lastBuiltIndices === null) {
            return yield* Effect.fail(
              new ImportParseError({ file, message: "Index not built. Call getImportIndex first." })
            )
          }
          return lastBuiltIndices.forward.get(file) ?? []
        }),

      getDependentsOf: file =>
        Effect.gen(function*() {
          if (lastBuiltIndices === null) {
            return yield* Effect.fail(
              new ImportParseError({ file, message: "Index not built. Call getImportIndex first." })
            )
          }
          const cwd = yield* Effect.sync(() => process.cwd())
          const normalizedFile = path.isAbsolute(file) ? path.relative(cwd, file) : file
          return lastBuiltIndices.reverse.get(normalizedFile) ?? []
        })
    }
  })
)
