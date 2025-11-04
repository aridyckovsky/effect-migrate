import { makePatternRule } from "@effect-migrate/core"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import type { RuleContext } from "../src/rules/types.js"

describe("Rule Helpers", () => {
  it.effect("makePatternRule creates a valid rule", () =>
  Effect.gen(function* () {
    const rule = makePatternRule({
      id: "test-rule",
      files: "**/*.ts",
      pattern: /test/g,
      message: "Test pattern found",
      severity: "warning"
    })

    expect(rule.id).toBe("test-rule")
    expect(rule.kind).toBe("pattern")
    expect(typeof rule.run).toBe("function")
  }))

it.effect("makePatternRule detects pattern matches", () =>
  Effect.gen(function* () {
    const rule = makePatternRule({
      id: "detect-async",
      files: "**/*.ts",
      pattern: /async function/g,
      message: "Async function detected",
      severity: "warning"
    })

    const mockContext: RuleContext = {
      cwd: "/test",
      path: ".",
      listFiles: () => Effect.succeed(["test.ts"]),
      readFile: () => Effect.succeed("async function foo() { return 42 }"),
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

    const results = yield* rule.run(mockContext)

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("detect-async")
    expect(results[0].file).toBe("test.ts")
    expect(results[0].severity).toBe("warning")
  }))
})
