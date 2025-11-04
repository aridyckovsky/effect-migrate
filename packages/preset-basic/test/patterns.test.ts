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
