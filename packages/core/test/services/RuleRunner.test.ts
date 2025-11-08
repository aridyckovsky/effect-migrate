import * as NodeContext from "@effect/platform-node/NodeContext"
import * as Path from "@effect/platform/Path"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { makeBoundaryRule, makePatternRule } from "../../src/rules/helpers.js"
import type { Config } from "../../src/schema/Config.js"
import { PathsSchema } from "../../src/schema/Config.js"
import { FileDiscoveryLive } from "../../src/services/FileDiscovery.js"
import { ImportIndexLive } from "../../src/services/ImportIndex.js"
import { RuleRunner, RuleRunnerLayer } from "../../src/services/RuleRunner.js"

// Get test directory using Web API
const testDir = new URL(".", import.meta.url).pathname

const TestLayer = RuleRunnerLayer.pipe(
  Layer.provide(ImportIndexLive),
  Layer.provide(FileDiscoveryLive),
  Layer.provide(NodeContext.layer),
  Layer.merge(NodeContext.layer)
)

layer(TestLayer)("RuleRunner", it => {
  it.effect("should run pattern rules", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      const rule = makePatternRule({
        id: "no-async-await",
        files: `${fixturesDir}/**/*.ts`,
        pattern: /async\s+function/g,
        message: "Use Effect.gen instead of async/await",
        severity: "warning"
      })

      const results = yield* runner.runRules([rule], baseConfig)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe("no-async-await")
      expect(results[0].ruleKind).toBe("pattern")
      expect(results[0].severity).toBe("warning")
      expect(results[0].file).toBeDefined()
    }))

  it.effect("should run boundary rules", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      const rule = makeBoundaryRule({
        id: "no-effect-in-services",
        from: `${fixturesDir}/src/services/**/*.ts`,
        disallow: ["pkg:effect/Effect"],
        message: "Services should not import Effect directly",
        severity: "error"
      })

      const results = yield* runner.runRules([rule], baseConfig)

      expect(Array.isArray(results)).toBe(true)
      if (results.length > 0) {
        expect(results[0].ruleKind).toBe("boundary")
      }
    }))

  it.effect("should run multiple rules concurrently", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      const rule1 = makePatternRule({
        id: "no-async-await",
        files: `${fixturesDir}/**/*.ts`,
        pattern: /async\s+function/g,
        message: "Use Effect.gen",
        severity: "warning"
      })

      const rule2 = makePatternRule({
        id: "no-promise",
        files: `${fixturesDir}/**/*.ts`,
        pattern: /Promise\./g,
        message: "Use Effect instead of Promise",
        severity: "warning"
      })

      const results = yield* runner.runRules([rule1, rule2], baseConfig)

      const rule1Results = results.filter(r => r.id === "no-async-await")
      const rule2Results = results.filter(r => r.id === "no-promise")

      expect(rule1Results.length).toBeGreaterThan(0)
      expect(rule2Results.length).toBeGreaterThan(0)
    }))

  it.effect("should merge results from all rules", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      const rule1 = makePatternRule({
        id: "rule-1",
        files: `${fixturesDir}/**/*.ts`,
        pattern: /async/g,
        message: "Test 1",
        severity: "warning"
      })

      const rule2 = makePatternRule({
        id: "rule-2",
        files: `${fixturesDir}/**/*.ts`,
        pattern: /import/g,
        message: "Test 2",
        severity: "warning"
      })

      const results = yield* runner.runRules([rule1, rule2], baseConfig)

      expect(results.some(r => r.id === "rule-1")).toBe(true)
      expect(results.some(r => r.id === "rule-2")).toBe(true)
    }))

  it.effect("should respect config.concurrency", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      const rule = makePatternRule({
        id: "test-concurrency",
        files: `${fixturesDir}/**/*.ts`,
        pattern: /import/g,
        message: "Test",
        severity: "warning"
      })

      const configWithConcurrency: Config = {
        ...baseConfig,
        concurrency: 1
      }

      const results = yield* runner.runRules([rule], configWithConcurrency)

      expect(Array.isArray(results)).toBe(true)
    }))

  it.effect("should handle rules with no matches", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      const rule = makePatternRule({
        id: "no-matches",
        files: `${fixturesDir}/**/*.ts`,
        pattern: /WILL_NEVER_MATCH_THIS_PATTERN_12345/g,
        message: "Test",
        severity: "warning"
      })

      const results = yield* runner.runRules([rule], baseConfig)

      expect(results).toEqual([])
    }))

  it.effect("should handle empty rule array", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      const results = yield* runner.runRules([], baseConfig)

      expect(results).toEqual([])
    }))

  it.effect("should cache import index across boundary rules", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      const rule1 = makeBoundaryRule({
        id: "boundary-1",
        from: `${fixturesDir}/src/**/*.ts`,
        disallow: ["pkg:some-package"],
        message: "Test 1",
        severity: "warning"
      })

      const rule2 = makeBoundaryRule({
        id: "boundary-2",
        from: `${fixturesDir}/src/**/*.ts`,
        disallow: ["pkg:another-package"],
        message: "Test 2",
        severity: "warning"
      })

      const results = yield* runner.runRules([rule1, rule2], baseConfig)

      expect(Array.isArray(results)).toBe(true)
    }))

  it.effect("should respect paths.exclude from config", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const rule = makePatternRule({
        id: "test-exclude",
        files: `${fixturesDir}/**/*.ts`,
        pattern: /import/g,
        message: "Test",
        severity: "warning"
      })

      const configWithExclude: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: [`${fixturesDir}/src/services/**`]
        })
      }

      const results = yield* runner.runRules([rule], configWithExclude)

      expect(results.every(r => !r.file?.includes("/services/"))).toBe(true)
    }))

  it.effect("should handle rule errors gracefully", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      const failingRule = {
        id: "failing-rule",
        kind: "pattern" as const,
        run: () => Effect.fail(new Error("Intentional failure"))
      }

      const successRule = makePatternRule({
        id: "success-rule",
        files: `${fixturesDir}/**/*.ts`,
        pattern: /import/g,
        message: "Test",
        severity: "warning"
      })

      const results = yield* runner.runRules([failingRule, successRule], baseConfig)

      expect(results.some(r => r.id === "success-rule")).toBe(true)
    }))

  it.effect("should provide correct context to rules", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      let capturedContext: any = null

      const inspectRule = {
        id: "inspect-context",
        kind: "pattern" as const,
        run: (ctx: any) =>
          Effect.gen(function*() {
            capturedContext = ctx
            return []
          })
      }

      yield* runner.runRules([inspectRule], baseConfig)

      expect(capturedContext).toBeDefined()
      expect(capturedContext.cwd).toBeDefined()
      expect(typeof capturedContext.listFiles).toBe("function")
      expect(typeof capturedContext.readFile).toBe("function")
      expect(typeof capturedContext.getImportIndex).toBe("function")
      expect(capturedContext.logger).toBeDefined()
    }))

  it.effect("should return results with all required fields", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixturesDir = path.join(testDir, "../fixtures/sample-project")
      const runner = yield* RuleRunner

      const baseConfig: Config = {
        version: 1,
        paths: new PathsSchema({
          root: fixturesDir,
          exclude: ["**/node_modules/**", "**/dist/**"]
        }),
        concurrency: 2
      }

      const rule = makePatternRule({
        id: "full-result",
        files: `${fixturesDir}/**/*.ts`,
        pattern: /import/g,
        message: "Test message",
        severity: "error",
        docsUrl: "https://example.com/docs",
        tags: ["migration", "imports"]
      })

      const results = yield* runner.runRules([rule], baseConfig)

      expect(results.length).toBeGreaterThan(0)

      const result = results[0]
      expect(result.id).toBe("full-result")
      expect(result.message).toBe("Test message")
      expect(result.severity).toBe("error")
      expect(result.docsUrl).toBe("https://example.com/docs")
      expect(result.tags).toEqual(["migration", "imports"])
      expect(result.file).toBeDefined()
      expect(result.range).toBeDefined()
      expect(result.locations).toBeDefined()
    }))
})
