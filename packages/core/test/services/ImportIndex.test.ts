import * as NodeContext from "@effect/platform-node/NodeContext"
import * as Path from "@effect/platform/Path"
import { expect, it, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { FileDiscoveryLive } from "../../src/services/FileDiscovery.js"
import { ImportIndex, ImportIndexLive } from "../../src/services/ImportIndex.js"

const testDir = new URL(".", import.meta.url).pathname

const TestLayer = ImportIndexLive.pipe(
  Layer.provide(FileDiscoveryLive),
  Layer.provide(NodeContext.layer),
  Layer.merge(NodeContext.layer)
)

layer(TestLayer)("ImportIndex", it => {
  it.effect("should extract ES6 import statements", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      const index = yield* importIndexService.getImportIndex(
        [`${fixturesDir}/src/index.ts`],
        ["**/node_modules/**"]
      )

      const indexFile = Array.from(index.keys()).find(f => f.includes("index.ts"))
      expect(indexFile).toBeDefined()

      if (indexFile) {
        const imports = index.get(indexFile) ?? []
        expect(imports.some(imp => imp.includes("helper") || imp.includes("utils"))).toBe(true)
        expect(imports.some(imp => imp.includes("Effect"))).toBe(true)
      }
    }))

  it.effect("should extract require() calls", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      const index = yield* importIndexService.getImportIndex(
        [`${fixturesDir}/src/legacy.js`],
        []
      )

      const legacyFile = Array.from(index.keys()).find(f => f.includes("legacy.js"))
      expect(legacyFile).toBeDefined()

      if (legacyFile) {
        const imports = index.get(legacyFile) ?? []
        expect(imports.some(imp => imp.includes("fs") || imp === "pkg:fs")).toBe(true)
        expect(imports.some(imp => imp.includes("path") || imp === "pkg:path")).toBe(true)
      }
    }))

  it.effect("should resolve relative imports", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      const index = yield* importIndexService.getImportIndex(
        [`${fixturesDir}/src/**/*.ts`],
        []
      )

      const apiFile = Array.from(index.keys()).find(f => f.includes("services/api.ts"))
      expect(apiFile).toBeDefined()

      if (apiFile) {
        const imports = index.get(apiFile) ?? []
        expect(imports.some(imp => imp.includes("helper"))).toBe(true)
      }
    }))

  it.effect("should prefix external packages with pkg:", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      const index = yield* importIndexService.getImportIndex(
        [`${fixturesDir}/src/index.ts`],
        []
      )

      const indexFile = Array.from(index.keys()).find(f => f.includes("index.ts"))
      if (indexFile) {
        const imports = index.get(indexFile) ?? []
        const effectImport = imports.find(imp => imp.includes("Effect"))
        expect(effectImport).toBeDefined()
        if (effectImport) {
          expect(effectImport.startsWith("pkg:")).toBe(true)
        }
      }
    }))

  it.effect("should cache index on subsequent calls", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      const globs = [`${fixturesDir}/src/**/*.ts`]
      const exclude = ["**/node_modules/**"]

      const index1 = yield* importIndexService.getImportIndex(globs, exclude)
      const index2 = yield* importIndexService.getImportIndex(globs, exclude)

      expect(index1.size).toBe(index2.size)
      expect(Array.from(index1.keys()).sort()).toEqual(Array.from(index2.keys()).sort())
    }))

  it.effect("should build forward index (file -> imports)", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      yield* importIndexService.getImportIndex(
        [`${fixturesDir}/src/**/*.ts`],
        []
      )

      const helperFile = `${fixturesDir}/src/utils/helper.ts`
      const imports = yield* importIndexService.getImportsOf(helperFile)

      expect(Array.isArray(imports)).toBe(true)
      expect(imports.some(imp => imp.includes("Effect"))).toBe(true)
    }))

  it.effect("should build reverse index (module -> dependents)", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      yield* importIndexService.getImportIndex(
        [`${fixturesDir}/src/**/*.ts`],
        []
      )

      const helperPath = `${fixturesDir}/src/utils/helper.ts`
      const dependents = yield* importIndexService.getDependentsOf(helperPath)

      expect(Array.isArray(dependents)).toBe(true)
      expect(dependents.length).toBeGreaterThan(0)
      expect(dependents.some(dep => dep.includes("index.ts") || dep.includes("api.ts"))).toBe(true)
    }))

  it.effect("should return empty array for files with no imports", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      yield* importIndexService.getImportIndex(
        [`${fixturesDir}/**/*.md`],
        []
      )

      const readmeFile = `${fixturesDir}/README.md`
      const imports = yield* importIndexService.getImportsOf(readmeFile)

      expect(imports).toEqual([])
    }))

  it.effect("should handle files with no dependents", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      yield* importIndexService.getImportIndex(
        [`${fixturesDir}/src/**/*.ts`],
        []
      )

      const indexFile = `${fixturesDir}/src/index.ts`
      const dependents = yield* importIndexService.getDependentsOf(indexFile)

      expect(Array.isArray(dependents)).toBe(true)
    }))

  it.effect("should handle export statements", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      const index = yield* importIndexService.getImportIndex(
        [`${fixturesDir}/src/**/*.ts`],
        []
      )

      const hasExports = Array.from(index.values()).some(imports => imports.length > 0)
      expect(hasExports).toBe(true)
    }))

  it.effect("should respect exclude patterns", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      const index = yield* importIndexService.getImportIndex(
        [`${fixturesDir}/**/*.ts`],
        [`${fixturesDir}/src/services/**`]
      )

      const files = Array.from(index.keys())
      expect(files.every(f => !f.includes("/services/"))).toBe(true)
    }))

  it.effect("should handle multiple file patterns concurrently", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const importIndexService = yield* ImportIndex

      const index = yield* importIndexService.getImportIndex(
        [`${fixturesDir}/**/*.ts`, `${fixturesDir}/**/*.js`],
        [],
        4
      )

      expect(index.size).toBeGreaterThan(0)

      const hasTs = Array.from(index.keys()).some(f => f.endsWith(".ts"))
      const hasJs = Array.from(index.keys()).some(f => f.endsWith(".js"))

      expect(hasTs).toBe(true)
      expect(hasJs).toBe(true)
    }))

  it.effect("should fail gracefully when index not built for getImportsOf", () =>
    Effect.gen(function*() {
      // Create a fresh service instance for this test
      const freshLayer = Layer.provide(
        Layer.provide(ImportIndexLive, FileDiscoveryLive),
        NodeContext.layer
      )

      const result = yield* Effect.gen(function*() {
        const importIndexService = yield* ImportIndex
        return yield* Effect.either(
          importIndexService.getImportsOf("nonexistent.ts")
        )
      }).pipe(Effect.provide(freshLayer))

      expect(result._tag).toBe("Left")
    }))

  it.effect("should fail gracefully when index not built for getDependentsOf", () =>
    Effect.gen(function*() {
      // Create a fresh service instance for this test
      const freshLayer = Layer.provide(
        Layer.provide(ImportIndexLive, FileDiscoveryLive),
        NodeContext.layer
      )

      const result = yield* Effect.gen(function*() {
        const importIndexService = yield* ImportIndex
        return yield* Effect.either(
          importIndexService.getDependentsOf("nonexistent.ts")
        )
      }).pipe(Effect.provide(freshLayer))

      expect(result._tag).toBe("Left")
    }))
})
