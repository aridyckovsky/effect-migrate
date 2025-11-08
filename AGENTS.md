# AGENTS.md - effect-migrate Monorepo

**Last Updated:** 2025-11-08\
**For:** AI Coding Agents (Amp, Cursor, etc.)

This document defines the norms, rules, and conventions you MUST follow when working on the effect-migrate project, a TypeScript monorepo using Effect-TS for building migration tooling.

## Mandatory Requirements

As an AI agent working on this codebase, you MUST:

1. **Effect-First Architecture**: Write ALL business logic using Effect patterns—never use raw Promises or async/await
2. **Type Safety**: Always export service interfaces from their definition files and use Schema for ALL data validation
3. **Resource Safety**: Use `Effect.acquireRelease` for ALL resources requiring cleanup; always provide all required layers
4. **Testing**: Run `pnpm test` before EVERY commit; use `@effect/vitest` for all tests
5. **Git Workflow**: Use conventional commits (`feat(scope):`, `fix(scope):`), granular commits (one logical change per commit), and proper branch naming (`feat/`, `fix/`, `chore/`)
6. **CLI Development**: Always use `pnpm cli` for local testing—do NOT build first
7. **Public API**: Export ONLY what consumers need from `@effect-migrate/core/src/index.ts`—keep internal engines and helpers private

## NEVER Do These Things

**NEVER:**

- ❌ Use raw `Promise`, `async/await`, or `.then()` in business logic (core, CLI packages)
- ❌ Call `console.log`, `console.error`, or `process.exit` directly
- ❌ Import from effect barrel packages (`import { Effect } from "effect"`)
- ❌ Deep-import from `@effect-migrate/core` internals in CLI or presets
- ❌ Build the CLI to test it—always use `pnpm cli`
- ❌ Use `try/catch` inside `Effect.gen`
- ❌ Swallow errors with `catchAll(() => Effect.succeed(...))`
- ❌ Redefine service interfaces in consumers—import the exported type
- ❌ Read `package.json` directly—use `getPackageMeta` from core
- ❌ Commit without running `pnpm test`
- ❌ Mix multiple unrelated changes in one commit

---

## Table of Contents

