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

> **⚠️ Early Stage Development**  
> All existing commands are functional and in dogfooding (APIs may change) except the `docs` command, which is planned. Pin to specific versions if using, though not recommended for production yet!

---

## What is effect-migrate?

**effect-migrate** helps teams migrate TypeScript codebases to [Effect](https://effect.website) (aka Effect-TS) by detecting legacy patterns, enforcing architectural boundaries, and generating persistent migration context for AI coding agents.

It's co-authored by maintainers and [Amp](https://ampcode.com): the tool surfaces _what_ to change, and Amp (or other agents) performs refactors while carrying context forward across sessions and teammates.

### Key Features

- 🔍 **Pattern Detection** — Identify legacy `async`/`await`, `Promise`, and error handling patterns
- 🏗️ **Boundary Enforcement** — Maintain clean separation between Effect and legacy code
- 🤖 **Amp Context Generation** — Writes `index.json`, `audit.json`, `threads.json` for agent ingestion
- 🔗 **Thread Continuity** — Track relevant Amp threads with `thread add` to resume work with `read-thread`
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

- Which files have violations vs. are clean
- Active rules/boundaries and their documentation
- Related threads to resume work

### Built with Amp, for Amp

We actively co-develop this tool with Amp and use it on this repo.

- **Source of truth**: We run `effect-migrate audit` and commit `.amp/effect-migrate/*.json`. Amp reads `@.amp/effect-migrate/index.json` to align suggestions.
- **Shared threads**: We document work in Amp threads and reference them in `.amp/effect-migrate/threads.json`. Anyone can `read-thread` a prior session to pick up where it left off.
- **Concrete guidance**: [AGENTS.md](./AGENTS.md) encodes Effect patterns. Amp auto-loads this guidance and applies it during refactors.
- **Integration details**: See [docs/agents/concepts/amp-integration.md](./docs/agents/concepts/amp-integration.md)

**Honest note**: effect-migrate's pattern rules are conservative and may surface false positives; Amp's suggestions still require review. We prefer CLI regeneration over manually editing context files to avoid drift.

---

## Packages

This is a monorepo with three core packages:

| Package                                                 | Description                                                  | Status        |
| ------------------------------------------------------- | ------------------------------------------------------------ | ------------- |
| [@effect-migrate/core](./packages/core)                 | Migration engine with services, rules, and schema validation | 🧪 Dogfooding |
| [@effect-migrate/cli](./packages/cli)                   | Command-line interface built with `@effect/cli`              | 🧪 Dogfooding |
| [@effect-migrate/preset-basic](./packages/preset-basic) | Default Effect migration rules                               | 🧪 Dogfooding |

Each package includes its own README and detailed development guidance in [AGENTS.md](./AGENTS.md).

---

## Quick Start

### Installation

```bash
pnpm add -D @effect-migrate/cli
```

Or globally:

```bash
pnpm add -g @effect-migrate/cli
```

> **Note**: APIs are unstable and may change. Pin to specific versions in production.

### 1. Initialize Configuration

```bash
effect-migrate init
```

This creates `effect-migrate.config.ts` with type-safe configuration:

```typescript
import { defineConfig } from "@effect-migrate/core"

export default defineConfig({
  version: 1,

  // Load default Effect migration rules
  presets: ["@effect-migrate/preset-basic"],

  paths: {
    include: ["src/**/*.{ts,tsx}"],
    exclude: ["**/{node_modules,dist,build}/**"]
  },

  // Optional: add custom rules that extend the preset
  patterns: [
    {
      id: "no-async-await",
      pattern: "\\basync\\s+function",
      files: "**/*.ts",
      message: "Replace async/await with Effect.gen",
      severity: "warning",
      docsUrl: "https://effect.website/docs/essentials/effect-type"
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
effect-migrate audit
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
# Write context files to .amp/effect-migrate/
effect-migrate audit --amp-out .amp/effect-migrate
```

**Generated files:**

- `index.json` — Entry point referencing all context files
- `audit.json` — Detailed violations per file with rule documentation
- `threads.json` — Tracked Amp threads for migration history
- `metrics.json` — Metrics for the migration process

### 4. Track Migration Threads

```bash
# Add a thread where migration work happened
effect-migrate thread add \
  --url https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc \
  --tags "migration,services" \
  --scope "src/services/**"

# List tracked threads
effect-migrate thread list
```

### 5. Use Context in Amp

In your Amp thread:

```
Read @.amp/effect-migrate/index.json

I'm migrating src/api/fetchUser.ts to Effect.
```

Amp will:

- Load the index which references all context files
- Read audit.json with current violations and rules
- Know which files have issues vs. are clean
- Suggest Effect patterns based on active rules
- Cross-reference prior migration threads from threads.json

---

## Configuration with Presets

Presets provide ready-to-use rule collections. The `@effect-migrate/preset-basic` preset includes:

- **Pattern rules**: Detect `async`/`await`, Promise constructors, `try`/`catch`, barrel imports
- **Boundary rules**: Enforce `@effect/platform` usage, prevent Node.js built-in imports
- **Default excludes**: Automatically excludes `node_modules`, `dist`, build artifacts

**Preset behavior:**

- Preset rules combine with your custom `patterns` and `boundaries`
- Preset config defaults (like `paths.exclude`) are merged with your config
- **Your config always wins** — you can override any preset defaults
- If a preset fails to load, the CLI logs a warning and continues

See [@effect-migrate/preset-basic](./packages/preset-basic) for the complete list of rules.

---

## Commands

| Command                                 | Description             | Status         |
| --------------------------------------- | ----------------------- | -------------- |
| `effect-migrate init`                   | Create config file      | 🧪 Dogfooding  |
| `effect-migrate audit`                  | Detect migration issues | 🧪 Dogfooding  |
| `effect-migrate thread add --url <url>` | Track Amp thread        | 🧪 Dogfooding  |
| `effect-migrate thread list`            | Show migration threads  | 🧪 Dogfooding  |
| `effect-migrate metrics`                | Show migration progress | 🧪 Dogfooding  |
| `effect-migrate docs`                   | Validate documentation  | 📅 Not Started |
| `effect-migrate --help`                 | Show help               | ✅ Complete    |

For detailed command usage, options, and troubleshooting, see the [CLI package documentation](./packages/cli).

---

## Output Artifacts

When you run `audit --amp-out .amp/effect-migrate`, the following files are generated:

### `index.json`

Entry point for Amp and other agents. References all context files:

```json
{
  "schemaVersion": "0.2.0",
  "toolVersion": "0.3.0",
  "projectRoot": ".",
  "timestamp": "2025-11-08T00:12:58.610Z",
  "files": {
    "audit": "audit.json",
    "metrics": "metrics.json",
    "badges": "badges.md",
    "threads": "threads.json"
  }
}
```

### `audit.json`

Detailed findings with file paths, line numbers, and documentation (uses indices for efficiency and smaller memory footprint):

```json
{
  "schemaVersion": "0.2.0",
  "revision": 7,
  "toolVersion": "0.3.0",
  "projectRoot": ".",
  "timestamp": "2025-11-08T00:12:58.610Z",
  "findings": {
    "rules": [
      {
        "id": "no-async-await",
        "kind": "pattern",
        "severity": "error",
        "message": "Replace async/await with Effect.gen",
        "tags": ["async", "migration"]
      },
      {
        "id": "no-console-log",
        "kind": "pattern",
        "severity": "warning",
        "message": "Use Effect Console service instead of console.*",
        "tags": ["effect", "logging"]
      }
    ],
    "files": ["src/api/fetchUser.ts", "src/services/UserService.ts"],
    "results": [
      {
        "rule": 0,
        "file": 0,
        "range": [23, 1, 23, 30]
      },
      {
        "rule": 1,
        "file": 1,
        "range": [45, 5, 45, 20]
      }
    ]
  }
}
```

### `metrics.json`

Migration progress metrics:

```json
{
  "schemaVersion": "0.2.0",
  "revision": 7,
  "toolVersion": "0.3.0",
  "projectRoot": ".",
  "timestamp": "2025-11-08T00:12:58.651Z",
  "summary": {
    "totalViolations": 17,
    "errors": 0,
    "warnings": 17,
    "info": 0,
    "filesAffected": 13,
    "progressPercentage": 6
  },
  "ruleBreakdown": [
    {
      "id": "no-effect-catchall-success",
      "violations": 12,
      "severity": "warning",
      "filesAffected": 9
    }
  ]
}
```

### `threads.json`

Tracked Amp threads for context continuity:

```json
{
  "schemaVersion": "0.2.0",
  "toolVersion": "0.3.0",
  "threads": [
    {
      "id": "t-abc12345-6789-abcd-ef01-234567890abc",
      "url": "https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc",
      "createdAt": "2025-11-08T00:12:58.625Z",
      "auditRevision": 7,
      "tags": ["migration", "services"],
      "description": "Migrated user services to Effect patterns"
    }
  ]
}
```

---

## Programmatic Use (Amp TypeScript SDK)

```typescript
import { execute } from "@sourcegraph/amp-sdk"

async function proposeNextSteps(cwd: string) {
  const prompt = [
    "Load @.amp/effect-migrate/index.json",
    "The index references audit.json and threads.json",
    "Propose the 3 highest-impact files to migrate next."
  ].join("\n")

  for await (const msg of execute({ prompt, options: { cwd, continue: false } })) {
    if (msg.type === "result") {
      console.log(msg.result)
      break
    }
  }
}
```

See [Amp TypeScript SDK documentation](https://ampcode.com/docs/sdk) for more examples.

---

## Status and Roadmap

### Current Status

🧪 **Dogfooding** (functional but APIs may change):

- Config file creation with TypeScript validation
- Pattern-based rule detection (regex matching)
- Boundary rule enforcement (import checking)
- Audit command with console and JSON output
- Amp context generation (`index.json`, `audit.json`, `threads.json`)
- Thread tracking (`thread add`, `thread list`)
- Preset loading and rule merging
- Metrics command for migration progress tracking

📅 **Not Started:**

- Documentation rule validation (`docs` command)

### Roadmap

**Near-term:**

- [ ] Documentation validation (`docs` command)
- [ ] Expanded preset coverage (more pattern and boundary rules)
- [ ] Migration context checkpoints with compression and revision history
- [ ] Simple metrics monitoring/analytics for migration progress

**Medium-term:**

- [ ] SQLite persistence layer for checkpoint queryability and analytics
- [ ] Performance instrumentation with OpenTelemetry (audit runtime, memory usage)

**Wishlist:**

- [ ] Trend analysis and progress tracking (rolling windows, hot spots, burn-down charts)
- [ ] MCP server for programmatic query API
- [ ] Workflow orchestration for distributed audits
- [ ] VS Code extension for inline rule feedback
- [ ] Team dashboards and integration endpoints

See [comprehensive data architecture plan](./docs/agents/plans/comprehensive-data-architecture.md) for detailed technical roadmap.

We welcome contributions! See [Contributing](#contributing) below.

---

## Rule System

Rules detect migration issues and can be shared as presets. See [@effect-migrate/preset-basic](./packages/preset-basic) for examples.

```typescript
import { Effect } from "effect"
import type { Rule, RuleResult } from "@effect-migrate/core"

export const noConsoleLog: Rule = {
  id: "no-console-log",
  kind: "pattern",
  run: (ctx) =>
    Effect.gen(function* () {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        const pattern = /\bconsole\.(log|error|warn|info|debug)/g

        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const index = match.index
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          results.push({
            id: "no-console-log",
            ruleKind: "pattern",
            message: "Use Effect Console service instead of console.*",
            severity: "warning",
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            }
          })
        }
      }

      return results
    })
}
```

### Rule Types

| Type       | Purpose                              | Example                                              |
| ---------- | ------------------------------------ | ---------------------------------------------------- |
| `pattern`  | Detect code patterns via regex       | `async`/`await`, Promise constructors, `try`/`catch` |
| `boundary` | Enforce architectural constraints    | No `node:*` imports in migrated code                 |
| `docs`     | Validate documentation (planned)     | Required spec files, no leaked secrets               |
| `metrics`  | Track migration completion (planned) | Files with `@migration-status` markers               |

For detailed rule creation, see the [core package documentation](./packages/core).

---

## Real-World Example

For a complete walkthrough, see this [Amp thread demonstrating effect-migrate on a realistic project](https://ampcode.com/threads/T-2e877789-12a8-41af-ad0b-de1361897ea8).

The example shows:

- Setting up a partially migrated codebase with mixed legacy and Effect code
- Running audit to find violations across files
- Generating Amp context for persistent migration state
- Using thread tracking to maintain continuity

---

## Documentation

- **[AGENTS.md](./AGENTS.md)** — Comprehensive guide for AI coding agents (Effect patterns, service design, testing)
- **[Amp Integration Guide](./docs/agents/concepts/amp-integration.md)** — How `@` references, thread sharing, `read-thread`, and SDK flows work
- **[Core Package](./packages/core)** — Migration engine architecture and services
- **[CLI Package](./packages/cli)** — Command-line interface, options, and troubleshooting
- **[Preset Package](./packages/preset-basic)** — Default migration rules

---

## Local Development

Want to try effect-migrate before it's published? Clone and build locally:

```bash
git clone https://github.com/aridyckovsky/effect-migrate.git
cd effect-migrate
pnpm install
pnpm build
```

### Running CLI Locally

**During development** (no build needed):

```bash
# Run directly from source using tsx
pnpm cli --help
pnpm cli audit
pnpm cli thread list
pnpm cli --version
```

**Using built version**:

```bash
node packages/cli/build/esm/index.js --help
node packages/cli/build/esm/index.js audit
```

### Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run CLI from source (recommended for dev)
pnpm cli <command>

# Run tests
pnpm test

# Type check
pnpm typecheck

# Format
pnpm format

# Lint
pnpm lint
```

See [AGENTS.md](./AGENTS.md) for detailed development guidelines, Effect best practices, and anti-patterns to avoid.

---

## Contributing

We welcome contributions! This project is in early stages, so now is a great time to:

- 🚀 Implement planned features (`metrics`, `docs` commands)
- 📋 Add migration rules to [@effect-migrate/preset-basic](./packages/preset-basic)
- 📝 Improve documentation and examples
- 🧪 Test on real Effect migration projects
- 💡 Provide feedback on the rule API

**How to contribute:**

1. Read [AGENTS.md](./AGENTS.md) for development guidelines and Effect patterns
2. Check [open issues](https://github.com/aridyckovsky/effect-migrate/issues) for tasks
3. Submit PRs following our [contributing guidelines](./CONTRIBUTING.md)

We use Changesets for version management. After making changes, run `pnpm changeset` to create a changeset describing your changes.

---

## Not Just a Linter

effect-migrate is a **stateful migration orchestrator**, not a generic linter:

**What makes it different:**

- **Stateful migration tracking** — Tracks progress, findings, and decisions over time in `.amp/effect-migrate`
- **Boundary- and plan-aware** — Rules express architectural boundaries; context files drive prioritization
- **Agent-native** — `index.json`/`audit.json`/`threads.json` designed for `@` ingestion and `read-thread` continuity
- **Multi-agent compatible** — The context format is MCP-style JSON; any agent can consume it

**Complementary tools:**

- **ESLint** — Keep your ESLint rules for code quality
- **[@effect/language-service](https://effect.website/docs/guides/style/effect-language-service)** — Excellent for inline IDE feedback on Effect code patterns; effect-migrate adds migration-specific rules, progress tracking, and agent context
- **effect-migrate** — Coordinates refactors and keeps Amp coding agents aligned across weeks

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

**Built with [Effect](https://effect.website)**

[@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli) • [@effect/platform](https://github.com/Effect-TS/effect/tree/main/packages/platform) • [@effect/schema](https://github.com/Effect-TS/effect/tree/main/packages/schema)

</div>
