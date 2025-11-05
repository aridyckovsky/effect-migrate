# AGENTS.md - effect-migrate Monorepo

**Last Updated:** 2025-11-05\
**For:** AI Coding Agents (Amp, Cursor, etc.)

This file provides comprehensive guidance for working on the effect-migrate project, a TypeScript monorepo using Effect-TS for building migration tooling.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Monorepo Structure](#monorepo-structure)
- [Effect-TS Best Practices](#effect-ts-best-practices)
- [Development Commands](#development-commands)
- [Testing](#testing)
- [Package-Specific Guides](#package-specific-guides)
- [Anti-Patterns](#anti-patterns)
- [Resources](#resources)

---

## Project Overview

**effect-migrate** is a CLI tool that helps TypeScript developers migrate projects to Effect patterns while keeping AI coding agents on track with structured context output.

### Technology Stack

- **Language:** TypeScript 5.x (strict mode, exactOptionalPropertyTypes)
- **Runtime:** Node.js 22.x
- **Package Manager:** pnpm 9.x
- **Build Tool:** TypeScript Compiler (tsc)
- **Testing:** Vitest with @effect/vitest
- **Core Dependencies:**
  - `effect@3.18.4` - Effect runtime and Schema
  - `@effect/platform@0.92.1` - Cross-platform abstractions
  - `@effect/platform-node@0.98.4` - Node.js implementations
  - `@effect/cli@0.71.0` - CLI framework

### Key Principles

1. **Effect-First Architecture**: All business logic uses Effect, no raw Promises
2. **Type Safety**: Leverage Effect's type system for compile-time guarantees
3. **Resource Safety**: Use acquireRelease for proper cleanup
4. **Composability**: Build with Layers and dependency injection
5. **Testing**: Unit tests for logic, integration tests for workflows

---

## Monorepo Structure

```
effect-migrate/
├── packages/
│   ├── core/                  # @effect-migrate/core - Reusable engine
│   │   ├── src/
│   │   │   ├── engines/       # PatternEngine, BoundaryEngine, etc. (internal)
│   │   │   ├── services/      # FileDiscovery, ImportIndex, RuleRunner
│   │   │   ├── rules/         # Rule types and helpers
│   │   │   ├── schema/        # Config schema with effect/Schema
│   │   │   └── types.ts       # Core domain types
│   │   └── package.json
│   ├── cli/                   # @effect-migrate/cli - CLI interface
│   │   ├── src/
│   │   │   ├── commands/      # audit, metrics, docs, init commands
│   │   │   ├── formatters/    # Console and JSON output
│   │   │   └── amp/           # Amp context output (MCP-compatible)
│   │   └── package.json
│   └── preset-basic/          # @effect-migrate/preset-basic - Default rules
│       ├── src/
│       │   ├── patterns.ts    # Pattern-based rules
│       │   ├── boundaries.ts  # Architectural boundary rules
│       │   └── index.ts       # Preset export
│       └── package.json
├── examples/                  # Example projects
├── .vscode/                   # VS Code settings for Effect dev
├── tsconfig.json              # Base TypeScript config
├── tsconfig.build.json        # Build config
├── pnpm-workspace.yaml        # Workspace definition
└── package.json               # Root workspace config
```

### Workspace Dependencies

Packages use `workspace:*` protocol for internal dependencies:

```json
{
  "dependencies": {
    "@effect-migrate/core": "workspace:*"
  }
}
```

---

## Effect-TS Best Practices

### 1. Effect.gen vs pipe

**Use Effect.gen for sequential async operations:**

```typescript
import { Effect } from "effect"

// ✅ GOOD - Readable, sequential
const program = Effect.gen(function* () {
  const config = yield* loadConfig()
  const files = yield* listFiles(config.paths)
  const results = yield* processFiles(files)
  return results
})
```

**Use pipe for functional composition:**

```typescript
import { Effect, pipe } from "effect"

// ✅ GOOD - Composable transformations
const program = pipe(
  fetchData(),
  Effect.map((data) => data.items),
  Effect.filter((item) => item.active),
  Effect.tap((items) => Console.log(`Found ${items.length} items`))
)
```

### 2. Error Handling with TaggedError

```typescript
import { Data } from "effect"

// Define errors with Data.TaggedError
class ConfigLoadError extends Data.TaggedError("ConfigLoadError")<{
  readonly path: string
  readonly message: string
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly reason: string
}> {}

// Use in Effects
const loadConfig = (path: string): Effect.Effect<Config, ConfigLoadError> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs
      .readFileString(path)
      .pipe(
        Effect.catchAll(() => Effect.fail(new ConfigLoadError({ path, message: "File not found" })))
      )
    return JSON.parse(content)
  })

// Handle specific errors
const program = loadConfig("config.json").pipe(
  Effect.catchTag("ConfigLoadError", (error) =>
    Effect.gen(function* () {
      yield* Console.error(`Failed to load ${error.path}: ${error.message}`)
      return defaultConfig
    })
  )
)
```

### 3. Resource Management

```typescript
import { Console, Effect } from "effect"

// Use acquireRelease for resources
const withFile = (path: string) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      yield* Console.log(`Opening ${path}`)
      const fs = yield* FileSystem.FileSystem
      return yield* fs.open(path)
    }),
    (file) => Console.log(`Closing ${path}`)
  )

// Use with Effect.scoped
const program = Effect.scoped(
  Effect.gen(function* () {
    const file = yield* withFile("data.txt")
    const content = yield* file.read()
    return content
  })
)
```

### 4. Services and Layers

**IMPORTANT:** Services define behavior contracts (interfaces), NOT data contracts (Schema). Use plain TypeScript interfaces for services, and export them from their definition files.

```typescript
import { Context, Effect, Layer } from "effect"
import type { PlatformError } from "@effect/platform/Error"

// ✅ GOOD - Define service interface separately and export it
export interface FileDiscoveryService {
  readonly listFiles: (
    globs: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>
  ) => Effect.Effect<string[], PlatformError>
  readonly readFile: (path: string) => Effect.Effect<string, PlatformError>
  readonly isTextFile: (path: string) => boolean
}

// ✅ GOOD - Create tag with exported interface
export class FileDiscovery extends Context.Tag("FileDiscovery")<
  FileDiscovery,
  FileDiscoveryService
>() {}

// ✅ GOOD - Create Live implementation as Layer
export const FileDiscoveryLive = Layer.effect(
  FileDiscovery,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    return {
      listFiles: (globs, exclude) =>
        Effect.gen(function* () {
          // Implementation
        }),
      readFile: (path) => fs.readFileString(path),
      isTextFile: (path) => TEXT_EXTENSIONS.has(path.extname(path))
    }
  })
)

// ✅ GOOD - Import service type in consumers
import type { FileDiscoveryService } from "../services/FileDiscovery.js"

export const runPatternRules = (
  rules: ReadonlyArray<Rule>,
  config: Config,
  discovery: FileDiscoveryService // Use imported type
): Effect.Effect<ReadonlyArray<RuleResult>, PlatformError> =>
  Effect.gen(function* () {
    const files = yield* discovery.listFiles(globs, exclude)
    // ...
  })

// ❌ BAD - Don't redefine service interface in consumers
type FileDiscoveryService = Context.Tag.Service<FileDiscovery> // NEVER do this

// ❌ BAD - Don't use Schema for service interfaces
const FileDiscoveryService = Schema.Struct({
  // WRONG! Schema is for data, not services
  listFiles: Schema.Function(/* ... */),
  readFile: Schema.Function(/* ... */)
})
```

**Key Points:**

- **Export service interface** from the service file (e.g., `FileDiscoveryService`)
- **Export the tag** as a class extending `Context.Tag(id)<Self, ServiceInterface>()`
- **Import the service interface type** in consumers, don't redefine it
- **Use Schema for data models**, not service definitions
- Service methods return `Effect.Effect<A, E, R>` types

### 5. Schema Validation

```typescript
import { Schema } from "effect"

// Define schemas with Schema.Struct
const ConfigSchema = Schema.Struct({
  version: Schema.Number,
  paths: Schema.Struct({
    root: Schema.String,
    exclude: Schema.Array(Schema.String).pipe(
      Schema.withDefault(() => ["node_modules/**", "dist/**"])
    )
  }),
  patterns: Schema.optional(Schema.Array(PatternRuleSchema))
})

// Decode with Effect
const decodeConfig = (data: unknown): Effect.Effect<Config, ParseError> =>
  Schema.decodeUnknown(ConfigSchema)(data)

// Use in program
const program = Effect.gen(function* () {
  const rawConfig = yield* fs.readFileString("config.json")
  const data = JSON.parse(rawConfig)
  const config = yield* decodeConfig(data).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new ConfigLoadError({
          message: TreeFormatter.formatErrorSync(error)
        })
      )
    )
  )
  return config
})
```

### 6. Concurrent Processing

```typescript
import { Effect } from "effect"

// Process items concurrently
const processFiles = (files: string[]) =>
  Effect.forEach(
    files,
    (file) =>
      Effect.gen(function* () {
        const content = yield* readFile(file)
        const result = yield* analyzeContent(content)
        return { file, result }
      }),
    { concurrency: 4 } // Limit concurrent operations
  )

// Unbounded concurrency (use with caution)
const fastProcess = Effect.forEach(files, processFile, {
  concurrency: "unbounded"
})
```

### 7. Platform Services

```typescript
import { FileSystem, Path } from "@effect/platform"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // FileSystem service
  const fs = yield* FileSystem.FileSystem
  const exists = yield* fs.exists("./config.json")
  const content = yield* fs.readFileString("./data.txt")
  yield* fs.writeFileString("./output.txt", "Hello")
  yield* fs.makeDirectory("./temp", { recursive: true })
  const files = yield* fs.readDirectory("./src")

  // Path service
  const path = yield* Path.Path
  const joined = path.join("src", "index.ts")
  const absolute = path.resolve("./file.txt")
  const dirname = path.dirname("/user/local/bin")

  return { exists, files }
})

// Provide NodeContext.layer for all Node.js services
import { NodeContext, NodeRuntime } from "@effect/platform-node"

program.pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
```

---

## Development Commands

### Installation

```bash
# Install dependencies for all packages
pnpm install

# Install in specific package
pnpm --filter @effect-migrate/core install
```

### Building

```bash
# Build all packages
pnpm -r build

# Build specific package
pnpm --filter @effect-migrate/core build

# Type check without emitting
pnpm -r typecheck

# Clean build artifacts
pnpm -r clean
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in specific package
pnpm --filter @effect-migrate/core test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage
```

### Linting

```bash
# Lint all packages
pnpm lint

# Format code
pnpm format

# Type check
pnpm check
```

### CLI Development

```bash
# Build CLI
pnpm --filter @effect-migrate/cli build

# Run CLI locally (after build)
node packages/cli/dist/index.js audit

# Or link globally
cd packages/cli
pnpm link --global
effect-migrate audit
```

### Release & Publishing

**Uses Changesets** for version management and npm publishing.

**Creating a Release:**

1. **Make your changes** and commit them
2. **Create a changeset** describing the changes:

   ```bash
   pnpm changeset
   ```

   - Select which packages changed
   - Choose version bump type (major/minor/patch)
   - Write a description of the changes

3. **Commit the changeset file**:

   ```bash
   git add .changeset/*.md
   git commit -m "chore: add changeset for feature X"
   git push
   ```

4. **Workflow creates "Version Packages" PR**:
   - Automatically generated by GitHub Actions
   - Updates package.json versions
   - Generates/updates CHANGELOGs
   - Creates git tags

5. **Review and merge the PR** when ready to publish:
   - Merging triggers automatic npm publish
   - Packages are published with provenance
   - GitHub release is created

**Important Notes:**

- ❌ **Don't run `pnpm changeset version` locally** - let the workflow handle it via PR
- ❌ **Don't unpublish versions** - blocks republishing for 24 hours
- ✅ **Only merge "Version Packages" PR when ready to publish**
- ✅ **Multiple changesets can accumulate before release**
- ✅ **Releases only happen when you merge the version PR**

**NPM Organization:**

Packages are published under the `@effect-migrate` scope:

- `@effect-migrate/core`
- `@effect-migrate/cli`
- `@effect-migrate/preset-basic`

The npm organization must exist at https://www.npmjs.com/org/effect-migrate before publishing.

---

## Testing

### Testing with @effect/vitest

```typescript
import { expect, it } from "@effect/vitest"
import { Effect } from "effect"

// Basic Effect test
it.effect("should process correctly", () =>
  Effect.gen(function* () {
    const result = yield* processData({ input: "test" })
    expect(result.output).toBe("processed: test")
  })
)

// Test with Exit
it.effect("should handle errors", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(riskyOperation())
    expect(Exit.isFailure(result)).toBe(true)
  })
)

// Scoped test (for resources)
it.scoped("should manage resources", () =>
  Effect.gen(function* () {
    const resource = yield* acquireResource()
    expect(resource.isOpen).toBe(true)
    // Resource automatically released after test
  })
)

// Live test (real environment)
it.live("should use real clock", () =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    expect(now).toBeGreaterThan(0)
  })
)
```

### Layer Testing

```typescript
import { layer } from "@effect/vitest"

// Test with provided layer
layer(FileDiscoveryLive)("FileDiscovery tests", (it) => {
  it.effect("should list files", () =>
    Effect.gen(function* () {
      const discovery = yield* FileDiscovery
      const files = yield* discovery.listFiles("*.ts")
      expect(files.length).toBeGreaterThan(0)
    })
  )
})
```

### Mocking Services

```typescript
// Create mock layer
const FileDiscoveryMock = Layer.succeed(FileDiscovery, {
  listFiles: (pattern) => Effect.succeed(["file1.ts", "file2.ts"]),
  readFile: (path) => Effect.succeed(`mock content of ${path}`)
})

// Use in test
it.effect("should use mock", () =>
  Effect.gen(function* () {
    const discovery = yield* FileDiscovery
    const files = yield* discovery.listFiles("*.ts")
    expect(files).toEqual(["file1.ts", "file2.ts"])
  }).pipe(Effect.provide(FileDiscoveryMock))
)
```

---

## Package-Specific Guides

### @effect-migrate/core

**See:** [packages/core/AGENTS.md](./packages/core/AGENTS.md)

**Key Concerns:**

- Service implementation with proper Layer composition
- Schema validation for user config
- Lazy file loading to avoid OOM on large repos
- Concurrent processing with configurable limits
- Platform-agnostic code (use @effect/platform abstractions)

### @effect-migrate/cli

**See:** [packages/cli/AGENTS.md](./packages/cli/AGENTS.md)

**Key Concerns:**

- @effect/cli Command definitions
- Options and Args validation
- Error handling and exit codes
- Output formatting (console vs JSON)
- Amp context generation (MCP-compatible)

### @effect-migrate/preset-basic

**See:** [packages/preset-basic/AGENTS.md](./packages/preset-basic/AGENTS.md)

**Key Concerns:**

- Rule creation using makePatternRule and makeBoundaryRule helpers
- Conservative defaults (favor precision over recall)
- Clear documentation for each rule
- Testing rules against fixtures

---

## Anti-Patterns

### ❌ Don't: Import from Barrel Files

```typescript
// ❌ BAD - Hurts tree-shaking
import { Console, Effect, pipe } from "effect"

// ✅ GOOD - Import from specific modules
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
```

**Why:** Barrel imports prevent tree-shaking and increase bundle size.

**Enforcement:** `@effect/eslint-plugin` rule `no-import-from-barrel-package`

### ❌ Don't: Mix Promise and Effect

```typescript
// ❌ BAD - Lost error handling and interruption
const bad = async () => {
  const value = await Effect.runPromise(someEffect)
  return value
}

// ✅ GOOD - Stay in Effect
const good = Effect.gen(function* () {
  const value = yield* someEffect
  return value
})
```

### ❌ Don't: Ignore Error Types

```typescript
// ❌ BAD - Lost type information
const bad = riskyEffect.pipe(Effect.catchAll(() => Effect.succeed(defaultValue)))

// ✅ GOOD - Handle specific errors
const good = riskyEffect.pipe(
  Effect.catchTag("NetworkError", () => Effect.succeed(cachedValue)),
  Effect.catchTag("ValidationError", (e) => Effect.fail(new UserError({ message: e.reason })))
)
```

### ❌ Don't: Use `any` or Type Assertions

```typescript
// ❌ BAD
const bad = Effect.succeed(data as User)

// ✅ GOOD - Use Schema validation
const good = Schema.decodeUnknown(UserSchema)(data)
```

### ❌ Don't: Forget to Provide Dependencies

```typescript
// ❌ BAD - Runtime error
const program = Effect.gen(function* () {
  const db = yield* Database
  return yield* db.query("SELECT * FROM users")
})
Effect.runPromise(program) // Error: Missing Database!

// ✅ GOOD - Provide all layers
Effect.runPromise(program.pipe(Effect.provide(DatabaseLive)))
```

### ❌ Don't: Process Large Arrays Sequentially

```typescript
// ❌ BAD - Slow sequential processing
const bad = Effect.gen(function* () {
  const results = []
  for (const item of items) {
    const result = yield* processItem(item)
    results.push(result)
  }
  return results
})

// ✅ GOOD - Concurrent processing with limit
const good = Effect.forEach(items, processItem, { concurrency: 4 })
```

### ❌ Don't: Use try/catch Inside Effect.gen

```typescript
// ❌ BAD - Breaks Effect error handling
const bad = Effect.gen(function* () {
  try {
    const result = yield* riskyOperation()
    return result
  } catch (error) {
    return defaultValue
  }
})

// ✅ GOOD - Use Effect combinators
const good = Effect.gen(function* () {
  const result = yield* riskyOperation().pipe(Effect.catchAll(() => Effect.succeed(defaultValue)))
  return result
})
```

### ❌ Don't: Redefine Service Types in Consumers

```typescript
// ❌ BAD - Redefining service interface in consumer
// packages/core/src/engines/PatternEngine.ts
export interface FileDiscoveryService {
  readonly listFiles: (globs: string[]) => Effect.Effect<string[]>
  readonly readFile: (path: string) => Effect.Effect<string>
}

// ❌ BAD - Using Context.Tag.Service<> to extract type
import { FileDiscovery } from "../services/FileDiscovery.js"
type FileDiscoveryService = Context.Tag.Service<FileDiscovery>

// ✅ GOOD - Import the service type from the service file
import type { FileDiscoveryService } from "../services/FileDiscovery.js"

export const runPatternRules = (
  discovery: FileDiscoveryService // Type imported from source
) => Effect.gen(/* ... */)
```

**Why:** Service interfaces should be defined once in the service file and exported. Consumers should import the type, not redefine it. This follows DRY principles and ensures type consistency.

### ❌ Don't: Use Schema for Service Interfaces

```typescript
// ❌ BAD - Schema for service definition
const FileDiscoveryService = Schema.Struct({
  listFiles: Schema.Function(
    Schema.Tuple(Schema.Array(Schema.String)),
    Schema.Array(Schema.String)
  ),
  readFile: Schema.Function(Schema.Tuple(Schema.String), Schema.String)
})

// ✅ GOOD - Plain TypeScript interface for services
export interface FileDiscoveryService {
  readonly listFiles: (globs: string[]) => Effect.Effect<string[], PlatformError>
  readonly readFile: (path: string) => Effect.Effect<string, PlatformError>
}

// ✅ GOOD - Use Schema for data models
const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String
})
type User = Schema.Schema.Type<typeof User>
```

**Why:** Schema is for data contracts (validation/transformation), not behavior contracts. Services define operations; Schema validates data flowing through those operations.

---

## TypeScript Configuration

### Strict Settings

All packages use strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noImplicitReturns": false,
    "moduleDetection": "force",
    "moduleResolution": "NodeNext",
    "module": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022"]
  }
}
```

### exactOptionalPropertyTypes

This setting requires handling optional properties carefully:

```typescript
// ❌ BAD - Type error with exactOptionalPropertyTypes
const result: RuleResult = {
  id: "rule-1",
  message: "Issue found",
  docsUrl: input.docsUrl // string | undefined
}

// ✅ GOOD - Conditionally include optional props
const result: RuleResult = {
  id: "rule-1",
  message: "Issue found",
  ...(input.docsUrl && { docsUrl: input.docsUrl })
}

// ✅ ALSO GOOD - Spread with type guard
const result: RuleResult = {
  id: "rule-1",
  message: "Issue found"
}
if (input.docsUrl) {
  result.docsUrl = input.docsUrl
}
```

---

## Development Tools

### VS Code Setup

**Required Extensions:**

- TypeScript and JavaScript Language Features (built-in)
- ESLint
- Prettier (optional, we use dprint via ESLint)

**Workspace Settings** (`.vscode/settings.json`):

```json
{
  "typescript.tsdk": "./node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### Effect Language Service

**Already configured in** `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service",
        "namespaceImportPackages": ["effect", "@effect/*"]
      }
    ]
  }
}
```

**Features:**

- 75+ diagnostics for Effect patterns
- Quickinfo with extended type parameters
- Refactors (async → Effect.gen, Layer Magic)
- Auto-completions for Effect combinators

**Enable in Build:**

```bash
# Run once after installing dependencies
pnpm effect-language-service patch
```

### ESLint Plugin

**Configured in** `eslint.config.mjs`:

```javascript
import * as effectEslint from "@effect/eslint-plugin"

export default [
  ...effectEslint.configs.dprint,
  {
    plugins: { "@effect": effectEslint },
    rules: {
      "@effect/no-import-from-barrel-package": [
        "error",
        {
          packageNames: ["effect", "@effect/platform", "@effect/cli"]
        }
      ]
    }
  }
]
```

---

## Resources

### Official Documentation

- **Effect Website:** https://effect.website
- **API Docs:** https://effect-ts.github.io/effect
- **Discord Community:** https://discord.gg/effect-ts

### Effect Packages

- **effect:** Core library with Effect runtime, Schema, and primitives
- **@effect/platform:** Cross-platform abstractions (FileSystem, Path, Command)
- **@effect/platform-node:** Node.js implementations
- **@effect/cli:** CLI framework with Options, Args, Commands
- **@effect/vitest:** Testing utilities for Effect
- **@effect/eslint-plugin:** ESLint rules for Effect patterns
- **@effect/language-service:** TypeScript language service plugin

### Internal Documentation

- [packages/core/AGENTS.md](./packages/core/AGENTS.md) - Core package guide
- [packages/cli/AGENTS.md](./packages/cli/AGENTS.md) - CLI package guide
- [packages/preset-basic/AGENTS.md](./packages/preset-basic/AGENTS.md) - Preset package guide

### Reference Projects

- **Effect Monorepo:** https://github.com/Effect-TS/effect
- **Effect Examples:** https://github.com/Effect-TS/examples

---

## Common Patterns Cheat Sheet

### File Operations

```typescript
import { FileSystem } from "@effect/platform"

const fs = yield * FileSystem.FileSystem

// Read
const content = yield * fs.readFileString("file.txt")
const buffer = yield * fs.readFile("file.bin")

// Write
yield * fs.writeFileString("output.txt", content)

// Check existence
const exists = yield * fs.exists("file.txt")

// Directory
yield * fs.makeDirectory("./dist", { recursive: true })
const files = yield * fs.readDirectory("./src")

// Stats
const stat = yield * fs.stat("file.txt")
if (stat.type === "File") {
  /* ... */
}
```

### Path Operations

```typescript
import { Path } from "@effect/platform"

const path = yield * Path.Path

const joined = path.join("src", "components", "Button.tsx")
const absolute = path.resolve("./file.txt")
const relative = path.relative("/a/b/c", "/a/d/e")
const dirname = path.dirname("/user/local/bin/node")
const basename = path.basename("/file.txt", ".txt")
const extname = path.extname("file.ts") // ".ts"
```

### Schema Patterns

```typescript
import { Schema } from "effect"

// Basic types
const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  age: Schema.Number,
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@/))
})

// Optional with default
const Config = Schema.Struct({
  port: Schema.Number.pipe(Schema.withDefault(() => 3000)),
  host: Schema.optional(Schema.String)
})

// Union types
const Status = Schema.Literal("pending", "success", "error")

// Arrays
const Tags = Schema.Array(Schema.String)

// Transformations
const DateFromString = Schema.transformOrFail(Schema.String, Schema.DateFromSelf, {
  decode: (s) => {
    const date = new Date(s)
    return isNaN(date.getTime())
      ? Effect.fail(new ParseError({ message: "Invalid date" }))
      : Effect.succeed(date)
  },
  encode: (date) => Effect.succeed(date.toISOString())
})

// Decoding
const decode = Schema.decodeUnknown(User)
const result = yield * decode(data)
```

---

**Last Updated:** 2025-11-05\
**Maintainer:** Ari Dyckovsky\
**License:** MIT
