# @effect-migrate/core

**Core migration engine for effect-migrate**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Effect](https://img.shields.io/badge/Effect-3.x-purple)](https://effect.website)
[![npm version](https://img.shields.io/npm/v/@effect-migrate/core.svg)](https://www.npmjs.com/package/@effect-migrate/core)

> **⚠️ Early Stage Development**  
> This package is in dogfooding status. Core architecture is experimental, and APIs may change. Pin to specific versions in production (if you choose to try it right now).

---

## Overview

`@effect-migrate/core` provides the reusable migration engine that powers effect-migrate. It's designed for building custom migration tools, rules, and presets for TypeScript projects adopting Effect.

**Key capabilities:**

- **Rule System** — Pattern rules (regex matching) and boundary rules (import restrictions)
- **Services** — FileDiscovery, ImportIndex, RuleRunner (using Effect Layers)
- **Schema Validation** — Config loading and validation with `@effect/schema`
- **Amp Context Generation** — Structured output for AI coding agents (index.json, audit.json, metrics.json, threads.json)
- **Preset Loading** — Dynamic preset imports with workspace-aware resolution
- **Resource Safety** — Lazy file loading, memory-efficient processing
- **Platform-Agnostic** — Uses `@effect/platform` abstractions (no direct Node.js APIs)

---

## Installation

```bash
pnpm add @effect-migrate/core
```

---

## What Lives Here

### Rule System

- `Rule` interface — Implement custom migration checks
- `makePatternRule()` — Create regex-based rules
- `makeBoundaryRule()` — Create import restriction rules
- `rulesFromConfig()` — Build rules from configuration
- `Preset` — Bundle rules with default configuration

### Services (Effect Layers)

- `FileDiscovery` — File system operations with lazy loading and caching
- `ImportIndex` — Build and query import graphs for boundary rules
- `RuleRunner` — Execute rules with context and dependency injection

### Configuration

- `Config` type — TypeScript type for migration configuration
- `defineConfig()` — Type-safe config builder
- `loadConfig()` — Load and validate config files with Schema
- Schema classes for validation (PatternRuleSchema, BoundaryRuleSchema, etc.)

### Amp Context Generation

- `writeAmpContext()` — Generate audit.json for AI agents
- `writeMetricsContext()` — Generate metrics.json for progress tracking
- `updateIndexWithThreads()` — Update index.json with thread references
- `addThread()` / `readThreads()` — Manage thread tracking
- Result normalization and key derivation for delta computation

### Domain Types

- `Rule`, `RuleResult`, `RuleContext`
- `Finding`, `Violation`, `Location`, `Range`
- `Severity` (`"error"` | `"warning"`)
- `Metric` — Migration progress metrics

---

## Usage

### Creating Custom Rules

#### Pattern Rule Example

Pattern rules search files using regex and report violations:

```typescript
import { makePatternRule } from "@effect-migrate/core"

export const noAsyncAwait = makePatternRule({
  id: "no-async-await",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /\basync\s+(function\s+\w+|(\([^)]*\)|[\w]+)\s*=>)/g,
  negativePattern: /@effect-migrate-ignore/,
  message: "Replace async/await with Effect.gen for composable async operations",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/creating-effects",
  tags: ["async", "migration-required"]
})
```

#### Boundary Rule Example

Boundary rules enforce architectural constraints via import checking:

```typescript
import { makeBoundaryRule } from "@effect-migrate/core"

export const noNodeInServices = makeBoundaryRule({
  id: "no-node-in-services",
  from: "src/services/**/*.ts",
  disallow: ["node:*"],
  message: "Use @effect/platform instead of Node.js APIs",
  severity: "error",
  docsUrl: "https://effect.website/docs/guides/platform/overview",
  tags: ["architecture", "platform"]
})
```

#### Custom Rule Implementation

For complex logic beyond pattern/boundary helpers:

```typescript
import type { Rule, RuleResult } from "@effect-migrate/core"
import * as Effect from "effect/Effect"

export const noMixedPromiseEffect: Rule = {
  id: "no-mixed-promise-effect",
  kind: "pattern",
  run: (ctx) =>
    Effect.gen(function* () {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)

        // Find Effect.gen blocks
        const genPattern = /Effect\.gen\(function\*\s*\(\)\s*\{/g
        let match: RegExpExecArray | null

        while ((match = genPattern.exec(content)) !== null) {
          // Check for Promise patterns inside Effect.gen
          const block = extractBlock(content, match.index)
          if (/\b(await|new Promise)|\.then\(/g.test(block)) {
            results.push({
              id: "no-mixed-promise-effect",
              ruleKind: "pattern",
              message: "Don't mix Promise and Effect. Use Effect.tryPromise() to wrap promises.",
              severity: "error",
              file,
              range: calculateRange(content, match.index)
            })
          }
        }
      }

      return results
    })
}
```

### Creating a Preset

A preset bundles related rules with optional config defaults:

```typescript
import type { Preset } from "@effect-migrate/core"
import { noAsyncAwait, noNewPromise, noTryCatch } from "./patterns.js"
import { noNodeInServices, noFsPromises } from "./boundaries.js"

export const myPreset: Preset = {
  rules: [noAsyncAwait, noNewPromise, noTryCatch, noNodeInServices, noFsPromises],
  defaults: {
    paths: {
      exclude: ["node_modules/**", "dist/**", "*.min.js"]
    },
    concurrency: 4,
    report: {
      failOn: ["error"]
    }
  }
}

export default myPreset
```

### Using Services Directly

The core provides Effect-based services for file discovery and import analysis:

```typescript
import { FileDiscovery, FileDiscoveryLive } from "@effect-migrate/core"
import { Effect } from "effect"
import { NodeContext, NodeRuntime } from "@effect/platform-node"

const program = Effect.gen(function* () {
  const discovery = yield* FileDiscovery

  // List files matching glob patterns
  const files = yield* discovery.listFiles(["src/**/*.ts"], ["node_modules/**", "dist/**"])

  // Read file content (cached)
  for (const file of files) {
    const content = yield* discovery.readFile(file)
    console.log(`${file}: ${content.length} bytes`)
  }

  return files
})

program.pipe(
  Effect.provide(FileDiscoveryLive),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

### Running Rules

```typescript
import { RuleRunner, RuleRunnerLayer } from "@effect-migrate/core"
import { Effect } from "effect"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import type { Config } from "@effect-migrate/core"
import { myRules } from "./rules.js"

const config: Config = {
  version: 1,
  paths: {
    exclude: ["node_modules/**"]
  }
}

const program = Effect.gen(function* () {
  const runner = yield* RuleRunner
  const results = yield* runner.runRules(myRules, config)

  console.log(`Found ${results.length} violations`)
  for (const result of results) {
    console.log(`${result.file}:${result.range?.start.line} - ${result.message}`)
  }

  return results
})

program.pipe(
  Effect.provide(RuleRunnerLayer),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

---

## Architecture

### Service Layer Pattern

All services follow Effect's Layer pattern for dependency injection:

```typescript
// 1. Define service interface
export interface FileDiscoveryService {
  readonly listFiles: (
    globs: ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>
  ) => Effect.Effect<string[], PlatformError>
  readonly readFile: (path: string) => Effect.Effect<string, PlatformError>
  readonly isTextFile: (path: string) => boolean
}

// 2. Create Context.Tag
export class FileDiscovery extends Context.Tag("FileDiscovery")<
  FileDiscovery,
  FileDiscoveryService
>() {}

// 3. Implement Live Layer
export const FileDiscoveryLive = Layer.effect(
  FileDiscovery,
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const cache = new Map<string, string>()

    return {
      listFiles: (globs, exclude) => /* implementation */,
      readFile: (path) => /* cached read */,
      isTextFile: (path) => /* check extension */
    }
  })
)
```

### Layer Composition

Services compose via `Layer.provide`:

```typescript
// RuleRunner depends on FileDiscovery and ImportIndex
export const RuleRunnerLayer = RuleRunnerLive.pipe(
  Layer.provide(ImportIndexLive),
  Layer.provide(FileDiscoveryLive)
)
```

### Module Organization

```
packages/core/src/
├── services/          # Public services (exported)
│   ├── FileDiscovery.ts
│   ├── ImportIndex.ts
│   └── RuleRunner.ts
├── rules/             # Rule types and helpers (exported)
│   ├── types.ts
│   ├── helpers.ts
│   └── builders.ts
├── schema/            # Config schema (exported types, internal validation)
│   ├── Config.ts
│   └── loader.ts
├── amp/               # Amp context generation (exported)
│   ├── context-writer.ts
│   ├── metrics-writer.ts
│   └── thread-manager.ts
├── presets/           # Preset loading (exported)
│   └── PresetLoader.ts
├── config/            # Config merging (exported)
│   └── merge.ts
├── utils/             # Internal utilities
│   ├── glob.ts
│   └── merge.ts
├── types.ts           # Core domain types (exported)
└── index.ts           # Public API
```

---

## Exported API

### Rule System

```typescript
// Types
import type { Rule, RuleResult, RuleContext, Preset } from "@effect-migrate/core"

// Helpers
import { makePatternRule, makeBoundaryRule, rulesFromConfig } from "@effect-migrate/core"
import type { MakePatternRuleInput, MakeBoundaryRuleInput } from "@effect-migrate/core"
```

### Services

```typescript
// Service tags and implementations
import { FileDiscovery, FileDiscoveryLive } from "@effect-migrate/core"
import { ImportIndex, ImportIndexLive, ImportParseError } from "@effect-migrate/core"
import { RuleRunner, RuleRunnerLive, RuleRunnerLayer } from "@effect-migrate/core"
import type { RuleRunnerService } from "@effect-migrate/core"
```

### Configuration

```typescript
// Types and helpers
import type { Config } from "@effect-migrate/core"
import { defineConfig, loadConfig, ConfigLoadError } from "@effect-migrate/core"

// Schema classes for validation
import {
  ConfigSchema,
  PatternRuleSchema,
  BoundaryRuleSchema,
  PathsSchema,
  MigrationSchema,
  MigrationGoalSchema,
  DocsGuardSchema,
  ProhibitedContentSchema,
  ReportSchema
} from "@effect-migrate/core"

// Config merging utilities
import { mergeConfig, deepMerge, isPlainObject } from "@effect-migrate/core"
```

### Amp Context Generation

```typescript
// Context writers
import { writeAmpContext, writeMetricsContext, updateIndexWithThreads } from "@effect-migrate/core"

// Result normalization
import {
  normalizeResults,
  expandResult,
  deriveResultKey,
  deriveResultKeys,
  rebuildGroups
} from "@effect-migrate/core"

// Thread management
import { addThread, readThreads } from "@effect-migrate/core"

// Constants
import { AMP_OUT_DEFAULT } from "@effect-migrate/core"
```

### Preset Loading

```typescript
// Service and errors
import { PresetLoader, PresetLoaderNpmLive, PresetLoadError } from "@effect-migrate/core"
import type {
  PresetLoaderService,
  LoadPresetsResult,
  Preset as PresetShape
} from "@effect-migrate/core"
```

### Domain Types

```typescript
// Core types
import type { Severity, Location, Range, Finding, Violation, Metric } from "@effect-migrate/core"

// Schema versioning
import { SCHEMA_VERSION } from "@effect-migrate/core"
import type { SchemaVersion } from "@effect-migrate/core"
```

---

## Key Principles

1. **Effect-First Architecture** — All business logic uses Effect, no raw Promises
2. **Type Safety** — Leverage Effect's type system for compile-time guarantees
3. **Resource Safety** — Use `Effect.acquireRelease` for proper cleanup
4. **Lazy Loading** — Never load all files into memory upfront
5. **Platform-Agnostic** — Use `@effect/platform` abstractions, not Node.js APIs
6. **Composability** — Build with Layers and dependency injection

---

## Performance Considerations

The core engine is designed for large codebases:

- **Lazy file loading** — Files are loaded on-demand and cached
- **Configurable concurrency** — Default 4 concurrent operations (configurable via `config.concurrency`)
- **Memory-efficient** — Never loads all file contents into memory at once
- **Incremental processing** — Supports chunked processing for very large datasets
- **Platform abstractions** — FileSystem and Path services from `@effect/platform`

---

## Development

For detailed development guidelines, see:

- [Root AGENTS.md](../../AGENTS.md) — Comprehensive guide for AI coding agents
  - Effect-TS best practices
  - Service and Layer patterns
  - Schema validation
  - Testing strategies
  - Anti-patterns to avoid

- [Core Package AGENTS.md](./AGENTS.md) — Package-specific guidance
  - Service implementation patterns
  - File processing strategies
  - Rule system internals
  - Public API design

### Testing

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Type check
pnpm typecheck

# Format
pnpm format

# Build
pnpm build
```

See [@effect-migrate/preset-basic](../preset-basic) for real-world rule examples.

---

## Complementary Tools

**effect-migrate complements other Effect development tools:**

- **[@effect/language-service](https://effect.website/docs/guides/style/effect-language-service)** — Provides inline IDE feedback on Effect code patterns with 75+ diagnostics, quickinfo, and refactors. effect-migrate adds migration-specific rules, progress tracking, and AI agent context generation.
- **[@effect/eslint-plugin](https://github.com/Effect-TS/eslint-plugin-effect)** — ESLint rules for Effect patterns (e.g., no barrel imports). Use alongside effect-migrate for comprehensive code quality.

**effect-migrate's unique value:**

- Stateful migration tracking with persistent context
- Boundary-aware architectural rules
- AI agent context generation (index.json, audit.json, threads.json)
- Migration progress metrics and trend analysis

---

## Requirements

- **TypeScript** — 5.x with `strict: true` and `exactOptionalPropertyTypes: true`
- **Effect** — 3.x (specifically `effect@^3.19.2`)
- **Node.js** — 22.x or later

---

## Links

- [Main Repository](https://github.com/aridyckovsky/effect-migrate)
- [CLI Package](../cli) — Command-line interface
- [Preset Package](../preset-basic) — Default migration rules
- [Effect Documentation](https://effect.website)
- [AGENTS.md](../../AGENTS.md) — Development guidelines and Effect patterns

---

## License

MIT © 2025 [Ari Dyckovsky](https://github.com/aridyckovsky)
