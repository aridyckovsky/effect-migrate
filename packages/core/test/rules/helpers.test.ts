import { describeWrapped, expect } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { makeBoundaryRule, makePatternRule } from "../../src/rules/helpers.js"
import type { RuleContext } from "../../src/rules/types.js"

const createMockContext = (
  files: Record<string, string>,
  importIndex?: Record<string, string[]>
): RuleContext => {
  const fileList = Object.keys(files)

  return {
    cwd: "/test",
    path: "/test",
    listFiles: (globs: string[]) => {
      const matchingFiles = fileList.filter(file => {
        return globs.some(glob => {
          // Convert glob to regex using placeholders to avoid conflicts
          let pattern = glob
            .replace(/\*\*\//g, "GLOBSTAR_SLASH") // **/ placeholder
            .replace(/\/\*\*/g, "SLASH_GLOBSTAR") // /** placeholder
            .replace(/\./g, "\\.") // Escape dots
            .replace(/\*/g, "[^/]*") // * -> [^/]*
            .replace(/\?/g, "[^/]") // ? -> [^/]
            .replace(/GLOBSTAR_SLASH/g, "(?:.*/)?") // **/ -> (?:.*/)?
            .replace(/SLASH_GLOBSTAR/g, "(?:/.*)?") // /** -> (?:/.*)?
          const regex = new RegExp(`^${pattern}$`)
          return regex.test(file)
        })
      })
      return Effect.succeed(matchingFiles)
    },
    readFile: (path: string) => Effect.succeed(files[path] || ""),
    getImportIndex: () =>
      Effect.succeed({
        getImports: (file: string) => Effect.succeed(importIndex?.[file] ?? []),
        getImporters: (module: string) =>
          Effect.succeed(
            Object.entries(importIndex ?? {})
              .filter(([_, imports]) => imports.includes(module))
              .map(([file]) => file)
          )
      }),
    config: {},
    logger: {
      debug: () => Effect.void,
      info: () => Effect.void
    }
  }
}

describeWrapped("helpers", it => {
  it.effect("makePatternRule - should detect string patterns", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "test-pattern",
        files: "src/test.ts",
        pattern: "async function",
        message: "Found async function",
        severity: "warning"
      })

      const ctx = createMockContext({
        "src/test.ts": "async function foo() { return 42 }"
      })

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(1)
      expect(results[0].id).toBe("test-pattern")
      expect(results[0].message).toBe("Found async function")
      expect(results[0].severity).toBe("warning")
    }))

  it.effect("makePatternRule - should detect regex patterns", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "test-regex",
        files: "**/*.ts",
        pattern: /async\s+function/g,
        message: "Found async function",
        severity: "error"
      })

      const ctx = createMockContext({
        "test.ts": "async function foo() {}\nasync function bar() {}"
      })

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(2)
      expect(results.every(r => r.id === "test-regex")).toBe(true)
    }))

  it.effect("makePatternRule - should respect negative patterns", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "test-negative",
        files: "**/*.ts",
        pattern: /async function/g,
        negativePattern: /@effect-ok/,
        message: "Found async function",
        severity: "warning"
      })

      const ctx = createMockContext({
        "bad.ts": "async function foo() {}",
        "good.ts": "// @effect-ok\nasync function bar() {}"
      })

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(1)
      expect(results[0].file).toBe("bad.ts")
    }))

  it.effect("makePatternRule - should handle multiple files", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "multi-file",
        files: ["**/*.ts", "**/*.tsx"],
        pattern: /import React/g,
        message: "Found React import",
        severity: "warning"
      })

      const ctx = createMockContext({
        "a.ts": "import React from 'react'",
        "b.tsx": "import React from 'react'",
        "c.js": "import React from 'react'"
      })

      const results = yield* rule.run(ctx)

      expect(results.length).toBeGreaterThan(0)
    }))

  it.effect("makePatternRule - should calculate correct line and column", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "test-location",
        files: "**/*.ts",
        pattern: /TARGET/g,
        message: "Found target",
        severity: "warning"
      })

      const ctx = createMockContext({
        "test.ts": "line 1\nline 2\nTARGET here\nline 4"
      })

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(1)
      expect(results[0].range).toBeDefined()
      expect(results[0].range?.start.line).toBe(3)
      expect(results[0].locations).toBeDefined()
      expect(results[0].locations?.[0].line).toBe(3)
      expect(results[0].locations?.[0].text).toBe("TARGET")
    }))

  it.effect("makePatternRule - should include optional fields when provided", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "test-optional",
        files: "**/*.ts",
        pattern: /test/g,
        message: "Test",
        severity: "warning",
        docsUrl: "https://example.com/docs",
        tags: ["migration", "test"]
      })

      const ctx = createMockContext({
        "test.ts": "test content"
      })

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(1)
      expect(results[0].docsUrl).toBe("https://example.com/docs")
      expect(results[0].tags).toEqual(["migration", "test"])
    }))

  it.effect("makePatternRule - should not include undefined optional fields", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "test-no-optional",
        files: "**/*.ts",
        pattern: /test/g,
        message: "Test",
        severity: "warning"
      })

      const ctx = createMockContext({
        "test.ts": "test content"
      })

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(1)
      expect("docsUrl" in results[0]).toBe(false)
      expect("tags" in results[0]).toBe(false)
    }))

  it.effect("makePatternRule - should return empty array when no matches", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "no-match",
        files: "**/*.ts",
        pattern: /NEVER_MATCHES/g,
        message: "Test",
        severity: "warning"
      })

      const ctx = createMockContext({
        "test.ts": "some content"
      })

      const results = yield* rule.run(ctx)

      expect(results).toEqual([])
    }))

  it.effect("makeBoundaryRule - should detect disallowed imports", () =>
    Effect.gen(function*() {
      const rule = makeBoundaryRule({
        id: "no-react",
        from: "src/**/*.ts",
        disallow: ["pkg:react"],
        message: "React imports not allowed",
        severity: "error"
      })

      const ctx = createMockContext(
        {
          "src/component.ts": "import React from 'react'"
        },
        {
          "src/component.ts": ["pkg:react"]
        }
      )

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(1)
      expect(results[0].id).toBe("no-react")
      expect(results[0].ruleKind).toBe("boundary")
      expect(results[0].message).toContain("pkg:react")
    }))

  it.effect("makeBoundaryRule - should support glob patterns in disallow", () =>
    Effect.gen(function*() {
      const rule = makeBoundaryRule({
        id: "no-internals",
        from: "src/**/*.ts",
        disallow: ["pkg:react*internals"],
        message: "Internal imports not allowed",
        severity: "error"
      })

      const ctx = createMockContext(
        {
          "src/component.ts": "import internals from 'react/internals'"
        },
        {
          "src/component.ts": ["pkg:react/internals"]
        }
      )

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(1)
    }))

  it.effect("makeBoundaryRule - should handle multiple disallowed patterns", () =>
    Effect.gen(function*() {
      const rule = makeBoundaryRule({
        id: "no-ui-libs",
        from: "src/backend/**/*.ts",
        disallow: ["pkg:react", "pkg:vue", "pkg:angular"],
        message: "UI libraries not allowed in backend",
        severity: "error"
      })

      const ctx = createMockContext(
        {
          "src/backend/api.ts": "import React from 'react'\nimport Vue from 'vue'"
        },
        {
          "src/backend/api.ts": ["pkg:react", "pkg:vue"]
        }
      )

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(2)
    }))

  it.effect("makeBoundaryRule - should include line information", () =>
    Effect.gen(function*() {
      const rule = makeBoundaryRule({
        id: "test-location",
        from: "**/*.ts",
        disallow: ["pkg:test"],
        message: "Test import",
        severity: "warning"
      })

      const ctx = createMockContext(
        {
          "test.ts": "line 1\nimport test from 'test'\nline 3"
        },
        {
          "test.ts": ["pkg:test"]
        }
      )

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(1)
      expect(results[0].range).toBeDefined()
      expect(results[0].range?.start.line).toBe(2)
      expect(results[0].locations).toBeDefined()
      expect(results[0].locations?.[0].line).toBe(2)
    }))

  it.effect("makeBoundaryRule - should handle optional fields", () =>
    Effect.gen(function*() {
      const rule = makeBoundaryRule({
        id: "test-optional",
        from: "**/*.ts",
        disallow: ["pkg:test"],
        message: "Test",
        severity: "error",
        docsUrl: "https://example.com/boundary",
        tags: ["architecture", "boundary"]
      })

      const ctx = createMockContext(
        {
          "test.ts": "import test from 'test'"
        },
        {
          "test.ts": ["pkg:test"]
        }
      )

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(1)
      expect(results[0].docsUrl).toBe("https://example.com/boundary")
      expect(results[0].tags).toEqual(["architecture", "boundary"])
    }))

  it.effect("makeBoundaryRule - should return empty array when no violations", () =>
    Effect.gen(function*() {
      const rule = makeBoundaryRule({
        id: "no-violation",
        from: "**/*.ts",
        disallow: ["pkg:forbidden"],
        message: "Test",
        severity: "error"
      })

      const ctx = createMockContext(
        {
          "test.ts": "import allowed from 'allowed'"
        },
        {
          "test.ts": ["pkg:allowed"]
        }
      )

      const results = yield* rule.run(ctx)

      expect(results).toEqual([])
    }))

  it.effect("makeBoundaryRule - should handle files with no imports", () =>
    Effect.gen(function*() {
      const rule = makeBoundaryRule({
        id: "test-empty",
        from: "**/*.ts",
        disallow: ["pkg:test"],
        message: "Test",
        severity: "error"
      })

      const ctx = createMockContext(
        {
          "test.ts": "const x = 42"
        },
        {
          "test.ts": []
        }
      )

      const results = yield* rule.run(ctx)

      expect(results).toEqual([])
    }))

  it.effect("makePatternRule - should handle files array", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "test-files-array",
        files: ["src/**/*.ts", "lib/**/*.ts"],
        pattern: /TODO/g,
        message: "Found TODO",
        severity: "warning"
      })

      expect(rule.id).toBe("test-files-array")
      expect(rule.kind).toBe("pattern")
    }))

  it.effect("makePatternRule - should convert string pattern to regex", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "test-string-to-regex",
        files: "**/*.ts",
        pattern: "const",
        message: "Test",
        severity: "warning"
      })

      const ctx = createMockContext({
        "test.ts": "const x = 1\nconst y = 2"
      })

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(2)
    }))

  it.effect("makePatternRule - should handle multiline content", () =>
    Effect.gen(function*() {
      const rule = makePatternRule({
        id: "test-multiline",
        files: "**/*.ts",
        pattern: /function/g,
        message: "Found function",
        severity: "warning"
      })

      const ctx = createMockContext({
        "test.ts": "line 1\nfunction a() {}\nline 3\nfunction b() {}\nline 5"
      })

      const results = yield* rule.run(ctx)

      expect(results.length).toBe(2)
      expect(results[0].range?.start.line).toBe(2)
      expect(results[1].range?.start.line).toBe(4)
    }))

  it.effect("makeBoundaryRule - should match against file path pattern", () =>
    Effect.gen(function*() {
      const rule = makeBoundaryRule({
        id: "test-from-pattern",
        from: "src/services/**/*.ts",
        disallow: ["pkg:database"],
        message: "Database access not allowed",
        severity: "error"
      })

      expect(rule.id).toBe("test-from-pattern")
      expect(rule.kind).toBe("boundary")
    }))
})
