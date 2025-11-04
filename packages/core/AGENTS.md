# AGENTS.md - @effect-migrate/core Package

**Last Updated:** 2025-11-03\
**For:** AI Coding Agents (Amp, Cursor, etc.)

This guide provides package-specific guidance for working on `@effect-migrate/core`, the reusable migration engine. **See [root AGENTS.md](../../AGENTS.md) for general Effect-TS patterns.**

---

## Table of Contents

- [Package Overview](#package-overview)
- [Architecture](#architecture)
- [Service Implementation Patterns](#service-implementation-patterns)
- [Schema Validation](#schema-validation)
- [File Processing Strategies](#file-processing-strategies)
- [Rule System](#rule-system)
- [Public API Design](#public-api-design)
- [Testing](#testing)
- [Anti-Patterns](#anti-patterns)
- [Troubleshooting](#troubleshooting)

---

## Package Overview

**@effect-migrate/core** is the reusable engine that powers effect-migrate. It provides:

- **Services**: FileDiscovery, ImportIndex, RuleRunner
- **Rule System**: Pattern rules, boundary rules, metrics
- **Schema Validation**: Config loading with effect/Schema
- **Resource Safety**: Lazy file loading, memory-efficient processing

### Key Constraints

1. **Platform-Agnostic**: Use `@effect/platform` abstractions, NOT Node.js APIs directly
2. **Lazy Loading**: Never load all files into memory upfront
3. **Concurrent Processing**: Default to 4 concurrent operations (configurable)
4. **Type Safety**: All configs validated with Schema, all errors typed
5. **Resource Safety**: Always use `acquireRelease` for external resources

### Directory Structure

```
packages/core/
├── src/
│   ├── services/          # Public services (exported)
│   │   ├── FileDiscovery.ts
│   │   ├── ImportIndex.ts
│   │   └── RuleRunner.ts
│   ├── rules/             # Rule types and helpers (exported)
│   │   ├── types.ts
│   │   └── helpers.ts
│   ├── schema/            # Config schema (internal)
│   │   ├── Config.ts
│   │   └── loader.ts
│   ├── types.ts           # Core domain types (exported)
│   └── index.ts           # Public API
└── test/                  # Tests mirror src/ structure
```

---

## Architecture

### Service Layer Pattern

All services follow this pattern:

```typescript
// 1. Define service interface
export interface FileDiscoveryService {
  readonly listFiles: (globs: string[], exclude?: string[]) => Effect.Effect<string[]>
  readonly readFile: (path: string) => Effect.Effect<string, PlatformError>
  readonly isTextFile: (path: string) => boolean
  readonly buildFileIndex: (
    globs: string[],
    exclude?: string[],
    concurrency?: number
  ) => Effect.Effect<Map<string, string>, PlatformError>
}

// 2. Create Context.Tag
export class FileDiscovery extends Context.Tag("FileDiscovery")<
  FileDiscovery,
  FileDiscoveryService
>() {}

// 3. Implement Live Layer with dependencies
export const FileDiscoveryLive = Layer.effect(
  FileDiscovery,
  Effect.gen(function* () {
    // Access platform dependencies
    const fs = yield* FileSystem.FileSystem

    // Internal state (closures, not exposed)
    const contentCache = new Map<string, string>()

    // Return service implementation
    return {
      listFiles: (globs, exclude) =>
        Effect.gen(function* () {
          // Implementation
        })
      // ...other methods
    }
  })
)
```

### Layer Composition

Services compose via Layer.provide:

```typescript
// RuleRunner depends on FileDiscovery and ImportIndex
export const RuleRunnerLive = Layer.effect(
  RuleRunner,
  Effect.gen(function* () {
    const discovery = yield* FileDiscovery
    const importIndex = yield* ImportIndex

    return {
      runRules: (rules, config) =>
        Effect.gen(function* () {
          // Use discovery and importIndex
        })
    }
  })
).pipe(Layer.provide(FileDiscoveryLive), Layer.provide(ImportIndexLive))
```

---

## Service Implementation Patterns

### 1. FileDiscovery Service

**Purpose:** Abstract file system operations, provide caching, lazy loading.

**Key Patterns:**

```typescript
import { FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Context, Effect, Layer } from "effect"

export const FileDiscoveryLive = Layer.effect(
  FileDiscovery,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // ✅ GOOD - Lazy cache (only loads on readFile)
    const contentCache = new Map<string, string>()

    const readFile = (filePath: string): Effect.Effect<string, PlatformError> =>
      Effect.gen(function* () {
        // Check cache first
        if (contentCache.has(filePath)) {
          return contentCache.get(filePath)!
        }

        // Load and cache
        const content = yield* fs.readFileString(filePath)
        contentCache.set(filePath, content)

        return content
      })

    // ✅ GOOD - Lazy file listing (returns paths, not contents)
    const listFiles = (globs: string[], exclude: string[] = []): Effect.Effect<string[]> =>
      Effect.gen(function* () {
        // Use Effect.forEach with concurrency
        const allFiles = yield* Effect.forEach(
          globs,
          (pattern) => matchGlob(pattern, exclude),
          { concurrency: "unbounded" } // File listing is cheap
        )

        return Array.from(new Set(allFiles.flat())).sort()
      })

    // ✅ GOOD - Controlled concurrency for expensive operations
    const buildFileIndex = (
      globs: string[],
      exclude: string[] = [],
      concurrency: number = 4
    ): Effect.Effect<Map<string, string>, PlatformError> =>
      Effect.gen(function* () {
        const files = yield* listFiles(globs, exclude)

        // Use concurrency limit to avoid OOM on large repos
        const fileContents = yield* Effect.forEach(
          files,
          (file) =>
            Effect.gen(function* () {
              const content = yield* readFile(file)
              return [file, content] as const
            }),
          { concurrency } // Configurable, default 4
        )

        return new Map(fileContents)
      })

    return {
      listFiles,
      readFile,
      buildFileIndex,
      isTextFile: (filePath) => {
        const ext = path.extname(filePath).toLowerCase()
        return TEXT_EXTENSIONS.has(ext)
      }
    }
  })
)
```

**Anti-Pattern:**

```typescript
// ❌ BAD - Loads all files upfront (OOM risk)
const allFiles = yield * listFiles(globs, exclude)
const allContents = yield * Effect.forEach(allFiles, readFile, { concurrency: "unbounded" })

// ✅ GOOD - Load only what's needed
const files = yield * listFiles(globs, exclude)
for (const file of files) {
  const content = yield * readFile(file) // Lazy, cached
  if (shouldProcess(content)) {
    yield * processFile(file, content)
  }
}
```

### 2. ImportIndex Service

**Purpose:** Build and query import graph for boundary rules.

**Key Patterns:**

```typescript
export const ImportIndexLive = Layer.effect(
  ImportIndex,
  Effect.gen(function* () {
    const discovery = yield* FileDiscovery

    // Lazy index (built on first getImportIndex call)
    let cachedIndex: Map<string, string[]> | null = null

    const buildIndex = (files: string[]): Effect.Effect<Map<string, string[]>, PlatformError> =>
      Effect.gen(function* () {
        const index = new Map<string, string[]>()

        // Process files with concurrency limit
        yield* Effect.forEach(
          files,
          (file) =>
            Effect.gen(function* () {
              const content = yield* discovery.readFile(file)
              const imports = extractImports(content) // Pure function
              index.set(file, imports)
            }),
          { concurrency: 4 }
        )

        return index
      })

    const getImportIndex = (files: string[]): Effect.Effect<ImportIndexService, PlatformError> =>
      Effect.gen(function* () {
        // Build only once
        if (!cachedIndex) {
          cachedIndex = yield* buildIndex(files)
        }

        // Return query interface
        return {
          getImports: (file) => cachedIndex!.get(file) ?? [],
          getImporters: (module) => {
            const importers: string[] = []
            for (const [file, imports] of cachedIndex!.entries()) {
              if (imports.includes(module)) {
                importers.push(file)
              }
            }
            return importers
          }
        }
      })

    return { getImportIndex }
  })
)
```

**Import Extraction (Pure Function):**

```typescript
// ✅ GOOD - Pure, testable, no Effect overhead
function extractImports(content: string): string[] {
  const imports: string[] = []

  // Match ES6 imports
  const importRegex = /import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  // Match require() calls
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  return Array.from(new Set(imports))
}
```

### 3. RuleRunner Service

**Purpose:** Execute rules with context, collect results.

**Key Patterns:**

```typescript
export const RuleRunnerLive = Layer.effect(
  RuleRunner,
  Effect.gen(function* () {
    const discovery = yield* FileDiscovery

    const runRules = (rules: Rule[], config: Config): Effect.Effect<RuleResult[], any> =>
      Effect.gen(function* () {
        const cwd = process.cwd()

        // Build lazy context (imports built only if boundary rules exist)
        const createContext = (): RuleContext => {
          let importIndexCache: Effect.Effect<ImportIndexService, any> | null = null

          return {
            cwd,
            path: config.paths?.root ?? ".",
            listFiles: (globs) => discovery.listFiles(globs, config.paths?.exclude ?? []),
            readFile: (file) => discovery.readFile(file),
            getImportIndex: () => {
              if (!importIndexCache) {
                importIndexCache = Effect.gen(function* () {
                  const files = yield* discovery.listFiles(
                    config.paths?.include ?? ["**/*.{ts,tsx,js,jsx}"],
                    config.paths?.exclude ?? []
                  )
                  const indexService = yield* ImportIndex
                  return yield* indexService.getImportIndex(files)
                })
              }
              return importIndexCache
            },
            config: config.extensions ?? {},
            logger: {
              debug: (msg) => Console.debug(msg),
              info: (msg) => Console.log(msg)
            }
          }
        }

        const ctx = createContext()

        // Run rules with concurrency
        const allResults = yield* Effect.forEach(
          rules,
          (rule) =>
            Effect.gen(function* () {
              yield* Console.debug(`Running rule: ${rule.id}`)
              const results = yield* rule.run(ctx)
              return results
            }),
          { concurrency: config.concurrency ?? 4 }
        )

        return allResults.flat()
      })

    return { runRules }
  })
)
```

---

## Schema Validation

### Config Schema Design

**Use Schema.Class for nominal types:**

```typescript
import { Schema } from "effect"

// ✅ GOOD - Schema.Class with static defaults
export class PathsSchema extends Schema.Class<PathsSchema>("PathsSchema")({
  root: Schema.optional(Schema.String),
  exclude: Schema.Array(Schema.String),
  include: Schema.optional(Schema.Array(Schema.String))
}) {
  static readonly defaultExclude = [
    "node_modules/**",
    "dist/**",
    ".next/**",
    "coverage/**",
    ".git/**",
    "build/**",
    "*.min.js"
  ]
}

// ✅ GOOD - Union with transformation
export class PatternRuleSchema extends Schema.Class<PatternRuleSchema>("PatternRuleSchema")({
  id: Schema.String,
  pattern: Schema.Union(
    Schema.String,
    Schema.Struct({
      source: Schema.String,
      flags: Schema.optional(Schema.String)
    })
  ).pipe(
    Schema.transform(Schema.instanceOf(RegExp), {
      decode: (input) => {
        if (typeof input === "string") {
          return new RegExp(input, "gm")
        }
        return new RegExp(input.source, input.flags ?? "gm")
      },
      encode: (regex) => regex.source
    })
  ),
  files: Schema.Union(Schema.String, Schema.Array(Schema.String)),
  message: Schema.String,
  severity: Schema.Literal("error", "warning"),
  docsUrl: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String))
}) {}
```

### Config Loading with Error Handling

```typescript
import { Schema } from "effect"
import { Data } from "effect"
import * as TreeFormatter from "effect/TreeFormatter"

// Define custom errors
export class ConfigLoadError extends Data.TaggedError("ConfigLoadError")<{
  readonly path: string
  readonly reason: string
}> {}

export class ConfigValidationError extends Data.TaggedError("ConfigValidationError")<{
  readonly path: string
  readonly errors: string
}> {}

// Load and decode config
export const loadConfig = (
  configPath: string
): Effect.Effect<Config, ConfigLoadError | ConfigValidationError> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    // Read file
    const content = yield* fs.readFileString(configPath).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ConfigLoadError({
            path: configPath,
            reason: `File not found or unreadable: ${error}`
          })
        )
      )
    )

    // Parse JSON/YAML
    let data: unknown
    try {
      data = JSON.parse(content)
    } catch (parseError) {
      return yield* Effect.fail(
        new ConfigLoadError({
          path: configPath,
          reason: `Invalid JSON: ${parseError}`
        })
      )
    }

    // Decode with Schema
    const config = yield* Schema.decodeUnknown(ConfigSchema)(data).pipe(
      Effect.catchAll((parseError) =>
        Effect.fail(
          new ConfigValidationError({
            path: configPath,
            errors: TreeFormatter.formatErrorSync(parseError)
          })
        )
      )
    )

    return config
  })
```

### Schema Best Practices

```typescript
// ✅ GOOD - Use withDefault for optional fields with defaults
const ConfigSchema = Schema.Struct({
  concurrency: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.lessThanOrEqualTo(16),
    Schema.withDefault(() => 4)
  )
})

// ✅ GOOD - Use greaterThan/lessThan for validation
const MigrationGoalSchema = Schema.Struct({
  target: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(100))
})

// ✅ GOOD - Use Schema.Literal for enums
const SeveritySchema = Schema.Literal("error", "warning")

// ✅ GOOD - Use Schema.Union for multiple types
const FilesSchema = Schema.Union(Schema.String, Schema.Array(Schema.String))
```

---

## File Processing Strategies

### Lazy Loading Pattern

**ALWAYS prefer lazy loading over eager loading:**

```typescript
// ❌ BAD - Loads everything upfront
const allFiles = yield * discovery.listFiles(globs, exclude)
const fileIndex = new Map<string, string>()
for (const file of allFiles) {
  const content = yield * discovery.readFile(file)
  fileIndex.set(file, content)
}
// Problem: OOM on large repos

// ✅ GOOD - Load only what's needed
const files = yield * discovery.listFiles(globs, exclude)
for (const file of files) {
  // readFile is cached internally
  const content = yield * discovery.readFile(file)

  // Early exit if not needed
  if (!shouldProcess(content)) continue

  yield * processFile(file, content)
}
```

### Concurrent Processing

**Use concurrency limits for expensive operations:**

```typescript
// ✅ GOOD - Configurable concurrency
const results =
  yield *
  Effect.forEach(
    files,
    (file) =>
      Effect.gen(function* () {
        const content = yield* readFile(file)
        return yield* analyzeFile(file, content)
      }),
    { concurrency: config.concurrency ?? 4 }
  )

// ✅ GOOD - Unbounded for cheap operations
const filePaths =
  yield * Effect.forEach(globs, (pattern) => matchGlob(pattern), { concurrency: "unbounded" })

// ❌ BAD - Sequential processing
for (const file of files) {
  const result = yield * processFile(file)
  results.push(result)
}
// Problem: Slow on large repos
```

### Memory Management

```typescript
// ✅ GOOD - Process in chunks for very large datasets
function* processInChunks<A, E, R>(
  items: A[],
  chunkSize: number,
  process: (chunk: A[]) => Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    yield* process(chunk)
  }
}

// Usage
yield *
  Effect.gen(function* () {
    const files = yield* discovery.listFiles(globs, exclude)

    yield* processInChunks(files, 100, (chunk) =>
      Effect.gen(function* () {
        yield* Effect.forEach(chunk, (file) => processFile(file), { concurrency: 4 })
      })
    )
  })
```

---

## Rule System

### Rule Interface

```typescript
export interface Rule {
  /** Unique identifier */
  id: string

  /** Rule category */
  kind: "pattern" | "boundary" | "docs" | "metrics"

  /** Execute rule check */
  run: (ctx: RuleContext) => Effect.Effect<RuleResult[], any>
}

export interface RuleContext {
  /** Current working directory */
  cwd: string

  /** List files matching glob patterns (lazy) */
  listFiles: (globs: string[]) => Effect.Effect<string[]>

  /** Read file content (lazy, cached) */
  readFile: (path: string) => Effect.Effect<string, any>

  /** Get import index (built on first use, cached) */
  getImportIndex: () => Effect.Effect<ImportIndex, any>

  /** User config (unknown, validate in rule) */
  config: unknown

  /** Root path for project */
  path: string

  /** Logger for debug output */
  logger: {
    debug: (message: string) => Effect.Effect<void>
    info: (message: string) => Effect.Effect<void>
  }
}
```

### Pattern Rule Helper

```typescript
import type { Severity } from "../types.js"

export interface MakePatternRuleInput {
  id: string
  files: string | string[]
  pattern: RegExp | string
  negativePattern?: RegExp | string
  message: string
  severity: Severity
  docsUrl?: string
  tags?: string[]
}

export const makePatternRule = (input: MakePatternRuleInput): Rule => ({
  id: input.id,
  kind: "pattern",
  run: (ctx: RuleContext) =>
    Effect.gen(function* () {
      const globs = Array.isArray(input.files) ? input.files : [input.files]
      const files = yield* ctx.listFiles(globs)

      const pattern =
        typeof input.pattern === "string" ? new RegExp(input.pattern, "gm") : input.pattern

      const negativePattern = input.negativePattern
        ? typeof input.negativePattern === "string"
          ? new RegExp(input.negativePattern, "gm")
          : input.negativePattern
        : null

      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)

        // Early exit if negative pattern matches
        if (negativePattern && negativePattern.test(content)) {
          continue
        }

        const matches = Array.from(content.matchAll(pattern))

        for (const match of matches) {
          const index = match.index ?? 0
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          // Build result with conditional optional properties
          const result: RuleResult = {
            id: input.id,
            ruleKind: "pattern",
            message: input.message,
            severity: input.severity,
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            },
            locations: [
              {
                line,
                column,
                text: match[0]
              }
            ]
          }

          // exactOptionalPropertyTypes-safe conditional properties
          if (input.docsUrl !== undefined) result.docsUrl = input.docsUrl
          if (input.tags !== undefined) result.tags = input.tags

          results.push(result)
        }
      }

      return results
    })
})
```

### Boundary Rule Helper

```typescript
export interface MakeBoundaryRuleInput {
  id: string
  from: string
  disallow: string[]
  message: string
  severity: Severity
  docsUrl?: string
  tags?: string[]
}

export const makeBoundaryRule = (input: MakeBoundaryRuleInput): Rule => ({
  id: input.id,
  kind: "boundary",
  run: (ctx: RuleContext) =>
    Effect.gen(function* () {
      const importIndex = yield* ctx.getImportIndex()
      const files = yield* ctx.listFiles([input.from])

      const results: RuleResult[] = []

      for (const file of files) {
        const imports = importIndex.getImports(file)

        for (const importPath of imports) {
          const isDisallowed = input.disallow.some((pattern) => {
            const regex = new RegExp(pattern.replace(/\*/g, ".*"))
            return regex.test(importPath)
          })

          if (isDisallowed) {
            const content = yield* ctx.readFile(file)
            const lines = content.split("\n")

            let lineNumber = 1
            for (const line of lines) {
              if (line.includes(importPath)) {
                const result: RuleResult = {
                  id: input.id,
                  ruleKind: "boundary",
                  message: `${input.message}: Found import of "${importPath}"`,
                  severity: input.severity,
                  file,
                  range: {
                    start: { line: lineNumber, column: 1 },
                    end: { line: lineNumber, column: line.length }
                  },
                  locations: [
                    {
                      line: lineNumber,
                      column: 1,
                      text: line.trim()
                    }
                  ]
                }

                if (input.docsUrl !== undefined) result.docsUrl = input.docsUrl
                if (input.tags !== undefined) result.tags = input.tags

                results.push(result)
                break
              }
              lineNumber++
            }
          }
        }
      }

      return results
    })
})
```

---

## Public API Design

### index.ts - Export Patterns

```typescript
// Public services
export { FileDiscovery, FileDiscoveryLive } from "./services/FileDiscovery.js"
export type { FileDiscoveryService } from "./services/FileDiscovery.js"

export { ImportIndex, ImportIndexLive } from "./services/ImportIndex.js"
export type { ImportIndexService } from "./services/ImportIndex.js"

export { RuleRunner, RuleRunnerLive } from "./services/RuleRunner.js"
export type { RuleRunnerService } from "./services/RuleRunner.js"

// Rule types and helpers
export { makeBoundaryRule, makePatternRule } from "./rules/helpers.js"
export type { MakeBoundaryRuleInput, MakePatternRuleInput } from "./rules/helpers.js"
export type { Preset, Rule, RuleContext, RuleResult } from "./rules/types.js"

// Config loader (NOT the schema itself)
export type { Config } from "./schema/Config.js"
export { loadConfig } from "./schema/loader.js"

// Domain types
export type { Finding, Location, Metric, Range, Severity, Violation } from "./types.js"

// ❌ DO NOT export internal schemas
// Users should not construct ConfigSchema directly

// ❌ DO NOT export internal helpers
// Keep glob matching, import extraction internal
```

### Layer Export Pattern

```typescript
// ✅ GOOD - Export both Tag and Live Layer
export class FileDiscovery extends Context.Tag("FileDiscovery")<
  FileDiscovery,
  FileDiscoveryService
>() {}

export const FileDiscoveryLive = Layer.effect() /* ... */

// Usage in consuming code:
import { FileDiscovery, FileDiscoveryLive } from "@effect-migrate/core"

const program = Effect.gen(function* () {
  const discovery = yield* FileDiscovery
  // ...
}).pipe(Effect.provide(FileDiscoveryLive))
```

---

## Testing

### Testing Services with Layers

```typescript
import { expect, it, layer } from "@effect/vitest"
import { Effect } from "effect"
import { FileDiscovery, FileDiscoveryLive } from "../src/services/FileDiscovery.js"

// Test with real layer
layer(FileDiscoveryLive)("FileDiscovery", (it) => {
  it.effect("should list TypeScript files", () =>
    Effect.gen(function* () {
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles(["**/*.ts"], ["node_modules/**"])

      expect(files.length).toBeGreaterThan(0)
      expect(files.every((f) => f.endsWith(".ts"))).toBe(true)
    })
  )

  it.effect("should cache file reads", () =>
    Effect.gen(function* () {
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles(["**/*.ts"])

      const content1 = yield* discovery.readFile(files[0])
      const content2 = yield* discovery.readFile(files[0])

      // Same reference = cached
      expect(content1).toBe(content2)
    })
  )
})
```

### Mocking Services

```typescript
import { Layer } from "effect"

// Create mock layer
const FileDiscoveryMock = Layer.succeed(FileDiscovery, {
  listFiles: (globs, exclude) => Effect.succeed(["src/index.ts", "src/utils.ts"]),
  readFile: (path) => Effect.succeed(`// Mock content of ${path}`),
  isTextFile: (path) => path.endsWith(".ts"),
  buildFileIndex: (globs, exclude, concurrency) =>
    Effect.succeed(
      new Map([
        ["src/index.ts", "// Mock index"],
        ["src/utils.ts", "// Mock utils"]
      ])
    )
})

// Use in test
it.effect("should process files", () =>
  Effect.gen(function* () {
    const runner = yield* RuleRunner
    const results = yield* runner.runRules(rules, config)

    expect(results.length).toBe(2)
  }).pipe(Effect.provide(RuleRunnerLive), Effect.provide(FileDiscoveryMock))
)
```

### Testing Rules

```typescript
import { makePatternRule } from "../src/rules/helpers.js"

it.effect("pattern rule should detect async/await", () =>
  Effect.gen(function* () {
    const rule = makePatternRule({
      id: "no-async-await",
      files: "**/*.ts",
      pattern: /async\s+function/g,
      message: "Use Effect.gen instead of async/await",
      severity: "warning"
    })

    // Create test context
    const ctx: RuleContext = {
      cwd: process.cwd(),
      path: ".",
      listFiles: (globs) => Effect.succeed(["test.ts"]),
      readFile: (file) => Effect.succeed("async function foo() {}"),
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

    const results = yield* rule.run(ctx)

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("no-async-await")
    expect(results[0].file).toBe("test.ts")
  })
)
```

---

## Anti-Patterns

### ❌ Don't: Use Node.js APIs Directly

```typescript
// ❌ BAD - Breaks platform abstraction
import * as fs from "node:fs/promises"

const content = await fs.readFile("file.txt", "utf-8")

// ✅ GOOD - Use @effect/platform
import { FileSystem } from "@effect/platform"

const content =
  yield *
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return yield* fs.readFileString("file.txt")
  })
```

### ❌ Don't: Load All Files Upfront

```typescript
// ❌ BAD - OOM risk
const allContents =
  yield * Effect.forEach(files, (file) => discovery.readFile(file), { concurrency: "unbounded" })

// ✅ GOOD - Lazy loading
for (const file of files) {
  const content = yield * discovery.readFile(file) // Cached
  if (matches(content)) {
    yield * processMatch(file, content)
  }
}
```

### ❌ Don't: Forget Error Types

```typescript
// ❌ BAD - Lost error information
const loadConfig = (path: string): Effect.Effect<Config> => {
  // Compiler error: Effect.Effect requires at least 2 type parameters
}

// ✅ GOOD - Explicit error types
const loadConfig = (
  path: string
): Effect.Effect<Config, ConfigLoadError | ConfigValidationError> => {
  // ...
}
```

### ❌ Don't: Mutate Config Objects

```typescript
// ❌ BAD - Mutation breaks immutability
const applyDefaults = (config: Config): Config => {
  if (!config.concurrency) {
    config.concurrency = 4 // Mutates input!
  }
  return config
}

// ✅ GOOD - Use Schema.withDefault or spread
const ConfigSchema = Schema.Struct({
  concurrency: Schema.Number.pipe(Schema.withDefault(() => 4))
})
```

### ❌ Don't: Export Internal Schemas

```typescript
// ❌ BAD - Exposes implementation details
export { ConfigSchema, PathsSchema, PatternRuleSchema } from "./schema/Config.js"

// ✅ GOOD - Export only types and loader
export type { Config } from "./schema/Config.js"
export { loadConfig } from "./schema/loader.js"
```

### ❌ Don't: Use Sequential Processing

```typescript
// ❌ BAD - Slow sequential
const results: RuleResult[] = []
for (const rule of rules) {
  const ruleResults = yield * rule.run(ctx)
  results.push(...ruleResults)
}

// ✅ GOOD - Concurrent with limit
const allResults =
  yield * Effect.forEach(rules, (rule) => rule.run(ctx), { concurrency: config.concurrency ?? 4 })
const results = allResults.flat()
```

---

## Troubleshooting

### Memory Issues

**Problem:** Process runs out of memory on large repos.

**Solutions:**

1. Verify lazy loading:

   ```typescript
   // Check that listFiles returns paths, not contents
   const files = yield * discovery.listFiles(globs, exclude)
   console.log(`Found ${files.length} files (not loaded yet)`)
   ```

2. Add concurrency limits:

   ```typescript
   // Limit concurrent file reads
   const results =
     yield *
     Effect.forEach(
       files,
       (file) => processFile(file),
       { concurrency: 4 } // Not "unbounded"
     )
   ```

3. Process in chunks:
   ```typescript
   for (let i = 0; i < files.length; i += 100) {
     const chunk = files.slice(i, i + 100)
     yield * processChunk(chunk)
   }
   ```

### Schema Validation Errors

**Problem:** Config fails to load with cryptic parse errors.

**Solutions:**

1. Use TreeFormatter for readable errors:

   ```typescript
   import * as TreeFormatter from "effect/TreeFormatter"

   const config =
     yield *
     Schema.decodeUnknown(ConfigSchema)(data).pipe(
       Effect.catchAll((parseError) => {
         const formatted = TreeFormatter.formatErrorSync(parseError)
         console.error(`Config validation failed:\n${formatted}`)
         return Effect.fail(new ConfigValidationError({ errors: formatted }))
       })
     )
   ```

2. Check optional property handling:

   ```typescript
   // ❌ BAD - Violates exactOptionalPropertyTypes
   const result: RuleResult = {
     id: "rule",
     message: "Issue",
     docsUrl: maybeUrl // string | undefined
   }

   // ✅ GOOD - Conditional assignment
   const result: RuleResult = {
     id: "rule",
     message: "Issue"
   }
   if (maybeUrl !== undefined) {
     result.docsUrl = maybeUrl
   }
   ```

### Performance Issues

**Problem:** Rule execution is slow.

**Solutions:**

1. Profile concurrency settings:

   ```typescript
   console.time("rule execution")
   const results =
     yield *
     runner.runRules(rules, {
       ...config,
       concurrency: 8 // Try different values
     })
   console.timeEnd("rule execution")
   ```

2. Check for sequential bottlenecks:

   ```typescript
   // Look for for-loops that could be Effect.forEach
   // Look for missing concurrency parameters
   ```

3. Verify caching:
   ```typescript
   // FileDiscovery.readFile should cache
   // ImportIndex should build only once
   ```

---

## Development Checklist

When adding new features to `@effect-migrate/core`:

- [ ] Use `@effect/platform` abstractions, not Node.js APIs
- [ ] Implement lazy loading for file operations
- [ ] Add concurrency limits (default 4)
- [ ] Use `Schema.Class` for all config types
- [ ] Export service Tag and Live Layer
- [ ] Add unit tests with `@effect/vitest`
- [ ] Document error types in function signatures
- [ ] Handle `exactOptionalPropertyTypes` correctly
- [ ] Update `index.ts` to export public API
- [ ] Add JSDoc comments for public APIs

---

**Last Updated:** 2025-11-03\
**See Also:** [Root AGENTS.md](../../AGENTS.md) for general Effect patterns
