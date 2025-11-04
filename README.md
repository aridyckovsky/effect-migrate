<div align="center">

# effect-migrate

**TypeScript migration toolkit for adopting Effect with Amp coding agents**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Effect](https://img.shields.io/badge/Effect-3.x-purple)](https://effect.website)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Quick Start](#quick-start) • [Documentation](#documentation) • [Packages](#packages) • [Contributing](#contributing)

</div>

---

> **⚠️ Early Stage Development**  
> This project is in active development. Core architecture is in place, but features are not yet fully implemented. Contributions and feedback welcome!

## What is effect-migrate?

**effect-migrate** helps teams migrate TypeScript codebases to [Effect-TS](https://effect.website) by detecting legacy patterns, enforcing architectural boundaries, and providing structured context for [Amp](https://ampcode.com) coding agents.

### Key Features

- 🔍 **Pattern Detection** — Identify legacy async/await, Promise, and error handling patterns
- 🏗️ **Boundary Enforcement** — Maintain clean separation between Effect and legacy code
- 📊 **Migration Tracking** — Monitor progress with metrics and completion percentages
- 🤖 **Amp Context Generation** — Generate structured context files that keep Amp informed across sessions
- 🔌 **Extensible Rules** — Create custom rules and share presets with your team
- ⚡ **Built with Effect** — Dogfoods Effect patterns: `Effect.gen`, Layers, Services, and Schema validation

---

## Why Use effect-migrate with Amp?

Migrating to Effect is powerful but challenging. When working with Amp, you typically need to re-explain your migration strategy in every new thread:

**Traditional workflow (without effect-migrate):**

```
You: "We're migrating to Effect. Don't use async/await in migrated files."
Amp: [suggests async function]
You: "No, I said use Effect.gen instead"
Amp: [fixes it]
[Next thread, next day...]
You: "Remember we're migrating to Effect..."
```

**With effect-migrate:**

```bash
$ effect-migrate audit --amp-out .amp/effect-migrate
```

```
You: @.amp/effect-migrate/context.json
Amp: [automatically understands migration state, suggests Effect patterns]
```

**effect-migrate** eliminates repetition by:

- ✅ Maintaining persistent migration context that Amp reads automatically
- ✅ Tracking which files are migrated vs. legacy
- ✅ Enforcing rules so Amp suggests the right patterns
- ✅ Providing an audit trail of migration work across Amp threads
- ✅ Sharing consistent context when teammates collaborate

---

## Packages

effect-migrate is a monorepo with three core packages:

| Package                                                     | Description                                                  | Status         |
| ----------------------------------------------------------- | ------------------------------------------------------------ | -------------- |
| **[@effect-migrate/core](./packages/core)**                 | Migration engine with services, rules, and schema validation | 🟡 In Progress |
| **[@effect-migrate/cli](./packages/cli)**                   | Command-line interface built with `@effect/cli`              | 🟡 In Progress |
| **[@effect-migrate/preset-basic](./packages/preset-basic)** | Default Effect migration rules                               | 🟡 In Progress |

Each package includes its own AGENTS.md file with detailed development guidance.

---

## Quick Start

### Installation

> **Note**: Not yet published to npm. Clone and build locally:

```bash
git clone https://github.com/aridyckovsky/effect-migrate.git
cd effect-migrate
pnpm install
pnpm build
```

### 1. Initialize Configuration

```bash
pnpm effect-migrate init
```

This creates `effect-migrate.config.ts` with type-safe configuration:

```typescript
import { defineConfig } from "@effect-migrate/core"

export default defineConfig({
  version: 1,
  paths: {
    root: ".",
    include: ["src/**/*.ts", "src/**/*.tsx"],
    exclude: ["node_modules/**", "dist/**"]
  },
  patterns: [
    {
      id: "no-async-await",
      pattern: "async\\s+function",
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

### 3. Generate Amp Context

```bash
pnpm effect-migrate audit --amp-out .amp/effect-migrate
```

This creates `.amp/effect-migrate/context.json`:

```json
{
  "version": 1,
  "timestamp": "2025-01-03T10:00:00Z",
  "projectPath": "/Users/you/project",
  "migrationState": {
    "phase": "pattern-detection",
    "completedModules": ["src/models/user.ts"],
    "pendingModules": ["src/api/fetchUser.ts"]
  },
  "findings": {
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
  ]
}
```

### 4. Track Migration Work in Amp Threads

Track Amp threads where migration work occurred:

```bash
pnpm effect-migrate thread add \
  --url https://ampcode.com/threads/T-abc123... \
  --tags "migration,api" \
  --scope "src/api/*" \
  --amp-out .amp/effect-migrate
```

List tracked threads:

```bash
pnpm effect-migrate thread list --amp-out .amp/effect-migrate
```

**Output:**

```
Tracked threads (2):

t-def45678-9012-cdef-3456-789012345678
  URL: https://ampcode.com/threads/T-def45678-9012-cdef-3456-789012345678
  Created: 2025-11-04T23:23:28.651Z
  Tags: core, refactor

t-abc12345-6789-abcd-ef01-234567890abc
  URL: https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc
  Created: 2025-11-04T23:23:26.865Z
  Tags: api, migration
  Scope: src/api/*
  Description: Migrated fetchUser to Effect
```

Thread references are automatically included in `audit.json` context for Amp.

### 5. Use Context in Amp

In your Amp thread:

```
I'm migrating src/api/fetchUser.ts to Effect.
Read @.amp/effect-migrate/audit.json for current state.
```

Amp will automatically:

- Know which files are migrated vs. legacy
- Suggest Effect patterns based on active rules
- Track progress and next steps
- Reference previous Amp threads where migration work occurred

---

## Commands

| Command                                                    | Description                            | Status         |
| ---------------------------------------------------------- | -------------------------------------- | -------------- |
| `effect-migrate init`                                      | Create config file                     | ⏳ In Progress |
| `effect-migrate audit`                                     | Detect migration issues                | 🧪 Dogfooding  |
| `effect-migrate metrics`                                   | Show migration progress                | ⏳ In Progress |
| `effect-migrate docs`                                      | Validate documentation quality         | ⏳ In Progress |
| `effect-migrate thread add --url <url> [--tags] [--scope]` | Track Amp thread for migration history | 🧪 Dogfooding  |
| `effect-migrate thread list [--json]`                      | Show migration-related threads         | 🧪 Dogfooding  |
| `effect-migrate --help`                                    | Show help                              | 👍 Working     |

---

## Rule System

Rules detect migration issues and can be shared as presets. See [@effect-migrate/preset-basic](./packages/preset-basic) for examples.

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

| Type       | Purpose                                 | Example                                      |
| ---------- | --------------------------------------- | -------------------------------------------- |
| `pattern`  | Detect code patterns via regex          | async/await, Promise constructors, try/catch |
| `boundary` | Enforce architectural constraints       | No node:\* imports in migrated code          |
| `docs`     | Validate documentation during migration | Required spec files, no leaked secrets       |
| `metrics`  | Track migration completion              | Files with @migration-status markers         |

---

## Real-World Example

For a complete walkthrough, see this [Amp thread demonstrating effect-migrate on a realistic project](https://ampcode.com/threads/T-2e877789-12a8-41af-ad0b-de1361897ea8).

The example shows:

- Setting up a **partially migrated codebase** (`team-dashboard`) with mixed legacy and Effect code
- Running **audit** to find 29 findings (3 errors, 26 warnings) across async/await, try/catch, and boundary violations
- Generating **Amp context** with `--amp-out .amp` for persistent migration state
- Using **metrics** to track 42% migration progress with badges

**Key commands from the example:**

```bash
# Standard audit
effect-migrate audit --config effect-migrate.config.json

# Generate Amp context
effect-migrate audit --config effect-migrate.config.json --amp-out .amp

# Track migration metrics
effect-migrate metrics --config effect-migrate.config.json --amp-out .amp
```

**Generated artifacts:**

- `audit.json` — Detailed findings per file
- `metrics.json` — Progress tracking (42% migrated, 29 findings)
- `badges.md` — Migration status badges for documentation
- `index.json` — MCP-compatible context index

---

## Documentation

- **[AGENTS.md](./AGENTS.md)** — Comprehensive guide for Amp coding agents
- **[Core Package](./packages/core)** — Migration engine architecture and services
- **[CLI Package](./packages/cli)** — Command-line interface and formatters
- **[Preset Package](./packages/preset-basic)** — Default migration rules

---

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

See [AGENTS.md](./AGENTS.md) for detailed development guidelines, Effect-TS best practices, and anti-patterns to avoid.

---

## Contributing

We welcome contributions! This project is in early stages, so now is a great time to:

- 🚀 Implement planned features
- 📋 Add migration rules to [@effect-migrate/preset-basic](./packages/preset-basic)
- 📝 Improve documentation
- 🧪 Test on real Effect migration projects
- 💡 Provide feedback on the rule API

Please see [AGENTS.md](./AGENTS.md) for comprehensive development guidelines.

---

## Inspiration

This tool builds on insights from:

- **ESLint** — Pluggable rule system and severity levels
- **ts-migrate** — TypeScript migration automation
- **Production Experience** — Our own refactoring scripts from real Effect migrations

Unlike generic linters, effect-migrate is:

- 🎯 **Effect-aware** — Understands Effect patterns and conventions
- 📈 **Migration-focused** — Tracks progress, not just violations
- 🤖 **Amp-native** — Built specifically for Amp coding agents (extensible to other AI agents in the future)

---

## License

MIT © 2025 [Ari Dyckovsky](https://github.com/aridyckovsky)

---

## Links

- [Effect Documentation](https://effect.website)
- [Effect Discord](https://discord.gg/effect-ts)
- [Amp](https://ampcode.com)
- [GitHub Issues](https://github.com/aridyckovsky/effect-migrate/issues)

---

<div align="center">

**Built with [Effect-TS](https://effect.website)**

[@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli) • [@effect/platform](https://github.com/Effect-TS/effect/tree/main/packages/platform) • [@effect/schema](https://github.com/Effect-TS/effect/tree/main/packages/schema)

</div>
