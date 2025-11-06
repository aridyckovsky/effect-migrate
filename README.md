<div align="center">

# effect-migrate

**TypeScript migration toolkit for adopting Effect with Amp coding agents**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Effect](https://img.shields.io/badge/Effect-3.x-purple)](https://effect.website)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Quick Start](#quick-start) • [Documentation](#documentation) • [Packages](#packages) • [Contributing](#contributing)

</div>

---

> **Co-authored by humans and Amp**  
> This repo is developed collaboratively by the maintainers and Amp coding agents. We use shared threads and structured context to keep the agent aligned across sessions and contributors.

**Who is this for?**

- **Developers on this repo:** Build, test, and extend rules. See [AGENTS.md](./AGENTS.md) for project conventions.
- **Amp users migrating to Effect:** Use effect-migrate to generate `.amp` context, then drive refactors in Amp threads with `@` references and `read-thread`.
- **Other coding agents/tools:** Read `.amp/effect-migrate/index.json` (MCP-style) to ingest context programmatically.
- **Teams adopting Effect with Amp:** Treat effect-migrate as your migration "source of truth" and Amp as the refactoring co-pilot; track progress and threads.

---

> **⚠️ Early Stage Development**  
> This project is in active development. Core architecture is in place, but features are not yet fully implemented. Contributions and feedback welcome!

## What is effect-migrate?

**effect-migrate** helps teams migrate TypeScript codebases to [Effect-TS](https://effect.website) by detecting legacy patterns, enforcing boundaries, and writing a persistent migration "source of truth" to `.amp/effect-migrate/index.json`.

It's co-authored by the maintainers and [Amp](https://ampcode.com): the tool surfaces _what_ to change, and Amp (or other agents) performs refactors while carrying context forward across sessions and teammates.

### Key Features

- 🔍 **Pattern Detection** — Identify legacy async/await, Promise, and error handling patterns
- 🏗️ **Boundary Enforcement** — Maintain clean separation between Effect and legacy code
- 📊 **Migration Tracking** — Monitor progress with metrics and completion percentages
- 🤖 **Amp Context Generation** — Writes `index.json`, `audit.json`, `metrics.json` for agent ingestion
- 🔗 **Thread Continuity** — Track relevant Amp threads (`threads.json`) to resume work with `read-thread`
- 📎 **@-mentions First** — Reference `@.amp/effect-migrate/index.json` to load the whole context
- 🔧 **TypeScript SDK Friendly** — Drive programmatic workflows via Amp's TypeScript SDK
- 🔌 **Extensible Rules** — Create custom rules and share presets with your team
- ⚡ **Built with Effect** — Dogfoods Effect patterns: `Effect.gen`, Layers, Services, and Schema validation

---

## Why Use effect-migrate?

Effect migrations are iterative and cross-cutting. Without persistent context, coding agents start from scratch in every session:

**Traditional workflow (without effect-migrate):**

```
You: "We're migrating to Effect. Don't use async/await in migrated files."
Agent: [suggests async function]
You: "No, I said use Effect.gen instead"
Agent: [fixes it]
[Next session, next day...]
You: "Remember we're migrating to Effect..."
```

**With effect-migrate:**

```bash
$ effect-migrate audit --amp-out .amp/effect-migrate
```

```
You: Read @.amp/effect-migrate/index.json
Agent: [loads audit, metrics, threads via the index, proposes Effect-first refactors]
```

**Continuity across sessions:**

- Start a new thread: `Read @.amp/effect-migrate/index.json`
- Reference prior work: `read-thread https://ampcode.com/threads/T-... and then load @.amp/effect-migrate/index.json`

**The context captures:**

- Which files are migrated vs. legacy
- Active rules/boundaries and their docs
- Progress metrics and next steps
- Related threads to resume work

### Built with Amp, for Amp

We actively co-develop this tool with Amp and use it on this repo.

#### Real collaboration

- **Source of truth:** We run `effect-migrate audit/metrics` and commit `.amp/effect-migrate/index.json` (entry point), `audit.json`, `metrics.json`, `threads.json`. Amp reads `@.amp/effect-migrate/index.json` to align suggestions.
- **Threads we share:** We document work in Amp threads and reference them in `.amp/effect-migrate/threads.json`. Anyone can `read-thread` a prior session to pick up where it left off.
- **Concrete guidance:** [AGENTS.md](./AGENTS.md) encodes Effect-TS conventions (error typing, Layer composition, service design). Amp auto-loads this guidance and applies it during refactors.
- **Integration details:** See [docs/agents/concepts/amp-integration.md](./docs/agents/concepts/amp-integration.md) and example thread [T-38c593cf](https://ampcode.com/threads/T-38c593cf-0e0f-4570-ad73-dfc2c3b1d6c9)

#### Why Amp fits this workflow

- **Structured ingestion:** Amp honors `@` references; `index.json` provides a single resource index (MCP-style) that points to audit/metrics/threads.
- **Persistence and sharing:** `read-thread` + thread visibility means continuity across sessions, teammates, and time.
- **Programmatic control:** Amp's TypeScript SDK lets teams script "load context → propose plan → apply changes → regenerate artifacts."

**Honest note:** effect-migrate's pattern rules are conservative and may surface false positives; Amp's suggestions still require review. We prefer CLI regeneration over manually editing context files to avoid drift.

**The result:** Static analysis from the tool + high-quality refactors from Amp + shared context tying both together. Teams can extend rules and keep the agent aligned over weeks-long migrations without centralizing knowledge in a single prompt.

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
import type { Config } from "@effect-migrate/core"

export default {
  version: 1,
  // Load default Effect migration rules
  presets: ["@effect-migrate/preset-basic"],
  paths: {
    root: ".",
    include: ["src/**/*.ts", "src/**/*.tsx"],
    exclude: ["node_modules/**", "dist/**"]
  },
  // Optional: add custom rules that extend the preset
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
} satisfies Config
```

### Configuration with Presets

Presets provide ready-to-use rule collections. The `@effect-migrate/preset-basic` preset includes:

- **Pattern rules**: Detect async/await, Promise constructors, try/catch, barrel imports
- **Boundary rules**: Enforce @effect/platform usage, prevent Node.js built-in imports
- **Default excludes**: Automatically excludes node_modules, dist, build artifacts

**Preset behavior:**

- Preset rules are combined with your custom `patterns` and `boundaries`
- Preset config defaults (like `paths.exclude`) are merged with your config
- **Your config always wins** — you can override any preset defaults
- If a preset fails to load, the CLI logs a warning and continues with remaining presets

**Example with multiple presets:**

```typescript
export default {
  version: 1,
  presets: [
    "@effect-migrate/preset-basic",
    "@myteam/effect-rules" // Custom team preset
  ],
  paths: {
    exclude: ["vendor/**"] // Extends preset defaults
  }
} satisfies Config
```

See [@effect-migrate/preset-basic](./packages/preset-basic) for the complete list of included rules.

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
# Write to custom directory
pnpm effect-migrate audit --amp-out .amp/effect-migrate

# Or write to default .amp/ directory
pnpm effect-migrate audit --amp-out
```

This creates structured context files with schema versioning:

**`.amp/effect-migrate/index.json`** (entry point):
```json
{
  "schemaVersion": "0.1.0",
  "timestamp": "2025-01-03T10:00:00Z",
  "resources": {
    "audit": "./audit.json",
    "metrics": "./metrics.json",
    "threads": "./threads.json",
    "badges": "./badges.md"
  }
}
```

**`.amp/effect-migrate/audit.json`** (detailed findings):
```json
{
  "schemaVersion": "0.1.0",
  "revision": 1,
  "timestamp": "2025-01-03T10:00:00Z",
  "findings": [
    {
      "ruleId": "no-async-await",
      "severity": "warning",
      "file": "src/api/fetchUser.ts",
      "line": 23,
      "message": "Replace async/await with Effect.gen"
    }
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

## Troubleshooting

### Thread add fails with "Invalid URL"

Thread URLs must be valid Amp thread URLs matching the format `https://ampcode.com/threads/T-{uuid}`. Ensure your URL starts with `https://ampcode.com/threads/T-` followed by a valid UUID.

```bash
# ✅ Valid
pnpm effect-migrate thread add --url https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc

# ❌ Invalid
pnpm effect-migrate thread add --url ampcode.com/threads/T-abc123
```

### Thread add fails with "Thread URL cannot be empty"

The `--url` flag is required when adding threads. Provide a valid Amp thread URL.

```bash
pnpm effect-migrate thread add --url https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc
```

### Threads not showing in audit.json

Thread metadata is stored in `threads.json` and referenced in `audit.json`. Run `audit` after adding threads to regenerate context files:

```bash
pnpm effect-migrate thread add --url https://ampcode.com/threads/T-...
pnpm effect-migrate audit --amp-out .amp/effect-migrate
```

### Tags/scope not merging when re-adding thread

Adding the same thread URL multiple times replaces the existing entry. Tags and scope from the new command override previous values; they are not merged.

### 5. Use Context in Amp

In your Amp thread:

```
Read @.amp/effect-migrate/index.json
Optional: read-thread https://ampcode.com/threads/T-... to reuse prior analysis and decisions.

I'm migrating src/api/fetchUser.ts to Effect.
```

Amp will:

- Load the index.json (schema version 0.1.0) which references all context files
- Read audit.json (with revision tracking) and metrics.json
- Know which files are migrated vs. legacy
- Suggest Effect patterns based on active rules
- Track progress across audit revisions
- Cross-reference prior migration threads from threads.json

### 6. Programmatic Use (Amp TypeScript SDK)

```typescript
import { execute } from "@sourcegraph/amp-sdk"

async function proposeNextSteps(cwd: string) {
  const prompt = [
    "Load @.amp/effect-migrate/index.json",
    "The index references audit.json (with schemaVersion and revision), metrics.json, and threads.json",
    "Propose the 3 highest-impact modules to migrate next based on the current revision."
  ].join("\n")

  for await (const msg of execute({ prompt, options: { cwd, continue: false } })) {
    if (msg.type === "result") {
      console.log(msg.result)
      break
    }
  }
}
```

**Schema versioning benefits:**
- All context files include `schemaVersion: "0.1.0"` for compatibility tracking
- `audit.json` includes a `revision` number that increments on each run
- Amp can detect schema changes and handle migrations gracefully

See [Amp TypeScript SDK documentation](https://ampcode.com/docs/sdk) for more examples and options.

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
- **[Amp Integration Guide](./docs/agents/concepts/amp-integration.md)** — How `@` references, thread sharing, `read-thread`, and SDK flows work
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

## Not Just a Linter

effect-migrate is a **stateful migration orchestrator**, not a generic linter:

**What makes it different:**

- **Stateful migration orchestrator** — Tracks progress, findings, and decisions over time in `.amp/effect-migrate`
- **Boundary- and plan-aware** — Rules express architectural boundaries; metrics drive prioritization
- **Agent-native context** — `index.json`/`audit`/`metrics`/`threads` designed for `@` ingestion and `read-thread` continuity
- **Works with other agents** — The `index.json` is MCP-style JSON; any agent can consume it without Amp-specific APIs

**Linters remain complementary:** Keep your ESLint rules; use effect-migrate to coordinate the refactor and keep AI agents aligned across weeks.

**Inspiration:**

- **ESLint** — Pluggable rule system and severity levels
- **ts-migrate** — TypeScript migration automation
- **Production Experience** — Our own refactoring scripts from real Effect migrations

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