- [Project Overview](#project-overview)
- [Monorepo Structure](#monorepo-structure)
- [Effect-TS Mandatory Patterns](#effect-ts-mandatory-patterns)
- [Development Workflow](#development-workflow)
- [Testing Requirements](#testing-requirements)
- [Git Workflow Rules](#git-workflow-rules)
- [Package-Specific Requirements](#package-specific-requirements)
- [Reference](#reference)

---

## Project Overview

**effect-migrate** is a CLI tool that helps TypeScript developers migrate projects to Effect patterns while keeping AI coding agents on track with structured context output.

### Technology Stack

- **Language:** TypeScript 5.x (strict mode, exactOptionalPropertyTypes)
- **Runtime:** Node.js 22.x
- **Package Manager:** pnpm 10.x
- **Build Tool:** TypeScript Compiler (tsc)
- **Testing:** Vitest with @effect/vitest
- **Core Dependencies:**
  - `effect@3.19.2` - Effect runtime and Schema
  - `@effect/platform@0.93.0` - Cross-platform abstractions
  - `@effect/platform-node@0.100.0` - Node.js implementations
  - `@effect/cli@0.72.0` - CLI framework

---

## Monorepo Structure

```
effect-migrate/
├── packages/
│   ├── core/                  # @effect-migrate/core - Reusable engine
│   │   ├── src/
│   │   │   ├── amp/           # Amp context utilities (context-writer, thread-manager, package-meta)
│   │   │   ├── config/        # Config utilities and defaults
│   │   │   ├── engines/       # PatternEngine, BoundaryEngine, etc. (INTERNAL)
│   │   │   ├── presets/       # Built-in presets
│   │   │   ├── rules/         # Rule types and helpers
│   │   │   ├── schema/        # Config schema with effect/Schema
│   │   │   ├── services/      # FileDiscovery, ImportIndex, RuleRunner
│   │   │   ├── utils/         # Internal utilities
│   │   │   ├── index.ts       # PUBLIC API (export boundary)
│   │   │   └── types.ts       # Core domain types
│   │   └── package.json
│   ├── cli/                   # @effect-migrate/cli - CLI interface
│   │   ├── src/
│   │   │   ├── amp/           # Amp option helpers (normalizeArgs, options)
│   │   │   ├── commands/      # audit, docs, init, metrics, thread
│   │   │   ├── formatters/    # Console and JSON output
│   │   │   ├── layers/        # CLI-specific layers (PresetLoaderWorkspace)
│   │   │   ├── loaders/       # Config and preset loaders
│   │   │   └── index.ts       # CLI entry point
│   │   └── package.json
│   └── preset-basic/          # @effect-migrate/preset-basic - Default rules
│       └── src/
│           └── index.ts       # Preset export
```

### Public API Boundary (MANDATORY)

You MUST respect the core package's public API boundary:

**Export from `@effect-migrate/core/src/index.ts` (ONLY these):**

- ✅ Types consumed by CLI/presets: `Rule`, `RuleResult`, `Config`, `Severity`, etc.
- ✅ Service tags and interfaces: `FileDiscovery`, `FileDiscoveryService`, `ImportIndex`, etc.
- ✅ Rule builders: `makePatternRule`, `makeBoundaryRule`, `rulesFromConfig`
- ✅ Utilities: `getPackageMeta`, `loadConfig`, `defineConfig`, `mergeConfig`
- ✅ Schema classes: `ConfigSchema`, `PatternRuleSchema`, `BoundaryRuleSchema`, etc.
- ✅ Amp context utilities: `writeAmpContext`, `addThread`, `readThreads`, `getPackageMeta`, etc.

**NEVER export (keep internal):**

- ❌ Internal engines: `PatternEngine`, `BoundaryEngine`
- ❌ Internal helpers: file matching, import extraction utilities

**Consumer packages (CLI, presets) MUST:**

- Import ONLY from `@effect-migrate/core` root index
- NEVER deep-import internal paths like `@effect-migrate/core/services/FileDiscovery`

### Version Management Rules

You MUST follow these versioning practices:

**Package versions:**

- Managed by Changesets
- Add a changeset for ANY public API or behavior change
- Commit changesets separately: `chore: add changeset for <feature>`

**Tool version (MANDATORY):**

- CLI MUST read version dynamically using `getPackageMeta` from core
- NEVER hardcode version strings in CLI commands
- Example:
  ```typescript
  import { getPackageMeta } from "@effect-migrate/core"
  const { toolVersion, schemaVersion } = yield* getPackageMeta
  ```

**Schema versions:**

- Track artifact format compatibility (independent of package versions)
- Defined in `@effect-migrate/core` as `SCHEMA_VERSION`

---

## Effect-TS Mandatory Patterns

### 1. Effect.gen vs pipe (REQUIRED)

You MUST choose the right pattern for each situation:

**REQUIRED: Use Effect.gen for sequential workflows with multiple dependencies:**

```typescript
import * as Effect from "effect/Effect"

// ✅ REQUIRED - Multiple service dependencies
const program = Effect.gen(function* () {
  const config = yield* loadConfig()
  const files = yield* listFiles(config.paths)
  const results = yield* processFiles(files)
  return results
})
```

**REQUIRED: Use pipe for single-value transformations:**

```typescript
import { pipe } from "effect/Function"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"

// ✅ REQUIRED - Operator composition on single Effect
const program = pipe(
  fetchData(),
  Effect.map((data) => data.items),
  Effect.filter((item) => item.active),
  Effect.tap((items) => Console.log(`Found ${items.length} items`))
)
```

**FORBIDDEN patterns:**

```typescript
// ❌ FORBIDDEN - Mixing async/await with Effect
const bad = async () => {
  const value = await Effect.runPromise(someEffect)
  return value
}

// ❌ FORBIDDEN - Over-nesting Effect.gen
Effect.gen(function* () {
  const result = yield* Effect.gen(function* () {
    return yield* getA()
  })
  return result
})
```

### 2. Error Handling (MANDATORY)

You MUST define all errors as TaggedError classes:

```typescript
import { Data } from "effect"

// ✅ REQUIRED - Define errors with Data.TaggedError
class ConfigLoadError extends Data.TaggedError("ConfigLoadError")<{
  readonly path: string
  readonly message: string
}> {}

// ✅ REQUIRED - Use in Effects with explicit error types
const loadConfig = (path: string): Effect.Effect<Config, ConfigLoadError> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs
      .readFileString(path)
      .pipe(
        Effect.catchAll(() =>
          Effect.fail(new ConfigLoadError({ path, message: "File not found" }))
        )
      )
    return JSON.parse(content)
  })

// ✅ REQUIRED - Handle specific errors with catchTag
const program = loadConfig("config.json").pipe(
  Effect.catchTag("ConfigLoadError", (error) =>
    Effect.gen(function* () {
      yield* Console.error(`Failed to load ${error.path}: ${error.message}`)
      return defaultConfig
    })
  )
)
```

**NEVER:**

```typescript
// ❌ NEVER - Swallow errors without logging or re-failing
riskyEffect.pipe(Effect.catchAll(() => Effect.succeed(defaultValue)))

// ❌ NEVER - Use try/catch inside Effect.gen
Effect.gen(function* () {
  try {
    const result = yield* riskyOperation()
    return result
  } catch (error) {
    return defaultValue
  }
})
```

### 3. Resource Management (REQUIRED)

You MUST use `acquireRelease` for ALL resources:

```typescript
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"

// ✅ REQUIRED - Use acquireRelease for resources
const withFile = (path: string) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      yield* Console.log(`Opening ${path}`)
      const fs = yield* FileSystem.FileSystem
      return yield* fs.open(path)
    }),
    (file) => Console.log(`Closing ${path}`)
  )

// ✅ REQUIRED - Use with Effect.scoped
const program = Effect.scoped(
  Effect.gen(function* () {
    const file = yield* withFile("data.txt")
    const content = yield* file.read()
    return content
  })
)
```

### 4. Services and Layers (MANDATORY)

You MUST follow these service patterns:

**REQUIRED: Export service interface from service file:**

```typescript
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { PlatformError } from "@effect/platform/Error"

// ✅ REQUIRED - Define and export service interface
export interface FileDiscoveryService {
  readonly listFiles: (
    globs: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>
  ) => Effect.Effect<string[], PlatformError>
  readonly readFile: (path: string) => Effect.Effect<string, PlatformError>
}

// ✅ REQUIRED - Create tag with exported interface
export class FileDiscovery extends Context.Tag("FileDiscovery")<
  FileDiscovery,
  FileDiscoveryService
>() {}

// ✅ REQUIRED - Create Live implementation as Layer
export const FileDiscoveryLive = Layer.effect(
  FileDiscovery,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return {
      listFiles: (globs, exclude) => Effect.gen(function* () {
        // Implementation
      }),
      readFile: (path) => fs.readFileString(path)
    }
  })
)
```

**REQUIRED: Import service type in consumers:**

```typescript
// ✅ REQUIRED - Import the exported type
import type { FileDiscoveryService } from "../services/FileDiscovery.js"

export const runPatternRules = (
  discovery: FileDiscoveryService // Use imported type
): Effect.Effect<ReadonlyArray<RuleResult>, PlatformError> =>
  Effect.gen(function* () {
    const files = yield* discovery.listFiles(globs, exclude)
    // ...
  })
```

**FORBIDDEN patterns:**

```typescript
// ❌ FORBIDDEN - Don't redefine service interface
type FileDiscoveryService = Context.Tag.Service<FileDiscovery>

// ❌ FORBIDDEN - Don't use Schema for service interfaces
const FileDiscoveryService = Schema.Struct({
  listFiles: Schema.Function(/* ... */)
})
```

### 5. Module Imports (REQUIRED)

You MUST import from specific module paths, NOT barrel files:

```typescript
// ✅ REQUIRED - Import from specific modules
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Schema from "effect/Schema"

// ❌ FORBIDDEN - Barrel imports (hurts tree-shaking)
import { Console, Effect, pipe, Schema } from "effect"
```

**Enforcement:** `@effect/eslint-plugin` rule `no-import-from-barrel-package` will catch violations.

### 6. Concurrent Processing (REQUIRED)

You MUST use `Effect.forEach` with concurrency limits:

```typescript
import * as Effect from "effect/Effect"

// ✅ REQUIRED - Bounded concurrency for expensive operations
const processFiles = (files: string[]) =>
  Effect.forEach(
    files,
    (file) =>
      Effect.gen(function* () {
        const content = yield* readFile(file)
        return yield* analyzeContent(content)
      }),
    { concurrency: 4 } // REQUIRED: limit concurrent operations
  )

// ✅ ACCEPTABLE - Unbounded for cheap operations (with caution)
const listPaths = Effect.forEach(globs, matchGlob, {
  concurrency: "unbounded" // OK for file listing
})
```

**NEVER:**

```typescript
// ❌ NEVER - Sequential processing of large arrays
const results: Result[] = []
for (const item of items) {
  const result = yield* processItem(item)
  results.push(result)
}
```

### 7. Platform Services (REQUIRED)

You MUST provide `NodeContext.layer` for Node.js programs:

```typescript
import { FileSystem } from "@effect/platform"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const content = yield* fs.readFileString("./data.txt")
  return content
})

// ✅ REQUIRED - Provide NodeContext.layer
program.pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
```

---

## Development Workflow

### CLI Development (MANDATORY)

You MUST run the CLI from source during development:

```bash
# ✅ REQUIRED - Run from TypeScript source using tsx
pnpm cli --version
pnpm cli audit
pnpm cli thread list
```

**NEVER:**

```bash
# ❌ FORBIDDEN - Building to test changes
pnpm --filter @effect-migrate/cli build
node packages/cli/build/esm/index.js audit
```

### Pre-Commit Checklist (MANDATORY)

Before EVERY commit, you MUST verify:

- [ ] All new/changed code is Effect-first (no raw Promise, async/await)
- [ ] All dependencies provided via layers (NodeContext, service Live layers)
- [ ] No `console.log`, `console.error`, or `process.exit` calls
- [ ] Imports follow module-specific pattern (no barrel imports)
- [ ] CLI/preset imports ONLY from `@effect-migrate/core` public API
- [ ] Tests pass: `pnpm test`
- [ ] Linter passes: `pnpm lint`
- [ ] Type check passes: `pnpm typecheck`
- [ ] Conventional commit message format
- [ ] Changeset added (if public API or behavior changed)

### Build Commands

```bash
# Type check all packages
pnpm build:types
pnpm typecheck

# Build all packages (for release)
pnpm build

# Run all tests
pnpm test

# Lint and format
pnpm lint
pnpm format
```

---

## Testing Requirements

### MANDATORY Testing Practices

You MUST:

- Write tests for ALL new business logic
- Use `@effect/vitest` for Effect-based tests
- Test both success and error paths
- Run `pnpm test` before committing

### Test Patterns (REQUIRED)

**Effect tests:**

```typescript
import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"

// ✅ REQUIRED - Basic Effect test
it.effect("should process correctly", () =>
  Effect.gen(function* () {
    const result = yield* processData({ input: "test" })
    expect(result.output).toBe("processed: test")
  })
)

// ✅ REQUIRED - Test error handling
it.effect("should handle errors", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(riskyOperation())
    expect(Exit.isFailure(result)).toBe(true)
  })
)
```

**Layer tests:**

```typescript
import { layer } from "@effect/vitest"

// ✅ REQUIRED - Test with provided layer
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

**Mocking services:**

```typescript
import * as Layer from "effect/Layer"

// ✅ REQUIRED - Create mock for I/O-heavy services
const FileDiscoveryMock = Layer.succeed(FileDiscovery, {
  listFiles: (pattern) => Effect.succeed(["file1.ts", "file2.ts"]),
  readFile: (path) => Effect.succeed(`mock content of ${path}`)
})

it.effect("should use mock", () =>
  Effect.gen(function* () {
    const discovery = yield* FileDiscovery
    const files = yield* discovery.listFiles("*.ts")
    expect(files).toEqual(["file1.ts", "file2.ts"])
  }).pipe(Effect.provide(FileDiscoveryMock))
)
```

---

## Git Workflow Rules

### Commit Rules (MANDATORY)

You MUST follow Conventional Commits:

**Format:** `<type>(<scope>): <description>`

**Allowed types:**

- `feat` - New features
- `fix` - Bug fixes
- `chore` - Maintenance (deps, changesets, tooling)
- `refactor` - Code refactoring (no behavior change)
- `test` - Test additions/updates
- `docs` - Documentation changes
- `ci` - CI/CD changes

**Examples:**

```bash
# ✅ REQUIRED - Correct conventional commits
feat(core): add lazy file loading for large repositories
fix(cli): exit with code 1 when audit finds violations
chore: add changeset for cli JSON formatter
docs(preset-basic): document no-async-await rule
test(core): add tests for ImportIndex service
```

**Granularity (MANDATORY):**

- One logical change per commit
- Include tests and code together
- Commit changesets separately with `chore:` prefix

### Branch Naming (MANDATORY)

You MUST use this format: `<type>/<scope>-<description>`

**Examples:**

```bash
# ✅ REQUIRED - Correct branch names
feat/core-lazy-file-loading
fix/cli-exit-code-on-error
chore/deps-update-effect
test/core-file-discovery
refactor/cli-output-formatters
```

**NEVER:**

```bash
# ❌ FORBIDDEN - Vague or non-conforming branch names
feature-branch
bugfix
my-changes
```

### Changeset Workflow (MANDATORY)

You MUST add a changeset for:

- ✅ New features
- ✅ Bug fixes
- ✅ Breaking changes
- ✅ Public API changes

**Create changeset:**

```bash
pnpm changeset

# Interactive prompts:
# 1. Select affected packages
# 2. Choose bump type (major/minor/patch)
# 3. Write user-facing summary

# Commit changeset separately
git add .changeset/*.md
git commit -m "chore: add changeset for lazy file loading"
```

**Skip changeset for:**

- ❌ Internal refactors (no behavior change)
- ❌ Test-only changes
- ❌ Documentation updates
- ❌ Dev dependency updates

### Complete PR Workflow Example

```bash
# 1. Start from latest main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feat/cli-json-formatter

# 3. Implement feature (granular commits)
git add packages/cli/src/formatters/json.ts
git commit -m "feat(cli): add JSON output formatter"

git add packages/cli/src/__tests__/formatters/json.test.ts
git commit -m "test(cli): add tests for JSON formatter"

# 4. Create changeset
pnpm changeset
git add .changeset/*.md
git commit -m "chore: add changeset for cli JSON formatter"

# 5. Run pre-commit checks
pnpm build:types
pnpm typecheck
pnpm lint
pnpm test

# 6. Push branch
git push origin feat/cli-json-formatter

# 7. Open PR with proper title and description
```

---

## Package-Specific Requirements

### @effect-migrate/core

**See:** [packages/core/AGENTS.md](./packages/core/AGENTS.md) for detailed rules.

You MUST:

- Use `@effect/platform` abstractions (NOT Node.js APIs directly)
- Implement lazy file loading (never load all files upfront)
- Provide concurrency limits (default 4) for expensive operations
- Export service interfaces from their definition files
- Keep internal engines private (not exported from index.ts)

### @effect-migrate/cli

**See:** [packages/cli/AGENTS.md](./packages/cli/AGENTS.md) for detailed rules.

You MUST:

- Provide `NodeContext.layer` for ALL command execution paths
- Return numeric exit codes from handlers (NEVER `process.exit`)
- Use `Console` service (NEVER `console.log`)
- Support `--json` flag for machine-readable output
- Support `--amp-out` for Amp context generation
- Use `getPackageMeta` for version info (NEVER read package.json directly)

### @effect-migrate/preset-basic

You MUST:

- Use `makePatternRule` and `makeBoundaryRule` helpers from core
- Export presets with rules array and optional config defaults
- NEVER define services (presets only define rules)

---

## Reference

### TypeScript Configuration

All packages use strict TypeScript settings with `exactOptionalPropertyTypes`:

**Handling optional properties:**

```typescript
// ❌ FORBIDDEN - Violates exactOptionalPropertyTypes
const result: RuleResult = {
  id: "rule-1",
  message: "Issue",
  docsUrl: maybeUrl // string | undefined
}

// ✅ REQUIRED - Conditional inclusion
const result: RuleResult = {
  id: "rule-1",
  message: "Issue",
  ...(maybeUrl && { docsUrl: maybeUrl })
}

// ✅ ALSO ACCEPTABLE - Type guard approach
const result: RuleResult = {
  id: "rule-1",
  message: "Issue"
}
if (maybeUrl !== undefined) {
  result.docsUrl = maybeUrl
}
```

### Effect Patterns Cheat Sheet

**File Operations:**

```typescript
import { FileSystem } from "@effect/platform"

const fs = yield* FileSystem.FileSystem
const content = yield* fs.readFileString("file.txt")
yield* fs.writeFileString("output.txt", content)
const exists = yield* fs.exists("file.txt")
```

**Path Operations:**

```typescript
import { Path } from "@effect/platform"

const path = yield* Path.Path
const joined = path.join("src", "index.ts")
const absolute = path.resolve("./file.txt")
```

**Schema Validation:**

```typescript
import * as Schema from "effect/Schema"

const ConfigSchema = Schema.Struct({
  version: Schema.Number,
  paths: Schema.Struct({
    exclude: Schema.Array(Schema.String).pipe(
      Schema.withDefault(() => ["node_modules/**"])
    )
  })
})

const config = yield* Schema.decodeUnknown(ConfigSchema)(data)
```

### Resources

**Official Documentation:**

- **Effect Website:** https://effect.website
- **API Docs:** https://effect-ts.github.io/effect
- **Discord Community:** https://discord.gg/effect-ts

**Effect Packages:**

- `effect` - Core runtime and Schema
- `@effect/platform` - Cross-platform abstractions
- `@effect/platform-node` - Node.js implementations
- `@effect/cli` - CLI framework
- `@effect/vitest` - Testing utilities
- `@effect/eslint-plugin` - ESLint rules for Effect patterns

**Internal Documentation:**

- [packages/core/AGENTS.md](./packages/core/AGENTS.md) - Core package rules
- [packages/cli/AGENTS.md](./packages/cli/AGENTS.md) - CLI package rules
- [packages/preset-basic/AGENTS.md](./packages/preset-basic/AGENTS.md) - Preset package rules

---

**Last Updated:** 2025-11-08\
**Maintainer:** Ari Dyckovsky\
**See also:** [README](README.md)\
**License:** MIT
