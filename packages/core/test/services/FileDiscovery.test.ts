import * as NodeContext from "@effect/platform-node/NodeContext"
import * as Path from "@effect/platform/Path"
import { expect, it, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { FileDiscovery, FileDiscoveryLive } from "../../src/services/FileDiscovery.js"

const testDir = new URL(".", import.meta.url).pathname

const TestLayer = FileDiscoveryLive.pipe(
  Layer.provide(NodeContext.layer),
  Layer.merge(NodeContext.layer)
)

layer(TestLayer)("FileDiscovery", it => {
  it.effect("should list files matching glob patterns", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles(
        [`${fixturesDir}/**/*.ts`],
        ["**/node_modules/**"]
      )

      expect(files.length).toBeGreaterThan(0)
      expect(files.every(f => f.endsWith(".ts"))).toBe(true)
      expect(files.some(f => f.includes("index.ts"))).toBe(true)
    }))

  it.effect("should respect exclude patterns", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles(
        [`${fixturesDir}/**/*.{ts,js}`],
        [`${fixturesDir}/**/services/**`]
      )

      expect(files.every(f => !f.includes("/services/"))).toBe(true)
    }))

  it.effect("should handle multiple glob patterns", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles(
        [
          `${fixturesDir}/**/*.ts`,
          `${fixturesDir}/**/*.md`
        ],
        ["**/node_modules/**"]
      )

      const hasTs = files.some(f => f.endsWith(".ts"))
      const hasMd = files.some(f => f.endsWith(".md"))

      expect(hasTs).toBe(true)
      expect(hasMd).toBe(true)
    }))

  it.effect("should handle ** glob for nested directories", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles(
        [`${fixturesDir}/**/utils/**/*.ts`]
      )

      expect(files.every(f => f.includes("/utils/"))).toBe(true)
      expect(files.some(f => f.includes("helper.ts"))).toBe(true)
    }))

  it.effect("should handle * glob for single directory level", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles(
        [`${fixturesDir}/src/*.ts`]
      )

      expect(files.every(f => {
        const parts = f.split("/")
        return parts[parts.length - 2] === "src"
      })).toBe(true)
    }))

  it.effect("should cache file reads", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles([`${fixturesDir}/**/*.ts`])

      expect(files.length).toBeGreaterThan(0)

      const file = files[0]
      const content1 = yield* discovery.readFile(file)
      const content2 = yield* discovery.readFile(file)

      expect(content1).toBe(content2)
      expect(content1).toBe(content2)
    }))

  it.effect("should read file content correctly", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const indexPath = `${fixturesDir}/src/index.ts`

      const content = yield* discovery.readFile(indexPath)

      expect(content).toContain("import")
      expect(content).toContain("Effect")
    }))

  it.effect("isTextFile should identify text files by extension", () =>
    Effect.gen(function*() {
      const discovery = yield* FileDiscovery

      expect(discovery.isTextFile("file.ts")).toBe(true)
      expect(discovery.isTextFile("file.tsx")).toBe(true)
      expect(discovery.isTextFile("file.js")).toBe(true)
      expect(discovery.isTextFile("file.jsx")).toBe(true)
      expect(discovery.isTextFile("file.json")).toBe(true)
      expect(discovery.isTextFile("file.md")).toBe(true)
      expect(discovery.isTextFile("file.txt")).toBe(true)
      expect(discovery.isTextFile("file.yml")).toBe(true)
      expect(discovery.isTextFile("file.yaml")).toBe(true)

      expect(discovery.isTextFile("file.png")).toBe(false)
      expect(discovery.isTextFile("file.jpg")).toBe(false)
      expect(discovery.isTextFile("file.bin")).toBe(false)
    }))

  it.effect("buildFileIndex should create a map with limited concurrency", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const index = yield* discovery.buildFileIndex(
        [`${fixturesDir}/**/*.ts`],
        ["**/node_modules/**"],
        2
      )

      expect(index.size).toBeGreaterThan(0)

      for (const [file, content] of index.entries()) {
        expect(file.endsWith(".ts")).toBe(true)
        expect(typeof content).toBe("string")
        expect(content.length).toBeGreaterThan(0)
      }
    }))

  it.effect("buildFileIndex should only include text files", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const index = yield* discovery.buildFileIndex(
        [`${fixturesDir}/**/*`],
        ["**/node_modules/**"]
      )

      for (const file of index.keys()) {
        expect(discovery.isTextFile(file)).toBe(true)
      }
    }))

  it.effect("should return empty array for non-matching globs", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles([`${fixturesDir}/**/*.nonexistent`])

      expect(files).toEqual([])
    }))

  it.effect("should return sorted file list", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles([`${fixturesDir}/**/*.ts`])

      const sorted = [...files].sort()
      expect(files).toEqual(sorted)
    }))

  it.effect("should handle edge case: empty glob array", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const cwd = yield* Effect.sync(() => process.cwd())
      const fixturesDir = path.join(cwd, "test/fixtures/sample-project")
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles([])

      expect(files).toEqual([])
    }))
})
