# effect-migrate

> **⚠️ Early Stage Development**  
> This project is in active development. Core architecture is in place, but features are not yet fully implemented. Contributions and feedback welcome!

A migration toolkit for TypeScript projects adopting [Effect-TS](https://effect.website), designed to help teams transition from traditional patterns (Promises, async/await, try/catch) to Effect's composable, type-safe approach.

## Why effect-migrate?

Migrating to Effect is powerful but challenging. effect-migrate provides:

- **Pattern Detection**: Identify legacy async/await, Promise, and error handling patterns that need migration
- **Architectural Boundaries**: Enforce clean separation between migrated Effect code and legacy code
- **Migration Tracking**: Monitor progress with metrics and completion percentages
- **AI Agent Context**: Generate structured, persistent context files that keep AI coding agents (Amp, Cursor, etc.) informed across sessions—eliminating repeated explanations
- **Extensible Rules**: Create custom migration rules and share presets with your team

## Architecture

effect-migrate is built as a monorepo with three core packages:

```
@effect-migrate/
├── core/           # Reusable migration engine
├── cli/            # Command-line interface
└── preset-basic/   # Default Effect migration rules
```

### Core Principles

1. **Effect-First**: Built entirely with Effect, using `Effect.gen`, Layers, and Services
2. **Schema-Driven**: Configuration validated with `effect/Schema` for type-safety
3. **Platform-Agnostic**: Uses `@effect/platform` abstractions for cross-platform compatibility
4. **Resource-Safe**: Lazy file loading and configurable concurrency to handle large codebases
5. **Composable**: Plugin architecture for custom rules and presets

## Installation

> **Note**: Not yet published to npm. Clone and build locally:

```bash
git clone https://github.com/aridyckovsky/effect-migrate.git
cd effect-migrate
pnpm install
pnpm build
```

## Quick Start

### 1. Initialize Configuration

```bash
pnpm effect-migrate init
```

This creates `effect-migrate.config.ts` with example rules:

```typescript
import { defineConfig } from "@effect-migrate/core"

export default defineConfig({
  version: 1,
  paths: {
    root: ".",
    include: ["src/**/*.ts", "src/**/*.tsx"],
    exclude: ["node_modules/**", "dist/**", ".next/**"]
  },
  patterns: [
    {
      id: "no-async-await",
      pattern: "async\\s+function",
      files: "**/*.ts",
      message: "Replace async/await with Effect.gen",
      severity: "warning",
      docsUrl: "https://effect.website/docs/guides/essentials/async"
    }
  ],
  boundaries: [
    {
      id: "no-node-in-services",
      from: "src/services/**/*.ts",
      disallow: ["node:*"],
      message: "Use @effect/platform instead of Node.js APIs",
      severity: "error"
    }
  ]
})
```

The `defineConfig` helper provides type-safety and validation via `effect/Schema`. Your config is loaded and validated at runtime, catching errors early.

### 2. Run Migration Audit

```bash
pnpm effect-migrate audit
```

**Output:**

```
🔍 Running migration audit...

Pattern Violations
══════════════════
❌ src/api/fetchUser.ts:23
   Replace async/await with Effect.gen (no-async-await)

Boundary Violations
═══════════════════
❌ src/services/FileService.ts:5
   Use @effect/platform instead of Node.js APIs (no-node-in-services)
   Import: node:fs/promises

Summary
═══════
Errors: 1
Warnings: 1
```

### 3. Track Migration Progress

```bash
pnpm effect-migrate metrics
```

## Amp Integration

effect-migrate is purpose-built to work with [Amp](https://ampcode.com), providing persistent migration context that survives across coding sessions. This eliminates the need to repeatedly explain "we're migrating to Effect" in every thread.

### Generate Context Files

Run audit with the `--amp-out` flag to generate structured context:

```bash
pnpm effect-migrate audit --amp-out .amp/effect-migrate
```

This creates `.amp/effect-migrate/context.json` with your migration state:

```json
{
  "version": 1,
  "timestamp": "2025-01-03T10:00:00Z",
  "projectPath": "/Users/you/project",
  "effectVersion": { "from": "2.x", "to": "3.x" },
  "migrationState": {
    "phase": "pattern-detection",
    "completedModules": ["src/models/user.ts"],
    "pendingModules": ["src/api/fetchUser.ts"],
    "breakingChanges": [
      {
        "file": "src/api/fetchUser.ts",
        "pattern": "async function",
        "replacement": "Effect.gen",
        "status": "pending"
      }
    ]
  },
  "findings": {
    "byFile": {
      "src/api/fetchUser.ts": [
        {
          "id": "no-async-await",
          "severity": "warning",
          "message": "Replace async/await with Effect.gen",
          "line": 23,
          "docsUrl": "https://effect.website/docs/guides/essentials/async"
        }
      ]
    },
    "summary": {
      "errors": 1,
      "warnings": 3,
      "totalFiles": 24,
      "migratedFiles": 16,
      "progress": 67
    }
  },
  "recommendations": [
    "Convert async/await functions to Effect.gen",
    "Replace node:fs imports with @effect/platform/FileSystem"
  ],
  "nextActions": [
    "Fix error in src/services/FileService.ts:5",
    "Review 3 remaining warnings",
    "Run 'effect-migrate metrics' to track progress"
  ]
}
```

**Using with Amp:**

Attach the context file to your Amp threads, or reference it in prompts:

```
I'm working on migrating this project to Effect. 
Read @.amp/effect-migrate/context.json for current migration state.
```

### Using Context with Amp

In your Amp threads, reference the context file:

```
I'm working on migrating this project to Effect. 
Read @.amp/effect-migrate/context.json for current migration state.
```

Amp will automatically understand:
- Which files are migrated vs. legacy
- What patterns to avoid (based on active rules)
- Migration progress and next steps
- Previous Amp threads where migration work happened

### Track Amp Thread History

effect-migrate helps you maintain a history of Amp threads where migration work happened:

```bash
# Add the current Amp thread to migration context
effect-migrate thread add https://ampcode.com/threads/T-abc123-4567 \
  --description "Migrated user model to Schema"

# List all threads related to this migration
effect-migrate thread list

# Output:
# Migration Threads:
# 1. [2025-01-15] Migrated user model to Schema
#    https://ampcode.com/threads/T-abc123-4567
#    Files: src/models/user.ts (3 changes)
# 
# 2. [2025-01-16] Fixed FileSystem boundary violations
#    https://ampcode.com/threads/T-def789-0123
#    Files: src/services/FileService.ts (5 changes)
```

The context file automatically includes thread references:

```json
{
  "version": 1,
  "migrationState": { /* ... */ },
  "threads": [
    {
      "url": "https://ampcode.com/threads/T-abc123-4567",
      "timestamp": "2025-01-15T14:30:00Z",
      "description": "Migrated user model to Schema",
      "filesChanged": ["src/models/user.ts"],
      "rulesResolved": ["no-async-await", "no-promise-constructor"]
    }
  ]
}
```

### Why This Matters

**Without effect-migrate context:**
- ❌ "We're migrating to Effect" (repeated every thread)
- ❌ "Don't use async/await in migrated files" (repeated every thread)
- ❌ Manual progress tracking in separate docs
- ❌ Amp suggests patterns you're actively migrating away from
- ❌ Lost context when sharing threads with teammates

**With effect-migrate context:**
- ✅ Amp reads migration state automatically from context file
- ✅ Knows which files are migrated vs. legacy
- ✅ Suggests Effect patterns in migrated code automatically
- ✅ Tracks progress with metrics and completion percentages
- ✅ Maintains audit trail of which Amp threads did which work
- ✅ Teammates opening shared threads see full migration context
- ✅ Consistent terminology across all threads (rule IDs, severity)

## Commands

| Command                           | Description                                | Status      |
| --------------------------------- | ------------------------------------------ | ----------- |
| `effect-migrate init`             | Create config file                         | 🚧 Planned  |
| `effect-migrate audit`            | Detect migration issues                    | 🚧 Building |
| `effect-migrate metrics`          | Show migration progress                    | 🚧 Planned  |
| `effect-migrate docs`             | Validate documentation quality             | 🚧 Planned  |
| `effect-migrate thread add <url>` | Track Amp thread for migration history     | 🚧 Planned  |
| `effect-migrate thread list`      | Show all threads related to migration      | 🚧 Planned  |
| `effect-migrate --help`           | Show help                                  | ✅ Working  |

## Package Status

### @effect-migrate/core

**Status**: 🟡 Core architecture complete, rule execution in progress

**Implemented:**
- ✅ Service layer (FileDiscovery, ImportIndex, RuleRunner)
- ✅ Schema validation for configs
- ✅ Rule interface and helpers
- ✅ Lazy file loading with caching
- 🚧 Pattern rule execution
- 🚧 Boundary rule execution

### @effect-migrate/cli

**Status**: 🟡 Command structure in place, integration in progress

**Implemented:**
- ✅ `@effect/cli` command structure
- ✅ Options and args parsing
- ✅ Console and JSON formatters
- 🚧 Audit command implementation
- 🚧 Amp context writer
- 📋 Metrics command
- 📋 Init command

### @effect-migrate/preset-basic

**Status**: 🟡 Preset structure defined, rules need implementation

**Planned Rules:**
- Pattern detection (async/await, Promise, try/catch)
- Boundary enforcement (no direct Node.js imports)
- Effect interop patterns (Effect.runPromise usage)

## Rule System

Rules detect migration issues and can be shared as presets:

```typescript
import { makePatternRule } from "@effect-migrate/core"

export const noAsyncAwait = makePatternRule({
  id: "no-async-await",
  files: ["**/*.ts", "**/*.tsx"],
  pattern: /async\s+(function|[\w]+\s*=>)/g,
  negativePattern: /@effect-migrate-ignore/,
  message: "Replace async/await with Effect.gen",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/essentials/async",
  tags: ["async", "migration-required"]
})
```

### Rule Types

| Type       | Purpose                                  | Example                                       |
| ---------- | ---------------------------------------- | --------------------------------------------- |
| `pattern`  | Detect code patterns via regex           | async/await, Promise constructors, try/catch  |
| `boundary` | Enforce architectural constraints        | No node:* imports in migrated code            |
| `docs`     | Validate documentation during migration  | Required spec files, no leaked secrets        |
| `metrics`  | Track migration completion               | Files with @migration-status markers          |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Contributing

We welcome contributions! This project is in early stages, so now is a great time to:

- Implement planned features
- Add migration rules to preset-basic
- Improve documentation
- Test on real Effect migration projects
- Provide feedback on the rule API

See [AGENTS.md](./AGENTS.md) for comprehensive development guidelines.

## Prior Art

This tool builds on insights from:

- **ESLint**: Pluggable rule system and severity levels
- **ts-migrate**: TypeScript migration automation
- Our own refactoring scripts used in production Effect migrations

Unlike generic linters, effect-migrate is:
- **Effect-aware**: Understands Effect patterns and conventions
- **Migration-focused**: Tracks progress, not just violations
- **AI-friendly**: Outputs structured context for coding assistants

## License

MIT © 2025 Ari Dyckovsky

## Links

- [Effect Documentation](https://effect.website)
- [Effect Discord](https://discord.gg/effect-ts)
- [GitHub Repository](https://github.com/aridyckovsky/effect-migrate)

---

**Status**: Early stage development - not ready for production use  
**Maintainer**: [@aridyckovsky](https://github.com/aridyckovsky)  
**Built with**: [Effect-TS](https://effect.website) • [@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli) • [@effect/platform](https://github.com/Effect-TS/effect/tree/main/packages/platform)
