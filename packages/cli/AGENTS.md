# AGENTS.md - @effect-migrate/cli Package

**Last Updated:** 2025-11-03\
**For:** AI Coding Agents (Amp, Cursor, etc.)

This guide provides package-specific guidance for working on `@effect-migrate/cli`, the CLI interface for effect-migrate. **See [root AGENTS.md](../../AGENTS.md) for general Effect-TS patterns.**

---

## Table of Contents

- [Package Overview](#package-overview)
- [CLI Architecture](#cli-architecture)
- [Command Patterns](#command-patterns)
- [Options and Args](#options-and-args)
- [Error Handling](#error-handling)
- [Output Formatting](#output-formatting)
- [Amp Context Generation](#amp-context-generation)
- [Testing CLI Commands](#testing-cli-commands)
- [User Experience Best Practices](#user-experience-best-practices)
- [Anti-Patterns](#anti-patterns)
- [Troubleshooting](#troubleshooting)

---

## Package Overview

**@effect-migrate/cli** provides the command-line interface for effect-migrate. It consumes `@effect-migrate/core` services and exposes them through a user-friendly CLI.

### Key Responsibilities

- **Command Definitions**: Using `@effect/cli` framework
- **User Input Validation**: Options, Args, and flags
- **Output Formatting**: Console (pretty) and JSON formats
- **Error Presentation**: User-friendly error messages
- **Amp Context**: MCP-compatible output for AI agents
- **Exit Codes**: Proper process exit codes

### Directory Structure

```
packages/cli/
├── src/
│   ├── commands/          # Command implementations
│   │   ├── audit.ts       # Main audit command
│   │   ├── metrics.ts     # Metrics reporting
│   │   ├── docs.ts        # Docs guard checking
│   │   ├── init.ts        # Project initialization
│   │   └── thread.ts      # Thread tracking command (add/list) ✅
│   ├── formatters/        # Output formatters
│   │   ├── console.ts     # Pretty console output
│   │   └── json.ts        # JSON output
│   ├── amp/               # Amp context generation
│   │   ├── context-writer.ts  # Amp context file writer ✅
│   │   └── thread-manager.ts  # Thread tracking manager ✅
│   └── index.ts           # CLI entry point
└── test/                  # CLI integration tests
    ├── amp/
    │   └── thread-manager.test.ts  # Thread manager tests ✅
    └── commands/
        └── thread.test.ts          # Thread CLI tests ✅
```

---

## CLI Architecture

### Entry Point Pattern

```typescript
// src/index.ts
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { auditCommand } from "./commands/audit.js"
import { docsCommand } from "./commands/docs.js"
import { initCommand } from "./commands/init.js"
import { metricsCommand } from "./commands/metrics.js"

// Root command with subcommands
const rootCommand = Command.make("effect-migrate", {
  version: "0.1.0"
}).pipe(Command.withSubcommands([auditCommand, metricsCommand, docsCommand, initCommand]))

// Main program
const program = Command.run(rootCommand, {
  name: "effect-migrate",
  version: "0.1.0"
})

// Execute with NodeContext
program.pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
```

### Layer Provision Pattern

**ALWAYS provide NodeContext.layer for Node.js platform services:**

```typescript
import { RuleRunnerLive } from "@effect-migrate/core"
import { NodeContext, NodeFileSystem, NodeRuntime } from "@effect/platform-node"

const command = Command.make("audit", options, handler).pipe(
  // Handler runs with NodeContext
  Effect.provide(RuleRunnerLive), // Core services
  Effect.provide(NodeFileSystem.layer), // If not using NodeContext
  Effect.provide(NodeContext.layer) // All Node.js platform services
)
```

---

## Command Patterns

### Basic Command Structure

```typescript
import { Args, Command, Options } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

export const auditCommand = Command.make(
  "audit",
  {
    // Options (flags with values)
    config: Options.text("config").pipe(
      Options.withAlias("c"),
      Options.withDefault("effect-migrate.config.json")
    ),
    json: Options.boolean("json").pipe(Options.withDefault(false)),
    strict: Options.boolean("strict").pipe(Options.withDefault(false)),
    ampOut: Options.text("amp-out").pipe(Options.optional)
  },
  // Handler receives parsed options
  ({ config: configPath, json, strict, ampOut }) =>
    Effect.gen(function* () {
      // Command implementation
      yield* Console.log("Running audit...")

      // Return exit code
      return 0
    })
)
```

### Command with Args and Options

```typescript
import { Args, Command, Options } from "@effect/cli"

export const metricsCommand = Command.make(
  "metrics",
  {
    // Options (flags)
    config: Options.text("config").pipe(Options.withDefault("effect-migrate.config.json")),
    format: Options.choice("format", ["table", "json", "csv"]).pipe(Options.withDefault("table"))
  },
  // Args (positional parameters)
  Args.text({ name: "migration-id" }).pipe(Args.optional),
  // Handler receives options and args
  (options, migrationId) =>
    Effect.gen(function* () {
      if (migrationId) {
        yield* Console.log(`Metrics for migration: ${migrationId}`)
      } else {
        yield* Console.log("Metrics for all migrations")
      }

      return 0
    })
)
```

### Command with Multiple Args

```typescript
export const initCommand = Command.make(
  "init",
  {},
  Args.tuple(
    Args.text({ name: "preset" }).pipe(Args.withDefault("basic")),
    Args.text({ name: "output" }).pipe(Args.withDefault("effect-migrate.config.json"))
  ),
  (options, [preset, output]) =>
    Effect.gen(function* () {
      yield* Console.log(`Initializing with preset: ${preset}`)
      yield* Console.log(`Writing to: ${output}`)

      return 0
    })
)
```

### Thread Command with Subcommands

The `thread` command tracks Amp thread URLs where migration work occurred.

```typescript
import { Command } from "@effect/cli"

// ADD subcommand
const threadAddCommand = Command.make(
  "add",
  {
    url: Options.text("url").pipe(
      Options.withDescription("Thread URL (https://ampcode.com/threads/T-{uuid})")
    ),
    tags: Options.text("tags").pipe(
      Options.optional,
      Options.withDescription("Comma-separated tags (e.g., migration,api)")
    ),
    scope: Options.text("scope").pipe(
      Options.optional,
      Options.withDescription("Comma-separated file globs/paths (e.g., src/api/*)")
    ),
    description: Options.text("description").pipe(
      Options.optional,
      Options.withDescription("Optional description of thread context")
    ),
    ampOut: ampOutOption()
  },
  ({ url, tags, scope, description, ampOut }) =>
    Effect.gen(function* () {
      const result = yield* addThread(ampOut, { url, tags, scope, description })

      if (result.added) {
        yield* Console.log(`✓ Added thread ${result.current.id}`)
      } else if (result.merged) {
        yield* Console.log(`✓ Updated thread ${result.current.id}: merged tags/scope`)
      }

      return 0
    })
)

// LIST subcommand
const threadListCommand = Command.make(
  "list",
  {
    json: Options.boolean("json").pipe(
      Options.withDefault(false),
      Options.withDescription("Output as JSON")
    ),
    ampOut: ampOutOption()
  },
  ({ json, ampOut }) =>
    Effect.gen(function* () {
      const threadsFile = yield* readThreads(ampOut)

      if (json) {
        yield* Console.log(JSON.stringify(threadsFile, null, 2))
      } else {
        // Human-readable format
        for (const thread of threadsFile.threads) {
          yield* Console.log(`${thread.id}`)
          yield* Console.log(`  URL: ${thread.url}`)
          if (thread.tags) {
            yield* Console.log(`  Tags: ${thread.tags.join(", ")}`)
          }
        }
      }

      return 0
    })
)

// Main thread command with subcommands
export const threadCommand = Command.make("thread", {}, () =>
  Effect.gen(function* () {
    yield* Console.log("Use 'thread add' or 'thread list'")
    return 0
  })
).pipe(Command.withSubcommands([threadAddCommand, threadListCommand]))
```

**Key Features:**

- **URL Validation**: Validates Amp thread URLs (case-insensitive, normalizes IDs to lowercase)
- **Tag/Scope Merging**: Adding duplicate threads merges tags and scope using set union
- **Timestamp Preservation**: Original `createdAt` timestamp preserved on merge
- **Sorted Output**: Threads sorted by `createdAt` descending (newest first)
- **Integration**: Thread references included in `audit.json` when present

**Usage:**

```bash
# Add thread with tags
effect-migrate thread add \
  --url https://ampcode.com/threads/T-abc123... \
  --tags "migration,api" \
  --scope "src/api/*"

# List tracked threads
effect-migrate thread list

# List as JSON
effect-migrate thread list --json
```

---

## Options and Args

### Options Patterns

**@effect/cli provides type-safe option builders:**

```typescript
import { Options } from "@effect/cli"

// Text option with alias and default
const configOption = Options.text("config").pipe(
  Options.withAlias("c"),
  Options.withDefault("config.json"),
  Options.withDescription("Path to configuration file")
)

// Boolean flag
const jsonFlag = Options.boolean("json").pipe(
  Options.withDefault(false),
  Options.withDescription("Output as JSON")
)

// Choice (enum)
const formatOption = Options.choice("format", ["table", "json", "csv"]).pipe(
  Options.withDefault("table")
)

// Integer option with validation
const concurrencyOption = Options.integer("concurrency").pipe(
  Options.withDefault(4),
  Options.withDescription("Number of concurrent operations (1-16)")
)

// Optional text option
const ampOutOption = Options.text("amp-out").pipe(
  Options.optional,
  Options.withDescription("Path to write Amp context file")
)

// Repeated option (array)
const tagsOption = Options.text("tag").pipe(
  Options.repeated,
  Options.withDescription("Filter by tag (can be repeated)")
)
```

### Args Patterns

**Args are positional parameters:**

```typescript
import { Args } from "@effect/cli"

// Required text arg
const fileArg = Args.text({ name: "file" })

// Optional arg
const optionalArg = Args.text({ name: "migration-id" }).pipe(Args.optional)

// Arg with default
const presetArg = Args.text({ name: "preset" }).pipe(Args.withDefault("basic"))

// Multiple args as tuple
const multipleArgs = Args.tuple(Args.text({ name: "source" }), Args.text({ name: "destination" }))

// Variadic args (rest parameters)
const filesArgs = Args.text({ name: "files" }).pipe(Args.repeated)
```

### Validation in Options

```typescript
// Custom validation with Effect
const portOption = Options.integer("port").pipe(
  Options.withDefault(3000),
  Options.mapEffect((port) =>
    port >= 1 && port <= 65535
      ? Effect.succeed(port)
      : Effect.fail("Port must be between 1 and 65535")
  )
)

// Transform option value
const pathOption = Options.text("path").pipe(
  Options.map((path) => path.replace(/^~/, process.env.HOME ?? ""))
)
```

---

## Error Handling

### Exit Codes

**Always return proper exit codes:**

```typescript
const auditCommand = Command.make("audit", options, (opts) =>
  Effect.gen(function* () {
    try {
      const results = yield* runAudit(opts)

      const hasErrors = results.some((r) => r.severity === "error")

      if (hasErrors) {
        yield* Console.error("❌ Audit failed with errors")
        return 1 // Non-zero exit code
      }

      yield* Console.log("✓ Audit passed")
      return 0 // Success
    } catch (error) {
      yield* Console.error(`Fatal error: ${error}`)
      return 1
    }
  })
)
```

### Error Presentation

**Make errors user-friendly:**

```typescript
import { Data } from "effect"

class ConfigLoadError extends Data.TaggedError("ConfigLoadError")<{
  readonly path: string
  readonly reason: string
}> {}

// In command handler
const config =
  yield *
  loadConfig(configPath).pipe(
    Effect.catchTag("ConfigLoadError", (error) =>
      Effect.gen(function* () {
        yield* Console.error(`❌ Failed to load config from ${error.path}`)
        yield* Console.error(`   ${error.reason}`)
        yield* Console.error(`\nTry running: effect-migrate init`)
        return yield* Effect.fail(error)
      })
    ),
    Effect.catchTag("ConfigValidationError", (error) =>
      Effect.gen(function* () {
        yield* Console.error(`❌ Config validation failed:`)
        yield* Console.error(error.errors)
        return yield* Effect.fail(error)
      })
    )
  )
```

### Catchall Pattern

**Handle unexpected errors gracefully:**

```typescript
const command = Command.make("audit", options, handler).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      // Unknown error - give helpful message
      yield* Console.error(`❌ Unexpected error: ${error}`)

      if (error instanceof Error && error.stack) {
        yield* Console.error(`\nStack trace:`)
        yield* Console.error(error.stack)
      }

      yield* Console.error(`\nPlease report this at: https://github.com/effect-migrate/issues`)

      return 1
    })
  )
)
```

---

## Output Formatting

### Console Formatter

**Pretty console output for humans:**

```typescript
// src/formatters/console.ts
import type { RuleResult } from "@effect-migrate/core"
import type { Config } from "@effect-migrate/core"
import * as chalk from "chalk"

export function formatConsoleOutput(results: RuleResult[], config: Config): string {
  if (results.length === 0) {
    return chalk.green("✓ No issues found")
  }

  const errors = results.filter((r) => r.severity === "error")
  const warnings = results.filter((r) => r.severity === "warning")

  const lines: string[] = []

  // Summary header
  lines.push("")
  lines.push(chalk.bold("Migration Audit Results"))
  lines.push("")

  // Group by file
  const byFile = new Map<string, RuleResult[]>()
  for (const result of results) {
    if (!result.file) continue
    const existing = byFile.get(result.file) ?? []
    existing.push(result)
    byFile.set(result.file, existing)
  }

  // Format each file
  for (const [file, fileResults] of byFile.entries()) {
    lines.push(chalk.underline(file))

    for (const result of fileResults) {
      const icon = result.severity === "error" ? chalk.red("✖") : chalk.yellow("⚠")
      const location = result.range ? `${result.range.start.line}:${result.range.start.column}` : ""

      lines.push(
        `  ${icon} ${chalk.gray(location)} ${result.message} ${chalk.gray(`(${result.id})`)}`
      )

      if (result.docsUrl) {
        lines.push(`    ${chalk.blue(result.docsUrl)}`)
      }
    }

    lines.push("")
  }

  // Summary footer
  lines.push(chalk.bold("Summary:"))
  lines.push(`  ${chalk.red(errors.length)} errors`)
  lines.push(`  ${chalk.yellow(warnings.length)} warnings`)
  lines.push("")

  return lines.join("\n")
}
```

### JSON Formatter

**Machine-readable output for tools:**

```typescript
// src/formatters/json.ts
import type { RuleResult } from "@effect-migrate/core"
import type { Config } from "@effect-migrate/core"

export interface JsonOutput {
  version: string
  timestamp: string
  summary: {
    total: number
    errors: number
    warnings: number
  }
  results: RuleResult[]
  config: {
    concurrency: number
    failOn: string[]
  }
}

export function formatJsonOutput(results: RuleResult[], config: Config): JsonOutput {
  return {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      errors: results.filter((r) => r.severity === "error").length,
      warnings: results.filter((r) => r.severity === "warning").length
    },
    results: results,
    config: {
      concurrency: config.concurrency ?? 4,
      failOn: config.report?.failOn ?? ["error"]
    }
  }
}
```

### Format Selection Pattern

```typescript
const auditCommand = Command.make(
  "audit",
  {
    json: Options.boolean("json").pipe(Options.withDefault(false))
    // ...other options
  },
  ({ json, ...opts }) =>
    Effect.gen(function* () {
      const results = yield* runAudit(opts)

      // Format based on flag
      if (json) {
        const output = formatJsonOutput(results, config)
        yield* Console.log(JSON.stringify(output, null, 2))
      } else {
        const output = formatConsoleOutput(results, config)
        yield* Console.log(output)
      }

      return results.some((r) => r.severity === "error") ? 1 : 0
    })
)
```

---

## Amp Context Generation

### MCP-Compatible Output

**Write context for AI agents (Amp, Cursor, etc.):**

```typescript
// src/amp/context-writer.ts
import type { RuleResult } from "@effect-migrate/core"
import type { Config } from "@effect-migrate/core"
import { FileSystem } from "@effect/platform"
import { Effect } from "effect"

export interface AmpContext {
  migration: {
    summary: {
      total: number
      errors: number
      warnings: number
      filesCovered: number
    }
    rules: Array<{
      id: string
      kind: string
      violations: number
      severity: string
    }>
    violations: Array<{
      file: string
      line: number
      column: number
      rule: string
      message: string
      severity: string
      docsUrl?: string
    }>
  }
  recommendations: string[]
  nextSteps: string[]
}

export function generateAmpContext(results: RuleResult[], config: Config): AmpContext {
  const files = new Set(results.map((r) => r.file).filter(Boolean))

  // Group by rule
  const ruleViolations = new Map<string, RuleResult[]>()
  for (const result of results) {
    const existing = ruleViolations.get(result.id) ?? []
    existing.push(result)
    ruleViolations.set(result.id, existing)
  }

  return {
    migration: {
      summary: {
        total: results.length,
        errors: results.filter((r) => r.severity === "error").length,
        warnings: results.filter((r) => r.severity === "warning").length,
        filesCovered: files.size
      },
      rules: Array.from(ruleViolations.entries()).map(([id, violations]) => ({
        id,
        kind: violations[0].ruleKind,
        violations: violations.length,
        severity: violations[0].severity
      })),
      violations: results.map((r) => ({
        file: r.file ?? "unknown",
        line: r.range?.start.line ?? 0,
        column: r.range?.start.column ?? 0,
        rule: r.id,
        message: r.message,
        severity: r.severity,
        ...(r.docsUrl && { docsUrl: r.docsUrl })
      }))
    },
    recommendations: generateRecommendations(results),
    nextSteps: generateNextSteps(results, config)
  }
}

export const writeAmpContext = (
  path: string,
  results: RuleResult[],
  config: Config
): Effect.Effect<void, any> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const context = generateAmpContext(results, config)
    const content = JSON.stringify(context, null, 2)

    yield* fs.writeFileString(path, content)
  })

function generateRecommendations(results: RuleResult[]): string[] {
  const recs: string[] = []

  const hasAsyncAwait = results.some((r) => r.id.includes("async-await"))
  if (hasAsyncAwait) {
    recs.push("Convert async/await functions to Effect.gen")
  }

  const hasPromise = results.some((r) => r.id.includes("promise"))
  if (hasPromise) {
    recs.push("Replace Promise with Effect")
  }

  return recs
}

function generateNextSteps(results: RuleResult[], config: Config): string[] {
  const steps: string[] = []

  if (results.length === 0) {
    steps.push("Migration complete! All rules passing.")
    return steps
  }

  const errors = results.filter((r) => r.severity === "error")
  if (errors.length > 0) {
    steps.push(`Fix ${errors.length} error(s) before proceeding`)
  }

  steps.push("Run 'effect-migrate metrics' to track progress")

  return steps
}
```

### Usage in Command

```typescript
const auditCommand = Command.make(
  "audit",
  {
    ampOut: Options.text("amp-out").pipe(Options.optional)
  },
  ({ ampOut, ...opts }) =>
    Effect.gen(function* () {
      const results = yield* runAudit(opts)

      // Write Amp context if requested
      if (ampOut) {
        yield* writeAmpContext(ampOut, results, config)
        yield* Console.log(`✓ Wrote Amp context to ${ampOut}`)
      }

      return 0
    })
)
```

---

## Testing CLI Commands

### Integration Tests

```typescript
import { Command } from "@effect/cli"
import { expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { auditCommand } from "../src/commands/audit.js"

it.effect("audit command should run with default config", () =>
  Effect.gen(function* () {
    // Mock config file
    const fs = yield* FileSystem.FileSystem
    yield* fs.writeFileString(
      "test-config.json",
      JSON.stringify({
        version: 1,
        paths: { exclude: ["node_modules/**"] },
        patterns: []
      })
    )

    // Run command
    const exitCode = yield* Command.run(auditCommand, {
      name: "effect-migrate",
      version: "0.1.0",
      args: ["--config", "test-config.json"]
    })

    expect(exitCode).toBe(0)
  })
)
```

### Mocking FileSystem

```typescript
import { FileSystem } from "@effect/platform"
import { Layer } from "effect"

const MockFileSystem = Layer.succeed(FileSystem.FileSystem, {
  readFileString: (path) => Effect.succeed(JSON.stringify({ version: 1 })),
  writeFileString: (path, content) => Effect.void
  // ...other methods
})

it.effect("should handle missing config", () =>
  Effect.gen(function* () {
    // Test with mock
  }).pipe(Effect.provide(MockFileSystem))
)
```

---

## User Experience Best Practices

### Progress Indicators

```typescript
import { Console } from "effect"

const auditCommand = Command.make("audit", options, (opts) =>
  Effect.gen(function* () {
    yield* Console.log("🔍 Loading configuration...")
    const config = yield* loadConfig(opts.config)

    yield* Console.log("📂 Discovering files...")
    const files = yield* discovery.listFiles(globs, exclude)
    yield* Console.log(`   Found ${files.length} files`)

    yield* Console.log("🔬 Running rules...")
    const results = yield* runner.runRules(rules, config)

    yield* Console.log("✓ Audit complete")
    return 0
  })
)
```

### Helpful Error Messages

```typescript
// ❌ BAD
yield * Console.error("Error: ENOENT")

// ✅ GOOD
yield * Console.error("❌ Config file not found: effect-migrate.config.json")
yield * Console.error("")
yield * Console.error("To create a new config file, run:")
yield * Console.error("  effect-migrate init")
```

### Colors and Icons

```typescript
import * as chalk from "chalk"

yield * Console.log(chalk.green("✓ Audit passed"))
yield * Console.error(chalk.red("❌ Audit failed"))
yield * Console.log(chalk.yellow("⚠ 3 warnings"))
yield * Console.log(chalk.blue("ℹ Tip: Use --json for machine-readable output"))
```

---

## Anti-Patterns

### ❌ Don't: Use process.exit() Directly

```typescript
// ❌ BAD - Bypasses Effect cleanup
if (error) {
  console.error("Error!")
  process.exit(1)
}

// ✅ GOOD - Return exit code
const command = Command.make("audit", options, (opts) =>
  Effect.gen(function* () {
    if (hasErrors) {
      return 1
    }
    return 0
  })
)
```

### ❌ Don't: Use console.log in Commands

```typescript
// ❌ BAD - Not testable, breaks Effect context
console.log("Running audit...")

// ✅ GOOD - Use Console service
yield * Console.log("Running audit...")
```

### ❌ Don't: Forget NodeContext.layer

```typescript
// ❌ BAD - Missing platform dependencies
program.pipe(NodeRuntime.runMain)

// ✅ GOOD - Provide NodeContext
program.pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
```

### ❌ Don't: Mutate Options

```typescript
// ❌ BAD
const handler = (opts) => {
  opts.config = opts.config || "default.json" // Mutation!
}

// ✅ GOOD - Use withDefault
const configOption = Options.text("config").pipe(Options.withDefault("default.json"))
```

### ❌ Don't: Swallow Errors Silently

```typescript
// ❌ BAD
const results = yield * runAudit(opts).pipe(Effect.catchAll(() => Effect.succeed([])))

// ✅ GOOD - Log and re-throw
const results =
  yield *
  runAudit(opts).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Console.error(`Audit failed: ${error}`)
        return yield* Effect.fail(error)
      })
    )
  )
```

---

## Troubleshooting

### Command Not Found

**Problem:** Running `effect-migrate` gives "command not found"

**Solutions:**

1. Check package.json bin field:

   ```json
   {
     "bin": {
       "effect-migrate": "./dist/index.js"
     }
   }
   ```

2. Ensure shebang in index.ts:

   ```typescript
   #!/usr/bin/env node
   import { Command } from "@effect/cli"
   // ...
   ```

3. Link locally for testing:
   ```bash
   pnpm link --global
   ```

### Exit Code Always 0

**Problem:** Command always exits with 0 even on error

**Solutions:**

1. Return exit code from handler:

   ```typescript
   const handler = (opts) =>
     Effect.gen(function* () {
       if (error) return 1
       return 0
     })
   ```

2. Check catchAll doesn't return success:

   ```typescript
   // ❌ BAD
   Effect.catchAll(() => Effect.succeed(0))

   // ✅ GOOD
   Effect.catchAll(() => Effect.succeed(1))
   ```

### Options Not Parsing

**Problem:** Options show as undefined in handler

**Solutions:**

1. Use Options builders:

   ```typescript
   // ❌ BAD
   const options = { config: "text" }

   // ✅ GOOD
   const options = {
     config: Options.text("config")
   }
   ```

2. Check option names match CLI flags:
   ```typescript
   // CLI: --config-file
   // Handler receives: configFile
   const configFileOption = Options.text("config-file")
   ```

---

## Development Checklist

When adding new CLI commands:

- [ ] Use `@effect/cli` Command.make
- [ ] Define Options with withDefault for optional values
- [ ] Return proper exit codes (0 = success, 1 = error)
- [ ] Use Console service, not console.log
- [ ] Provide NodeContext.layer
- [ ] Add user-friendly error messages with icons
- [ ] Support --json flag for machine output
- [ ] Add --amp-out for Amp context
- [ ] Write integration tests
- [ ] Add progress indicators for long operations
- [ ] Document command in README

---

**Last Updated:** 2025-11-03\
**See Also:** [Root AGENTS.md](../../AGENTS.md) for general Effect patterns
