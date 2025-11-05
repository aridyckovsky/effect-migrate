import type { RuleContext } from "@effect-migrate/core"
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { noAsyncAwait } from "../src/patterns.js"

describe("Pattern Rules", () => {
  it.effect("noAsyncAwait rule is properly configured", () =>
    Effect.gen(function*() {
      expect(noAsyncAwait.id).toBe("no-async-await")
      expect(noAsyncAwait.kind).toBe("pattern")
      expect(typeof noAsyncAwait.run).toBe("function")
    }))

  it.effect("noAsyncAwait detects async functions", () =>
    Effect.gen(function*() {
      const mockContext: RuleContext = {
        cwd: "/test",
        path: ".",
        listFiles: () => Effect.succeed(["example.ts"]),
        readFile: () => Effect.succeed("async function fetchData() { return 42 }"),
        getImportIndex: () =>
          Effect.succeed({
            getImports: () => [],
            getImporters: () => []
          }),
        config: {},
        logger: {
          debug: () => Effect.void,
          info: () => Effect.void
        }
      }

      const results = yield* noAsyncAwait.run(mockContext)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe("no-async-await")
      expect(results[0].severity).toBe("warning")
    }))

  it.effect("noAsyncAwait detects async arrow functions", () =>
    Effect.gen(function*() {
      const mockContext: RuleContext = {
        cwd: "/test",
        path: ".",
        listFiles: () => Effect.succeed(["example.ts"]),
        readFile: () => Effect.succeed("const fetchData = async () => { return 42 }"),
        getImportIndex: () =>
          Effect.succeed({
            getImports: () => [],
            getImporters: () => []
          }),
        config: {},
        logger: {
          debug: () => Effect.void,
          info: () => Effect.void
        }
      }

      const results = yield* noAsyncAwait.run(mockContext)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe("no-async-await")
      expect(results[0].severity).toBe("warning")
      expect(results[0].message).toContain("Effect.gen")
      expect(results[0].message).toContain("async")
    }))

  it.effect("noAsyncAwait detects async arrow functions with parameters", () =>
    Effect.gen(function*() {
      const mockContext: RuleContext = {
        cwd: "/test",
        path: ".",
        listFiles: () => Effect.succeed(["example.ts"]),
        readFile: () =>
          Effect.succeed("const processUser = async (id, name) => { return { id, name } }"),
        getImportIndex: () =>
          Effect.succeed({
            getImports: () => [],
            getImporters: () => []
          }),
        config: {},
        logger: {
          debug: () => Effect.void,
          info: () => Effect.void
        }
      }

      const results = yield* noAsyncAwait.run(mockContext)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe("no-async-await")
      expect(results[0].severity).toBe("warning")
      expect(results[0].message).toContain("Effect.gen")
      expect(results[0].message).toContain("async")
    }))

  it.effect("noAsyncAwait detects async arrow functions with single parameter", () =>
    Effect.gen(function*() {
      const mockContext: RuleContext = {
        cwd: "/test",
        path: ".",
        listFiles: () => Effect.succeed(["example.ts"]),
        readFile: () => Effect.succeed("const getData = async x => x * 2"),
        getImportIndex: () =>
          Effect.succeed({
            getImports: () => [],
            getImporters: () => []
          }),
        config: {},
        logger: {
          debug: () => Effect.void,
          info: () => Effect.void
        }
      }

      const results = yield* noAsyncAwait.run(mockContext)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe("no-async-await")
      expect(results[0].severity).toBe("warning")
      expect(results[0].message).toContain("Effect.gen")
      expect(results[0].message).toContain("async")
    }))

  it.effect("noAsyncAwait detects async arrow functions with destructured parameters", () =>
    Effect.gen(function*() {
      const mockContext: RuleContext = {
        cwd: "/test",
        path: ".",
        listFiles: () => Effect.succeed(["example.ts"]),
        readFile: () =>
          Effect.succeed(
            "const handler = async ({ id, name }) => { return await fetchData(id, name) }"
          ),
        getImportIndex: () =>
          Effect.succeed({
            getImports: () => [],
            getImporters: () => []
          }),
        config: {},
        logger: {
          debug: () => Effect.void,
          info: () => Effect.void
        }
      }

      const results = yield* noAsyncAwait.run(mockContext)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe("no-async-await")
      expect(results[0].severity).toBe("warning")
      expect(results[0].message).toContain("Effect.gen")
      expect(results[0].message).toContain("async")
    }))

  it.effect("noAsyncAwait detects nested async arrow functions", () =>
    Effect.gen(function*() {
      const mockContext: RuleContext = {
        cwd: "/test",
        path: ".",
        listFiles: () => Effect.succeed(["example.ts"]),
        readFile: () =>
          Effect.succeed(`const outer = async () => {
  const inner = async () => {
    return await process()
  }
  return await inner()
}`),
        getImportIndex: () =>
          Effect.succeed({
            getImports: () => [],
            getImporters: () => []
          }),
        config: {},
        logger: {
          debug: () => Effect.void,
          info: () => Effect.void
        }
      }

      const results = yield* noAsyncAwait.run(mockContext)

      // Should detect both outer and inner async functions
      expect(results.length).toBeGreaterThanOrEqual(2)
      expect(results[0].id).toBe("no-async-await")
      expect(results[0].severity).toBe("warning")
      expect(results[0].message).toContain("Effect.gen")
      expect(results[0].message).toContain("async")
      expect(results[1].id).toBe("no-async-await")
      expect(results[1].severity).toBe("warning")
    }))

  it.effect("noAsyncAwait detects async arrow functions with typed parameters", () =>
    Effect.gen(function*() {
      const mockContext: RuleContext = {
        cwd: "/test",
        path: ".",
        listFiles: () => Effect.succeed(["example.ts"]),
        readFile: () =>
          Effect.succeed(
            "const transform = async (x: string, y: number) => { return await process(x, y) }"
          ),
        getImportIndex: () =>
          Effect.succeed({
            getImports: () => [],
            getImporters: () => []
          }),
        config: {},
        logger: {
          debug: () => Effect.void,
          info: () => Effect.void
        }
      }

      const results = yield* noAsyncAwait.run(mockContext)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe("no-async-await")
      expect(results[0].severity).toBe("warning")
      expect(results[0].message).toContain("Effect.gen")
      expect(results[0].message).toContain("async")
    }))

  it.effect("noAsyncAwait ignores Effect.gen code", () =>
    Effect.gen(function*() {
      const mockContext: RuleContext = {
        cwd: "/test",
        path: ".",
        listFiles: () => Effect.succeed(["migrated.ts"]),
        readFile: () =>
          Effect.succeed(`
        import { Effect } from "effect"
        
        const fetchData = Effect.gen(function* () {
          const data = yield* someEffect
          return data
        })
      `),
        getImportIndex: () =>
          Effect.succeed({
            getImports: () => [],
            getImporters: () => []
          }),
        config: {},
        logger: {
          debug: () => Effect.void,
          info: () => Effect.void
        }
      }

      const results = yield* noAsyncAwait.run(mockContext)

      expect(results).toHaveLength(0)
    }))
})
