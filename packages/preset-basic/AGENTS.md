# AGENTS.md - @effect-migrate/preset-basic Package

**Last Updated:** 2025-11-03\
**For:** AI Coding Agents (Amp, Cursor, etc.)

This guide provides package-specific guidance for working on `@effect-migrate/preset-basic`, the default rule preset. **See [root AGENTS.md](../../AGENTS.md) for general Effect-TS patterns.**

---

## Table of Contents

- [Package Overview](#package-overview)
- [Preset Architecture](#preset-architecture)
- [Rule Creation Patterns](#rule-creation-patterns)
- [Pattern Rules](#pattern-rules)
- [Boundary Rules](#boundary-rules)
- [Rule Documentation](#rule-documentation)
- [Testing Rules](#testing-rules)
- [Performance Optimization](#performance-optimization)
- [False Positive Mitigation](#false-positive-mitigation)
- [Anti-Patterns](#anti-patterns)
- [Rule Catalog](#rule-catalog)

---

## Package Overview

**@effect-migrate/preset-basic** provides a curated set of migration rules for Effect-TS adoption. It demonstrates best practices for rule creation and serves as a template for custom presets.

### Key Responsibilities

- **Pattern Rules**: Detect anti-patterns (async/await, Promise, try/catch)
- **Boundary Rules**: Enforce architectural constraints (no direct Node.js imports)
- **Docs Rules**: Guard documentation quality during migration
- **Metrics Rules**: Track migration progress

### Design Principles

1. **Conservative Detection**: Favor precision over recall (few false positives)
2. **Clear Messaging**: Every rule has actionable, specific messages
3. **Documentation**: Every rule links to migration docs
4. **Performance**: Rules use lazy loading and efficient patterns
5. **Composability**: Rules can be enabled/disabled independently

### Directory Structure

```
packages/preset-basic/
├── src/
│   ├── patterns.ts        # Pattern-based rules
│   ├── boundaries.ts      # Architectural boundary rules
│   ├── docs.ts            # Documentation guard rules
│   ├── metrics.ts         # Migration metric rules
│   └── index.ts           # Preset export
└── test/
    ├── fixtures/          # Test fixture files
    └── rules.test.ts      # Rule tests
```

---

## Preset Architecture

### Preset Structure

```typescript
// src/index.ts
import type { Preset } from "@effect-migrate/core"
import { boundaryRules } from "./boundaries.js"
import { docsRules } from "./docs.js"
import { metricsRules } from "./metrics.js"
import { patternRules } from "./patterns.js"

export const basicPreset: Preset = {
  rules: [...patternRules, ...boundaryRules, ...docsRules, ...metricsRules],
  defaults: {
    concurrency: 4,
    paths: {
      exclude: ["node_modules/**", "dist/**", "*.min.js", "test/fixtures/**"]
    }
  }
}

export default basicPreset
```

### Rule Organization

**Group related rules by category:**

```typescript
// src/patterns.ts
import type { Rule } from "@effect-migrate/core"
import { makePatternRule } from "@effect-migrate/core"

export const patternRules: Rule[] = [
  // async/await detection
  noAsyncAwait,
  noAsyncFunctions,

  // Promise detection
  noPromiseConstructor,
  noPromiseAll,
  noPromiseRace,

  // Error handling
  noTryCatch,
  noThrowStatement,

  // Callback patterns
  noCallbacks
]
```

---

## Rule Creation Patterns

### Using makePatternRule Helper

**Best practice for simple pattern detection:**

```typescript
import { makePatternRule } from "@effect-migrate/core"

// ✅ GOOD - Declarative, maintainable
export const noAsyncAwait = makePatternRule({
  id: "no-async-await",
  files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  pattern: /\basync\s+(function\s+\w+|(\([^)]*\)|[\w]+)\s*=>)/g,
  negativePattern: /@effect-migrate-ignore|@ts-expect-error.*async/,
  message: "Replace async/await with Effect.gen for composable async operations",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/async",
  tags: ["async", "migration-required"]
})
```

### Custom Rule Implementation

**For complex logic that helpers can't handle:**

```typescript
import type { Rule } from "@effect-migrate/core"
import { Effect } from "effect"

export const noMixedEffectPromise: Rule = {
  id: "no-mixed-effect-promise",
  kind: "pattern",
  run: (ctx) =>
    Effect.gen(function* () {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)

        // Complex analysis: detect Effect.runPromise in async functions
        const hasRunPromise = /Effect\.runPromise/g.test(content)
        const hasAsyncFunction = /async\s+function/g.test(content)

        if (hasRunPromise && hasAsyncFunction) {
          // Find specific locations
          const lines = content.split("\n")
          let inAsyncFunction = false

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]

            if (/async\s+function/.test(line)) {
              inAsyncFunction = true
            }

            if (inAsyncFunction && /Effect\.runPromise/.test(line)) {
              results.push({
                id: "no-mixed-effect-promise",
                ruleKind: "pattern",
                message: "Avoid mixing Effect.runPromise with async/await. Use Effect.gen instead.",
                severity: "error",
                file,
                range: {
                  start: { line: i + 1, column: 1 },
                  end: { line: i + 1, column: line.length }
                },
                docsUrl: "https://effect.website/docs/guides/essentials/running-effects",
                tags: ["async", "effect-interop"]
              })
            }

            if (line.includes("}") && inAsyncFunction) {
              inAsyncFunction = false
            }
          }
        }
      }

      return results
    })
}
```

---

## Pattern Rules

### Async/Await Detection

```typescript
// Detect async function declarations
export const noAsyncFunctions = makePatternRule({
  id: "no-async-functions",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /async\s+function\s+\w+/g,
  negativePattern: /@effect-migrate-ignore/,
  message: "Convert async functions to Effect.gen",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/async#effect-gen",
  tags: ["async"]
})

// Detect async arrow functions
export const noAsyncArrows = makePatternRule({
  id: "no-async-arrows",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /async\s*\([^)]*\)\s*=>/g,
  negativePattern: /@effect-migrate-ignore/,
  message: "Convert async arrow functions to Effect.gen",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/async#effect-gen",
  tags: ["async"]
})

// Detect await expressions
export const noAwaitExpression = makePatternRule({
  id: "no-await-expression",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /\bawait\s+/g,
  negativePattern: /@effect-migrate-ignore|Effect\.gen/,
  message: "Replace await with yield* in Effect.gen",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/async#yield",
  tags: ["async"]
})
```

### Promise Detection

```typescript
// Detect Promise constructor
export const noPromiseConstructor = makePatternRule({
  id: "no-promise-constructor",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /new\s+Promise\s*</g,
  message: "Replace new Promise() with Effect.async or Effect.tryPromise",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/async#from-promises",
  tags: ["promise"]
})

// Detect Promise.all
export const noPromiseAll = makePatternRule({
  id: "no-promise-all",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /Promise\.all\(/g,
  message: "Replace Promise.all with Effect.all for concurrent execution",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/concurrency#effect-all",
  tags: ["promise", "concurrency"]
})

// Detect Promise.race
export const noPromiseRace = makePatternRule({
  id: "no-promise-race",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /Promise\.race\(/g,
  message: "Replace Promise.race with Effect.race",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/concurrency#effect-race",
  tags: ["promise", "concurrency"]
})

// Detect .then() calls
export const noPromiseThen = makePatternRule({
  id: "no-promise-then",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /\.then\s*\(/g,
  negativePattern: /Effect\.runPromise/,
  message: "Replace .then() with Effect.flatMap or Effect.gen",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/composition",
  tags: ["promise"]
})
```

### Error Handling

```typescript
// Detect try/catch blocks
export const noTryCatch = makePatternRule({
  id: "no-try-catch",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /\btry\s*\{/g,
  negativePattern: /@effect-migrate-ignore/,
  message: "Replace try/catch with Effect.tryPromise or Effect.catchAll",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/error-handling",
  tags: ["error-handling"]
})

// Detect throw statements
export const noThrowStatement = makePatternRule({
  id: "no-throw-statement",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /\bthrow\s+/g,
  negativePattern: /@effect-migrate-ignore|class\s+\w+\s+extends\s+(Error|Data\.TaggedError)/,
  message: "Replace throw with Effect.fail and tagged errors",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/error-handling#tagged-errors",
  tags: ["error-handling"]
})
```

---

## Boundary Rules

### Import Restrictions

```typescript
import { makeBoundaryRule } from "@effect-migrate/core"

// Disallow direct Node.js imports in migrated code
export const noDirectNodeImports = makeBoundaryRule({
  id: "no-direct-node-imports",
  from: "src/**/*.ts",
  disallow: ["node:fs", "node:fs/promises", "node:path", "node:http", "node:https", "node:stream"],
  message: "Use @effect/platform abstractions instead of Node.js APIs",
  severity: "error",
  docsUrl: "https://effect.website/docs/platform/overview",
  tags: ["platform", "migration-required"]
})

// Ensure layers are used for platform services
export const noDirectPlatformImports = makeBoundaryRule({
  id: "no-direct-platform-imports",
  from: "src/business-logic/**/*.ts",
  disallow: ["@effect/platform-node"],
  message: "Business logic should depend on @effect/platform, not platform-node",
  severity: "error",
  docsUrl: "https://effect.website/docs/platform/platform-agnostic",
  tags: ["platform", "architecture"]
})

// Prevent Effect.runPromise in library code
export const noRunPromiseInLib = makeBoundaryRule({
  id: "no-run-promise-in-lib",
  from: "src/lib/**/*.ts",
  disallow: ["effect/Runtime"],
  message: "Library code should return Effects, not run them with runPromise",
  severity: "error",
  docsUrl: "https://effect.website/docs/guides/essentials/running-effects",
  tags: ["runtime", "architecture"]
})
```

### Layer Dependencies

```typescript
// Custom boundary rule for Layer composition
export const noCircularLayerDeps: Rule = {
  id: "no-circular-layer-deps",
  kind: "boundary",
  run: (ctx) =>
    Effect.gen(function* () {
      const importIndex = yield* ctx.getImportIndex()
      const layerFiles = yield* ctx.listFiles(["**/*Layer.ts", "**/*Live.ts"])

      const results: RuleResult[] = []

      // Build dependency graph
      const graph = new Map<string, string[]>()
      for (const file of layerFiles) {
        const imports = importIndex.getImports(file)
        graph.set(
          file,
          imports.filter((imp) => layerFiles.includes(imp))
        )
      }

      // Detect cycles with DFS
      const visited = new Set<string>()
      const recursionStack = new Set<string>()

      const detectCycle = (node: string, path: string[]): boolean => {
        if (recursionStack.has(node)) {
          // Found cycle
          const cycleStart = path.indexOf(node)
          const cycle = [...path.slice(cycleStart), node]

          results.push({
            id: "no-circular-layer-deps",
            ruleKind: "boundary",
            message: `Circular layer dependency detected: ${cycle.join(" → ")}`,
            severity: "error",
            file: node,
            docsUrl: "https://effect.website/docs/guides/essentials/layers#composition",
            tags: ["layers", "architecture"]
          })

          return true
        }

        if (visited.has(node)) return false

        visited.add(node)
        recursionStack.add(node)

        const deps = graph.get(node) ?? []
        for (const dep of deps) {
          if (detectCycle(dep, [...path, node])) {
            return true
          }
        }

        recursionStack.delete(node)
        return false
      }

      for (const file of layerFiles) {
        detectCycle(file, [])
      }

      return results
    })
}
```

---

## Rule Documentation

### Documentation Requirements

**Every rule MUST have:**

1. **Unique ID**: Kebab-case, prefixed with category
2. **Clear Message**: Actionable, specific to the violation
3. **Severity**: `error` for must-fix, `warning` for should-fix
4. **Docs URL**: Link to Effect documentation or migration guide
5. **Tags**: For filtering and categorization

### Documentation Template

````typescript
/**
 * Rule: no-async-await
 *
 * **What it detects:**
 * - async function declarations
 * - async arrow functions
 * - async method definitions
 *
 * **Why it matters:**
 * async/await cannot be interrupted, retried, or composed with Effects.
 * Effect.gen provides all async/await benefits plus:
 * - Interruption support
 * - Retry/timeout composability
 * - Structured concurrency
 * - Type-safe error handling
 *
 * **How to fix:**
 * ```typescript
 * // Before
 * async function fetchUser(id: string) {
 *   const response = await fetch(`/users/${id}`)
 *   return response.json()
 * }
 *
 * // After
 * const fetchUser = (id: string) =>
 *   Effect.gen(function* () {
 *     const response = yield* Effect.tryPromise(() => fetch(`/users/${id}`))
 *     const data = yield* Effect.tryPromise(() => response.json())
 *     return data
 *   })
 * ```
 *
 * **False positives:**
 * - Test files (use @effect-migrate-ignore comment)
 * - Third-party integrations (create boundary)
 *
 * **Performance:**
 * - Fast: Simple regex pattern
 * - Lazy: Only loads matched files
 */
export const noAsyncAwait = makePatternRule({
  id: "no-async-await"
  // ... implementation
})
````

---

## Testing Rules

### Test Structure

```typescript
// test/rules.test.ts
import type { RuleContext } from "@effect-migrate/core"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { noAsyncAwait } from "../src/patterns.js"

describe("Pattern Rules", () => {
  describe("no-async-await", () => {
    it.effect("should detect async function", () =>
      Effect.gen(function* () {
        const ctx = createMockContext({
          files: ["test.ts"],
          contents: {
            "test.ts": "async function foo() { return 42 }"
          }
        })

        const results = yield* noAsyncAwait.run(ctx)

        expect(results).toHaveLength(1)
        expect(results[0].id).toBe("no-async-await")
        expect(results[0].file).toBe("test.ts")
        expect(results[0].severity).toBe("warning")
      })
    )

    it.effect("should ignore with comment", () =>
      Effect.gen(function* () {
        const ctx = createMockContext({
          files: ["test.ts"],
          contents: {
            "test.ts": "// @effect-migrate-ignore\nasync function foo() {}"
          }
        })

        const results = yield* noAsyncAwait.run(ctx)

        expect(results).toHaveLength(0)
      })
    )

    it.effect("should not flag Effect.gen", () =>
      Effect.gen(function* () {
        const ctx = createMockContext({
          files: ["test.ts"],
          contents: {
            "test.ts": "Effect.gen(function* () { yield* something })"
          }
        })

        const results = yield* noAsyncAwait.run(ctx)

        expect(results).toHaveLength(0)
      })
    )
  })
})

// Test helper
function createMockContext(opts: {
  files: string[]
  contents: Record<string, string>
}): RuleContext {
  return {
    cwd: process.cwd(),
    path: ".",
    listFiles: (globs) => Effect.succeed(opts.files),
    readFile: (file) => Effect.succeed(opts.contents[file] ?? ""),
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
}
```

### Fixture-Based Testing

```typescript
// test/fixtures/async-patterns.ts
// This file contains patterns that should trigger no-async-await

async function basicAsync() {
  return 42
}

const arrowAsync = async () => {
  return 42
}

class MyClass {
  async method() {
    return 42
  }
}

// test/rules.test.ts
it.effect("should detect all async patterns in fixture", () =>
  Effect.gen(function* () {
    const ctx = createRealContext(["test/fixtures/async-patterns.ts"])

    const results = yield* noAsyncAwait.run(ctx)

    // Should find: basicAsync, arrowAsync, MyClass.method
    expect(results.length).toBeGreaterThanOrEqual(3)

    const messages = results.map((r) => r.message)
    expect(messages.every((m) => m.includes("Effect.gen"))).toBe(true)
  })
)
```

---

## Performance Optimization

### Lazy Pattern Compilation

```typescript
// ❌ BAD - Compiles regex on every rule run
export const noAsyncAwait = makePatternRule({
  pattern: /async\s+function/g // Recompiled each time
  // ...
})

// ✅ GOOD - Pre-compiled regex
const ASYNC_PATTERN = /async\s+function\s+\w+|\basync\s*\([^)]*\)\s*=>/gm

export const noAsyncAwait = makePatternRule({
  pattern: ASYNC_PATTERN
  // ...
})
```

### Early Exit Optimization

```typescript
// ✅ GOOD - Early exit with negative pattern
export const noAsyncAwait = makePatternRule({
  pattern: /async\s+function/g,
  negativePattern: /@effect-migrate-ignore|Effect\.gen/
  // If negativePattern matches, file is skipped entirely
  // ...
})
```

### Efficient File Filtering

```typescript
// ❌ BAD - Processes all files
export const noNodeImports = makeBoundaryRule({
  from: "**/*",
  disallow: ["node:fs"]
  // ...
})

// ✅ GOOD - Narrow file scope
export const noNodeImports = makeBoundaryRule({
  from: "src/**/*.ts", // Only source files
  disallow: ["node:fs"]
  // ...
})
```

---

## False Positive Mitigation

### Conservative Patterns

```typescript
// ❌ BAD - Too broad, many false positives
pattern:;
;/Promise/g // Matches "Promise" in comments, strings, types

// ✅ GOOD - Specific context
pattern:;
;/new\s+Promise\s*</g // Only constructor calls
pattern:;
;/Promise\.all\(/g // Only static methods
```

### Negative Patterns

```typescript
// ✅ GOOD - Exclude migration-safe code
export const noAsyncAwait = makePatternRule({
  pattern: /async\s+function/g,
  negativePattern: [
    /@effect-migrate-ignore/, // Explicit opt-out
    /Effect\.gen/, // Already migrated
    /Effect\.runPromise/, // Boundary code
    /@ts-expect-error.*async/ // Acknowledged issues
  ]
    .map((r) => r.source)
    .join("|")
  // ...
})
```

### Context-Aware Detection

```typescript
// Custom rule with context analysis
export const noPromiseInEffectCode: Rule = {
  id: "no-promise-in-effect-code",
  kind: "pattern",
  run: (ctx) =>
    Effect.gen(function* () {
      const files = yield* ctx.listFiles(["**/*.ts"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)

        // Only flag if file uses Effect but also Promise
        const hasEffect = /import.*effect/i.test(content)
        const hasPromise = /new\s+Promise</g.test(content)

        if (hasEffect && hasPromise) {
          // Find exact locations
          const matches = Array.from(content.matchAll(/new\s+Promise</g))

          for (const match of matches) {
            // Additional context check: not in Effect.tryPromise
            const beforeMatch = content.substring(Math.max(0, match.index! - 50), match.index!)

            if (!beforeMatch.includes("Effect.tryPromise")) {
              results.push({
                id: "no-promise-in-effect-code",
                ruleKind: "pattern",
                message: "Use Effect.async or Effect.tryPromise instead of new Promise",
                severity: "warning",
                file
                // ... location details
              })
            }
          }
        }
      }

      return results
    })
}
```

---

## Anti-Patterns

### ❌ Don't: Overly Broad Patterns

```typescript
// ❌ BAD - Too many false positives
pattern:;
;/async/g // Matches "asyncIterator", "AsyncStorage", comments

// ✅ GOOD - Specific syntax
pattern:;
;/\basync\s+(function|[\w]+\s*=>)/g
```

### ❌ Don't: Missing Documentation

```typescript
// ❌ BAD - No docs URL or tags
export const noAsync = makePatternRule({
  id: "no-async",
  pattern: /async/g,
  message: "Don't use async",
  severity: "error"
})

// ✅ GOOD - Complete metadata
export const noAsync = makePatternRule({
  id: "no-async-await",
  pattern: /\basync\s+function/g,
  message: "Replace async functions with Effect.gen",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/async",
  tags: ["async", "migration"]
})
```

### ❌ Don't: Unbounded File Processing

```typescript
// ❌ BAD - Processes all files including node_modules
files: "**/*.ts"

// ✅ GOOD - Exclude noise
files:;
;["src/**/*.ts", "lib/**/*.ts"]
```

### ❌ Don't: Hardcode Absolute Paths

```typescript
// ❌ BAD - Breaks on different machines
from: "/Users/me/project/src/**/*.ts"

// ✅ GOOD - Relative to project root
from: "src/**/*.ts"
```

### ❌ Don't: Ignore Performance

```typescript
// ❌ BAD - Recompiles pattern, no caching
export const rule = {
  run: (ctx) =>
    Effect.gen(function* () {
      const files = yield* ctx.listFiles(["**/*.ts"])
      for (const file of files) {
        const content = yield* ctx.readFile(file)
        const pattern = new RegExp("async", "g") // ❌ Created every file!
        if (pattern.test(content)) {
          // ...
        }
      }
    })
}

// ✅ GOOD - Pre-compiled, uses helpers
const PATTERN = /async/g
export const rule = makePatternRule({
  pattern: PATTERN
  // ...
})
```

---

## Rule Catalog

### Pattern Rules (patterns.ts)

| Rule ID                  | Severity | Detects          | Replacement       |
| ------------------------ | -------- | ---------------- | ----------------- |
| `no-async-functions`     | warning  | `async function` | `Effect.gen`      |
| `no-async-arrows`        | warning  | `async () =>`    | `Effect.gen`      |
| `no-await-expression`    | warning  | `await expr`     | `yield* expr`     |
| `no-promise-constructor` | warning  | `new Promise()`  | `Effect.async`    |
| `no-promise-all`         | warning  | `Promise.all()`  | `Effect.all()`    |
| `no-promise-race`        | warning  | `Promise.race()` | `Effect.race()`   |
| `no-promise-then`        | warning  | `.then()`        | `Effect.flatMap`  |
| `no-try-catch`           | warning  | `try/catch`      | `Effect.catchAll` |
| `no-throw-statement`     | warning  | `throw`          | `Effect.fail`     |

### Boundary Rules (boundaries.ts)

| Rule ID                   | Severity | Disallows               | Reason                 |
| ------------------------- | -------- | ----------------------- | ---------------------- |
| `no-direct-node-imports`  | error    | `node:*` imports        | Use `@effect/platform` |
| `no-platform-node-in-lib` | error    | `@effect/platform-node` | Use platform-agnostic  |
| `no-run-promise-in-lib`   | error    | `Effect.runPromise`     | Return Effects         |
| `no-circular-layer-deps`  | error    | Circular Layer deps     | Breaks composition     |

---

## Development Checklist

When adding new rules to `@effect-migrate/preset-basic`:

- [ ] Use `makePatternRule` or `makeBoundaryRule` helpers when possible
- [ ] Add comprehensive JSDoc documentation
- [ ] Include `docsUrl` linking to Effect docs
- [ ] Add descriptive `tags` for categorization
- [ ] Write tests with both positive and negative cases
- [ ] Add fixture file if pattern is complex
- [ ] Use `negativePattern` to reduce false positives
- [ ] Pre-compile regex patterns as constants
- [ ] Narrow file scope with specific globs
- [ ] Test performance on large codebases
- [ ] Document known false positives and workarounds
- [ ] Add rule to appropriate category file
- [ ] Export from `index.ts`
- [ ] Update rule catalog table in this document

---

**Last Updated:** 2025-11-03\
**See Also:** [Root AGENTS.md](../../AGENTS.md) for general Effect patterns
