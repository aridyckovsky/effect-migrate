---
created: 2025-11-08
lastUpdated: 2025-11-08
author: Generated via Amp (simplified from comprehensive plan)
status: ready
thread: https://ampcode.com/threads/T-c3ede67c-37ec-4cf8-a360-659beed5b6d1
audience: Development team, AI coding agents, and technical decision makers
tags: [agents-md, documentation, amp-sdk, effect-wrapper, mvp]
related:
  - ./agents-doc-generation.md
  - ./checkpoint-based-audit-persistence.md
  - ../concepts/amp-integration.md
  - ../../AGENTS.md
---

# Norms Capture MVP: Amp SDK + Effect

## Executive Summary

Capture directory-specific migration norms from checkpoint history and document them in AGENTS.md files. This MVP wraps Amp's TypeScript SDK in Effect services to leverage Amp's capabilities for documentation generation and thread analysis.

**Key Innovation:** Use Effect to compose checkpoint analysis with Amp SDK calls, automatically capturing the norms that emerged during migration work—creating shared agreements between humans and agents about how code should be written.

**Effort:** 2-4 hours (vs 12-20 hours for full deterministic approach)

**Trade-offs:**
- ✅ Much simpler implementation
- ✅ Better quality docs (Amp writes better than templates)
- ✅ Dogfoods Effect patterns (wrapping external SDKs)
- ❌ Requires Amp API access (not standalone)
- ❌ Less deterministic (AI can vary)

---

## What This Feature Does

As you migrate directories to Effect, `effect-migrate` tracks your progress via checkpoints. This feature automatically generates **directory-specific AGENTS.md files** that document the norms and patterns established during migration.

**Example:**

After migrating `src/services/` over several Amp sessions, the checkpoint history shows:
- All async/await replaced with Effect.gen
- All Node.js imports replaced with @effect/platform
- All console.* calls replaced with Effect Console service

Instead of manually documenting these norms, run:

```bash
effect-migrate norms capture
```

This analyzes checkpoint history and captures the norms in `src/services/AGENTS.md`:

````markdown
---
generated: 2025-11-08T14:30:00Z
status: migrated
---

# AGENTS for src/services

## Enforced Norms

- **no-async-await** — Use Effect.gen instead
- **no-node-imports** — Use @effect/platform APIs
- **use-effect-console** — Use Console service

## Migration History

- Thread T-abc123 (2025-11-03): Migrated async patterns
- Thread T-def456 (2025-11-05): Enforced platform boundaries
````

Now when Amp works in `src/services/`, it automatically loads this AGENTS.md and knows to follow these norms.

### Three Usage Modes

**1. Fully Automated (2-4 hour implementation)**

```bash
effect-migrate norms capture
# ✓ Analyzes checkpoint history
# ✓ Calls Amp SDK to document norms
# ✓ Writes AGENTS.md files
```

**2. Prepare + Manual (1 hour implementation)**

```bash
effect-migrate norms capture --prepare-only
# ✓ Writes norm summaries to .amp/effect-migrate/norms/

# Then in Amp:
# "Read @.amp/effect-migrate/norms/ and document these in AGENTS.md for each directory"
```

**3. From Within Amp (recommended)**

```
You: "Run effect-migrate norms capture for migrated directories"
Amp: [executes command with API key already available]
     [captures norms and writes AGENTS.md files]
```

---

## Problem Statement

As teams migrate directories to Effect, checkpoint history reveals which norms emerged from actual work. We want to automatically capture these norms and document them in AGENTS.md files—creating shared agreements between humans and agents.

**Instead of building complex templating infrastructure, let Amp do what it's good at: understanding context and writing documentation.**

---

## Architecture

> **🤔 EVEN SIMPLER ALTERNATIVE:**
>
> Since Amp is likely executing this command, we could skip the SDK entirely and use **Amp's built-in tools**:
>
> ```typescript
> // Instead of calling Amp SDK from within effect-migrate...
> const content = yield* amp.executePrompt(prompt)
> 
> // Just capture the norms and let Amp document them:
> const norms = yield* captureNorms(directory)
> yield* writeFile(".amp/effect-migrate/norms/src-services.json", norms)
> 
> // Then output a message telling Amp what to do:
> yield* Console.log(`
>   ✓ Norms captured to .amp/effect-migrate/norms/src-services.json
>   
>   To document in AGENTS.md:
>   Read @.amp/effect-migrate/norms/src-services.json and document in ${directory}/AGENTS.md
> `)
> ```
>
> **Why this might be better:**
> - Even simpler (no SDK dependency)
> - Amp can use its full context (files, git, etc.)
> - User can review/tweak before generation
> - Amp handles the actual writing
>
> **Why we use SDK instead:**
> - Automated workflow (no user intervention)
> - Programmatic composition within Effect
> - Better for batch processing multiple directories
> - Effect error handling and retries
>
> **Decision:** Use SDK for automation, but could add `--prepare-only` flag for manual workflow.

### Data Flow

```text
Checkpoint History
       │
       ▼
Directory Summarizer (Effect)
  │
  ├─ Query latest checkpoint
  ├─ Group findings by directory
  ├─ Identify established norms
  └─ Extract thread associations
       │
       ▼
JSON Summary Output
       │
       ▼
Amp Service (Effect-wrapped SDK)
  │
  ├─ Load summary context
  ├─ Read associated threads
  └─ Generate AGENTS.md content
       │
       ▼
FileSystem Service (Effect)
       │
       └─ Write directory/AGENTS.md
```

### Service Architecture

```typescript
// Core services we need
interface DirectorySummarizer {
  summarize(directory: string): Effect<DirectorySummary, PlatformError>
}

interface AmpService {
  executePrompt(prompt: string, context?: string[]): Effect<string, AmpError>
  readThread(threadId: string): Effect<ThreadContent, AmpError>
}

// Composition
const generateAgentsMd = (directory: string) =>
  Effect.gen(function* () {
    const summarizer = yield* DirectorySummarizer
    const amp = yield* AmpService
    const fs = yield* FileSystem.FileSystem
    
    // 1. Prepare checkpoint summary
    const summary = yield* summarizer.summarize(directory)
    
    // 2. Generate docs with Amp
    const content = yield* amp.executePrompt(
      `Generate AGENTS.md for ${directory} based on this migration history`,
      [JSON.stringify(summary)]
    )
    
    // 3. Write to filesystem
    yield* fs.writeFileString(`${directory}/AGENTS.md`, content)
  })
```

---

## Implementation

### Phase 1: Directory Summarizer (1-2 hours)

**Goal:** Extract key migration metrics from checkpoint data.

#### DirectorySummary Type

```typescript
import * as Schema from "effect/Schema"

export const DirectorySummary = Schema.Struct({
  /** Directory path relative to project root */
  directory: Schema.String,
  
  /** Migration status */
  status: Schema.Literal("migrated", "in-progress", "not-started"),
  
  /** When directory became clean (if applicable) */
  cleanSince: Schema.optional(Schema.DateTimeUtc),
  
  /** File statistics */
  files: Schema.Struct({
    total: Schema.Number,
    clean: Schema.Number,
    withViolations: Schema.Number
  }),
  
  /** Norms established (rules that went to zero) */
  norms: Schema.Array(
    Schema.Struct({
      ruleId: Schema.String,
      ruleKind: Schema.String,
      severity: Schema.String,
      message: Schema.String,
      docsUrl: Schema.optional(Schema.String),
      fixedCount: Schema.Number,
      lastSeenAt: Schema.DateTimeUtc,
      extinctSince: Schema.DateTimeUtc
    })
  ),
  
  /** Associated threads */
  threads: Schema.Array(
    Schema.Struct({
      threadId: Schema.String,
      threadUrl: Schema.optional(Schema.String),
      dateRange: Schema.Struct({
        first: Schema.DateTimeUtc,
        last: Schema.DateTimeUtc
      }),
      fixesDelta: Schema.Struct({
        errors: Schema.Number,
        warnings: Schema.Number
      })
    })
  ),
  
  /** Latest checkpoint metadata */
  checkpoint: Schema.Struct({
    id: Schema.String,
    timestamp: Schema.DateTimeUtc,
    totalFindings: Schema.Number
  })
})

export type DirectorySummary = Schema.Schema.Type<typeof DirectorySummary>
```

#### DirectorySummarizer Service

```typescript
import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Schema from "effect/Schema"
import { FileSystem } from "@effect/platform"
import * as Path from "@effect/platform/Path"

export interface DirectorySummarizerService {
  /**
   * Summarize migration status for a directory.
   */
  readonly summarize: (
    directory: string
  ) => Effect.Effect<DirectorySummary, PlatformError>
  
  /**
   * List all directories that qualify for AGENTS.md generation.
   */
  readonly listQualifying: (options?: {
    readonly minFiles?: number
    readonly status?: "migrated" | "in-progress" | "all"
  }) => Effect.Effect<readonly DirectorySummary[], PlatformError>
}

export class DirectorySummarizer extends Context.Tag("DirectorySummarizer")<
  DirectorySummarizer,
  DirectorySummarizerService
>() {}
```

#### JSON-Based Implementation

```typescript
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { FileSystem } from "@effect/platform"
import * as Path from "@effect/platform/Path"

/**
 * JSON-based directory summarizer.
 * 
 * Reads latest checkpoint from .amp/effect-migrate/checkpoints/
 * and extracts directory-level metrics.
 */
export const DirectorySummarizerLive = Layer.effect(
  DirectorySummarizer,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    
    return DirectorySummarizer.of({
      summarize: (directory) =>
        Effect.gen(function* () {
          // Read latest checkpoint
          const manifestPath = path.join(
            ".amp/effect-migrate/checkpoints",
            "manifest.json"
          )
          
          const manifestContent = yield* fs.readFileString(manifestPath)
          const manifest = JSON.parse(manifestContent)
          
          const latestId = manifest.latest
          const latestPath = path.join(
            ".amp/effect-migrate/checkpoints",
            `${latestId}.json`
          )
          
          const checkpointContent = yield* fs.readFileString(latestPath)
          const checkpoint = JSON.parse(checkpointContent)
          
          // Filter findings for this directory
          const dirFindings = checkpoint.results.filter(
            (result: any) => 
              checkpoint.files[result.fileIdx].startsWith(directory)
          )
          
          // Get unique files in directory
          const dirFiles = new Set(
            checkpoint.files.filter((f: string) => f.startsWith(directory))
          )
          
          const filesWithViolations = new Set(
            dirFindings.map((r: any) => checkpoint.files[r.fileIdx])
          )
          
          // Identify norms (rules with no current violations)
          const currentRules = new Set(
            dirFindings.map((r: any) => checkpoint.rules[r.ruleIdx].id)
          )
          
          // Read previous checkpoints to find extinct rules
          const previousIds = manifest.history.slice(0, 5) // Last 5 checkpoints
          const norms: any[] = []
          
          for (const prevId of previousIds) {
            const prevPath = path.join(
              ".amp/effect-migrate/checkpoints",
              `${prevId}.json`
            )
            const prevContent = yield* fs.readFileString(prevPath)
            const prevCheckpoint = JSON.parse(prevContent)
            
            const prevDirFindings = prevCheckpoint.results.filter(
              (result: any) =>
                prevCheckpoint.files[result.fileIdx].startsWith(directory)
            )
            
            // Rules that existed before but are gone now
            const prevRules = new Map<string, any>()
            for (const finding of prevDirFindings) {
              const rule = prevCheckpoint.rules[finding.ruleIdx]
              if (!currentRules.has(rule.id)) {
                prevRules.set(rule.id, {
                  ...rule,
                  count: (prevRules.get(rule.id)?.count || 0) + 1
                })
              }
            }
            
            for (const [ruleId, ruleData] of prevRules) {
              if (!norms.find((n) => n.ruleId === ruleId)) {
                norms.push({
                  ruleId,
                  ruleKind: ruleData.kind,
                  severity: ruleData.severity,
                  message: ruleData.message,
                  docsUrl: ruleData.docsUrl,
                  fixedCount: ruleData.count,
                  lastSeenAt: new Date(prevCheckpoint.timestamp),
                  extinctSince: new Date(checkpoint.timestamp)
                })
              }
            }
          }
          
          // Extract thread associations
          const threads = manifest.history
            .filter((entry: any) => entry.threadId)
            .map((entry: any) => ({
              threadId: entry.threadId,
              threadUrl: entry.threadUrl,
              dateRange: {
                first: new Date(entry.timestamp),
                last: new Date(entry.timestamp)
              },
              fixesDelta: {
                errors: 0, // Would need delta calculation
                warnings: 0
              }
            }))
          
          // Determine status
          const status: "migrated" | "in-progress" | "not-started" =
            dirFindings.length === 0 && norms.length > 0
              ? "migrated"
              : dirFindings.length > 0
                ? "in-progress"
                : "not-started"
          
          return {
            directory,
            status,
            cleanSince: status === "migrated" ? new Date(checkpoint.timestamp) : undefined,
            files: {
              total: dirFiles.size,
              clean: dirFiles.size - filesWithViolations.size,
              withViolations: filesWithViolations.size
            },
            norms,
            threads,
            checkpoint: {
              id: latestId,
              timestamp: new Date(checkpoint.timestamp),
              totalFindings: dirFindings.length
            }
          }
        }),
      
      listQualifying: (options = {}) =>
        Effect.gen(function* () {
          const { minFiles = 3, status = "all" } = options
          
          // Read latest checkpoint to get all directories
          const manifestPath = path.join(
            ".amp/effect-migrate/checkpoints",
            "manifest.json"
          )
          
          const manifestContent = yield* fs.readFileString(manifestPath)
          const manifest = JSON.parse(manifestContent)
          
          const latestId = manifest.latest
          const latestPath = path.join(
            ".amp/effect-migrate/checkpoints",
            `${latestId}.json`
          )
          
          const checkpointContent = yield* fs.readFileString(latestPath)
          const checkpoint = JSON.parse(checkpointContent)
          
          // Extract unique directories (depth 2)
          const directories = new Set<string>()
          for (const file of checkpoint.files) {
            const parts = file.split('/')
            if (parts.length >= 2) {
              directories.add(`${parts[0]}/${parts[1]}`)
            }
          }
          
          // Summarize each directory
          const summaries = yield* Effect.forEach(
            Array.from(directories),
            (dir) => this.summarize(dir),
            { concurrency: 4 }
          )
          
          // Filter by criteria
          return summaries.filter(
            (summary) =>
              summary.files.total >= minFiles &&
              (status === "all" || summary.status === status)
          )
        })
    })
  })
)
```

---

### Phase 2: Amp SDK Service (1-2 hours)

**Goal:** Wrap Amp TypeScript SDK in Effect service for composability.

#### AmpService Interface

```typescript
import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Data from "effect/Data"

/**
 * Amp SDK errors.
 */
export class AmpError extends Data.TaggedError("AmpError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export interface ThreadContent {
  readonly id: string
  readonly messages: readonly {
    readonly role: "user" | "assistant"
    readonly content: string
  }[]
  readonly files?: readonly string[]
}

export interface AmpServiceInterface {
  /**
   * Execute a prompt and return the result.
   */
  readonly executePrompt: (
    prompt: string,
    options?: {
      readonly context?: readonly string[]
      readonly timeout?: number
    }
  ) => Effect.Effect<string, AmpError>
  
  /**
   * Read thread content by ID.
   */
  readonly readThread: (
    threadId: string
  ) => Effect.Effect<ThreadContent, AmpError>
}

export class AmpService extends Context.Tag("AmpService")<
  AmpService,
  AmpServiceInterface
>() {}
```

#### SDK Implementation

```typescript
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Config from "effect/Config"
import * as Duration from "effect/Duration"
import { AmpClient } from "@sourcegraph/amp"

/**
 * Live Amp service using @sourcegraph/amp SDK.
 * 
 * Wraps SDK methods in Effect for composability, error handling,
 * and resource management.
 */
export const AmpServiceLive = Layer.effect(
  AmpService,
  Effect.gen(function* () {
    // Get API key from config
    const apiKey = yield* Config.redacted("AMP_API_KEY")
    
    // Create client with resource cleanup
    const client = yield* Effect.acquireRelease(
      Effect.sync(() => new AmpClient({ 
        apiKey: Config.Redacted.value(apiKey)
      })),
      (client) => Effect.sync(() => client.close?.())
    )
    
    return AmpService.of({
      executePrompt: (prompt, options = {}) =>
        Effect.gen(function* () {
          const { context = [], timeout = 30000 } = options
          
          // Build full prompt with context
          const contextStr = context.length > 0
            ? `\n\nContext:\n${context.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}`
            : ''
          
          const fullPrompt = `${prompt}${contextStr}`
          
          // Execute with timeout
          const result = yield* Effect.tryPromise({
            try: () => client.execute({
              prompt: fullPrompt,
              mode: 'smart' // Use smart mode for quality
            }),
            catch: (error) =>
              new AmpError({
                message: `Amp execution failed: ${String(error)}`,
                cause: error
              })
          }).pipe(
            Effect.timeout(Duration.millis(timeout)),
            Effect.catchTag("TimeoutException", () =>
              Effect.fail(
                new AmpError({
                  message: `Amp execution timed out after ${timeout}ms`
                })
              )
            )
          )
          
          // Extract text response
          return result.response || result.text || ''
        }),
      
      readThread: (threadId) =>
        Effect.gen(function* () {
          const thread = yield* Effect.tryPromise({
            try: () => client.getThread(threadId),
            catch: (error) =>
              new AmpError({
                message: `Failed to read thread ${threadId}: ${String(error)}`,
                cause: error
              })
          })
          
          return {
            id: thread.id,
            messages: thread.messages.map((msg: any) => ({
              role: msg.role,
              content: msg.content
            })),
            files: thread.files
          }
        })
    })
  })
)
```

---

### Phase 3: CLI Command (30 minutes)

**Goal:** Wire everything together in a simple CLI command.

#### Command Implementation

```typescript
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import { FileSystem } from "@effect/platform"
import * as Path from "@effect/platform/Path"
import { DirectorySummarizer, AmpService } from "@effect-migrate/core"

const normsCaptureCommand = Command.make(
  "capture",
  {
    target: Options.choice("target", ["migrated", "in-progress", "all"]).pipe(
      Options.withDefault("migrated")
    ),
    minFiles: Options.integer("min-files").pipe(
      Options.withDefault(3)
    ),
    overwrite: Options.boolean("overwrite").pipe(
      Options.withDefault(false)
    )
  },
  (opts) =>
    Effect.gen(function* () {
      const summarizer = yield* DirectorySummarizer
      const amp = yield* AmpService
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      
      yield* Console.log("🔍 Analyzing checkpoint history...")
      
      // Get qualifying directories
      const summaries = yield* summarizer.listQualifying({
        minFiles: opts.minFiles,
        status: opts.target
      })
      
      if (summaries.length === 0) {
        yield* Console.log(`\n❌ No directories matched criteria for ${opts.target}`)
        return
      }
      
      yield* Console.log(`\n✨ Found ${summaries.length} directories to document\n`)
      
      // Generate AGENTS.md for each directory
      const results = yield* Effect.forEach(
        summaries,
        (summary) =>
          Effect.gen(function* () {
            const agentsPath = path.join(summary.directory, "AGENTS.md")
            
            // Check if exists
            const exists = yield* fs.exists(agentsPath)
            if (exists && !opts.overwrite) {
              yield* Console.log(
                `⏭️  Skipping ${summary.directory} (AGENTS.md exists, use --overwrite)`
              )
              return { path: agentsPath, skipped: true }
            }
            
            yield* Console.log(`📝 Generating ${agentsPath}...`)
            
            // Prepare context for Amp
            const contextJson = JSON.stringify(summary, null, 2)
            
            // Build prompt for Amp
            const prompt = `
You are documenting migration norms for a TypeScript codebase being migrated to Effect.

Generate an AGENTS.md file for the directory: ${summary.directory}

Based on this checkpoint analysis, document:
1. Migration status (${summary.status})
2. Enforced norms (rules that are consistently followed)
3. Thread history (migration decisions and work done)
4. Verification commands

Use the YAML frontmatter:
---
generated: ${new Date().toISOString()}
status: ${summary.status}
source: effect-migrate checkpoint analysis
---

Keep the tone technical and concise. Focus on actionable guidance for AI coding agents.
Format as Markdown with proper headings and code blocks.
            `.trim()
            
            // Generate with Amp
            const content = yield* amp.executePrompt(prompt, {
              context: [contextJson],
              timeout: 45000
            })
            
            // Write to filesystem
            yield* fs.writeFileString(agentsPath, content)
            
            yield* Console.log(`  ✅ ${agentsPath}`)
            
            return { path: agentsPath, skipped: false }
          }),
        { concurrency: 1 } // Sequential to avoid rate limits
      )
      
      const generated = results.filter((r) => !r.skipped)
      
      yield* Console.log(`\n✨ Generated ${generated.length} AGENTS.md files`)
      yield* Console.log(
        `\n💡 Tip: Amp will auto-load these files when working in these directories`
      )
    })
)

export const normsCommand = Command.make("norms").pipe(
  Command.withSubcommands([normsCaptureCommand])
)
```

---

## Usage

### Installation

```bash
# Install Amp SDK
pnpm add @sourcegraph/amp
```

### Configuration

```bash
# Set Amp API key (same key used for Amp sessions)
export AMP_API_KEY=your-api-key
```

> **💡 IMPORTANT:** If Amp is executing effect-migrate (which is the primary use case), the `AMP_API_KEY` is **already available** in Amp's environment.
>
> Users don't need to set it separately - Amp provides it automatically to any commands it runs.
>
> **Two execution modes:**
>
> 1. **From Amp session** (primary):
>    ```
>    User: "Run effect-migrate agents generate for migrated directories"
>    Amp: [executes command with AMP_API_KEY already set]
>    ```
>
> 2. **Standalone** (rare):
>    ```bash
>    # User running directly in terminal
>    export AMP_API_KEY=sk-...
>    effect-migrate agents generate
>    ```
>
> The SDK approach still makes sense because we're composing programmatically within the same process, not spawning Amp as a subprocess.

### CLI Commands

```bash
# Capture norms for all migrated directories
effect-migrate norms capture

# Capture for all directories (including in-progress)
effect-migrate norms capture --target all

# Customize minimum file count
effect-migrate norms capture --min-files 5

# Overwrite existing AGENTS.md files
effect-migrate norms capture --overwrite

# Prepare norm summaries without writing AGENTS.md (let Amp do it)
effect-migrate norms capture --prepare-only
```

> **💡 SIMPLEST STARTING POINT:**
>
> The `--prepare-only` flag captures norms but doesn't call Amp SDK. Instead:
>
> ```bash
> $ effect-migrate norms capture --prepare-only
> 
> ✓ Captured norms for 3 directories:
>   - src/services/   → .amp/effect-migrate/norms/src-services.json
>   - src/models/     → .amp/effect-migrate/norms/src-models.json
>   - src/utils/      → .amp/effect-migrate/norms/src-utils.json
> 
> To document in AGENTS.md, tell Amp:
> "Read the norms in @.amp/effect-migrate/norms/ and document them in 
> AGENTS.md for each directory"
> ```
>
> **Benefits:**
> - No SDK dependency (Phase 1 only)
> - User controls when documentation happens
> - Can review captured norms first
> - Amp has full context when writing
>
> **Implementation:** This is just norm capture (Phase 1) - ~1 hour effort!

---

## Example Output

**Generated `src/services/AGENTS.md`:**

````markdown
---
generated: 2025-11-08T14:30:00Z
status: migrated
source: effect-migrate checkpoint analysis
---

# AGENTS for src/services

## Status

**✅ Migrated** (clean since 2025-11-05)

- **Files:** 18 total, 18 clean (100%)
- **Last checkpoint:** 2025-11-08T14:00:00Z

## Enforced Norms

The following patterns are consistently enforced in this directory:

### Async/Effect Patterns

- **no-async-await** — All async operations use `Effect.gen` instead of `async/await`
  - Fixed 24 violations
  - Extinct since 2025-11-05
  - [Docs](https://effect.website/docs/essentials/effect-type)

- **no-promise-constructor** — All promises wrapped in `Effect.promise`
  - Fixed 15 violations
  - Extinct since 2025-11-04

### Architectural Boundaries

- **no-node-imports** — Use `@effect/platform` instead of Node.js built-ins
  - Fixed 12 violations
  - Extinct since 2025-11-05
  - [Docs](https://effect.website/docs/guides/platform)

- **no-import-from-legacy** — Clean separation from legacy code
  - Fixed 8 violations
  - Extinct since 2025-11-04

### Service Patterns

- **use-effect-console** — Use `Console` service instead of `console.*`
  - Fixed 18 violations
  - Extinct since 2025-11-03

## Migration History

Key Amp threads that established these norms:

- **T-a96b5e77** (2025-11-03 → 2025-11-05): Migrated core services to Effect patterns
- **T-5d39c44c** (2025-11-04 → 2025-11-05): Enforced platform boundaries

## Verification

Re-audit to verify compliance:

```bash
effect-migrate audit --amp-out .amp/effect-migrate
effect-migrate checkpoints list
```

---

*Generated by effect-migrate using Amp*
````

---

## Testing Strategy

### Unit Tests

```typescript
import { describe, it, expect } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { DirectorySummarizer, AmpService } from "./agents"

describe("DirectorySummarizer", () => {
  it.effect("should summarize migrated directory", () =>
    Effect.gen(function* () {
      const summarizer = yield* DirectorySummarizer
      
      const summary = yield* summarizer.summarize("src/services")
      
      expect(summary.directory).toBe("src/services")
      expect(summary.status).toBe("migrated")
      expect(summary.norms.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(DirectorySummarizerLive))
  )
})

describe("AmpService", () => {
  // Mock for testing
  const AmpServiceMock = Layer.succeed(AmpService, {
    executePrompt: (prompt) =>
      Effect.succeed(`# AGENTS.md\n\nGenerated from: ${prompt.slice(0, 50)}...`),
    readThread: (threadId) =>
      Effect.succeed({
        id: threadId,
        messages: [
          { role: "user", content: "Migrate services" },
          { role: "assistant", content: "Done" }
        ]
      })
  })
  
  it.effect("should generate content via Amp", () =>
    Effect.gen(function* () {
      const amp = yield* AmpService
      
      const content = yield* amp.executePrompt("Generate AGENTS.md")
      
      expect(content).toContain("# AGENTS.md")
    }).pipe(Effect.provide(AmpServiceMock))
  )
})
```

---

## Advantages Over Deterministic Approach

| Aspect                | MVP (Amp SDK)                        | Full Deterministic                    |
| --------------------- | ------------------------------------ | ------------------------------------- |
| **Effort**            | 2-4 hours                            | 12-20 hours                           |
| **Code**              | ~300 LOC                             | ~2000 LOC                             |
| **Files**             | 3 files                              | 15+ files                             |
| **Quality**           | Amp writes better docs               | Template-based (rigid)                |
| **Flexibility**       | Easy to customize prompts            | Must update templates                 |
| **Thread awareness**  | Amp can read-thread automatically    | Need to parse thread content manually |
| **Testing**           | Mock Amp service easily              | Complex template testing              |
| **Maintenance**       | SDK updates handled by Amp team      | We maintain all logic                 |
| **Standalone**        | ❌ Requires Amp                      | ✅ Works offline                      |
| **Deterministic**     | ❌ AI can vary                       | ✅ Same input = same output           |

---

## When NOT to Use This Approach

Consider the full deterministic approach ([agents-doc-generation.md](./agents-doc-generation.md)) if:

- **Offline operation required**: Users need to work without Amp API access
- **Bit-for-bit reproducibility**: CI/CD requires identical output every time
- **High volume**: Generating docs for 100+ directories (API rate limits)
- **Custom formats**: Need very specific doc structure that prompts can't achieve
- **No Amp dependency**: Tool must work standalone without external services

---

## Migration Path

### From This MVP

If you start here and later need deterministic generation:

1. Extract template from Amp-generated examples
2. Implement `TemplateDocGenerator` service
3. Add `--use-amp` flag (default false)
4. MVP becomes the "enhanced" option

### To This MVP

If you've already built deterministic infrastructure:

1. Add `AmpService` wrapper
2. Add `--use-amp` flag (optional)
3. Compare quality of Amp vs template output
4. Decide which to make default

---

## File Structure

```
packages/core/src/
├── amp/
│   └── AmpService.ts              # Effect wrapper for @sourcegraph/amp SDK
└── norms/
    └── NormCapture.ts             # Checkpoint → norm extraction

packages/cli/src/
└── commands/
    └── norms.ts                   # CLI command implementation

packages/core/test/
└── norms/
    ├── NormCapture.test.ts
    └── AmpService.test.ts
```

---

## Dependencies

```json
{
  "dependencies": {
    "@sourcegraph/amp": "^0.1.0",
    "effect": "^3.19.2",
    "@effect/platform": "^0.93.0",
    "@effect/cli": "^0.72.0"
  }
}
```

---

## Success Criteria

- [ ] DirectorySummarizer extracts accurate metrics from checkpoints
- [ ] AmpService wraps SDK with proper error handling and timeouts
- [ ] CLI command generates readable AGENTS.md files
- [ ] Generated docs include status, norms, threads, verification
- [ ] Amp's output is high quality and contextually relevant
- [ ] Tests cover service mocking and integration
- [ ] Performance: <5s per directory (including Amp API latency)

---

## Performance Targets

| Metric                     | Target                  | Notes                          |
| -------------------------- | ----------------------- | ------------------------------ |
| Summary extraction         | <200ms per directory    | JSON parsing + filtering       |
| Amp API call               | <10s per directory      | Smart mode with timeout        |
| File write                 | <50ms                   | Native filesystem              |
| Total per directory        | <15s                    | Including Amp generation       |
| Sequential generation (5)  | <1 minute               | Rate limit friendly            |

---

## Future Enhancements

### Caching

```typescript
// Cache Amp responses to avoid regeneration
const withCache = Effect.cachedWithTTL(
  amp.executePrompt,
  Duration.hours(24)
)
```

### Batch Processing

```typescript
// Generate multiple directories in parallel (with rate limiting)
Effect.forEach(
  directories,
  (dir) => generateAgentsMd(dir),
  { concurrency: 2 } // Respect API limits
)
```

### Custom Prompts

```typescript
// Allow users to customize generation prompts
const customPrompt = fs.readFileString(".amp/agents-prompt.txt")
amp.executePrompt(customPrompt, { context: [summary] })
```

### Diff Mode

```typescript
// Show what changed since last generation
const existingContent = fs.readFileString(`${dir}/AGENTS.md`)
const newContent = amp.executePrompt(...)
const diff = computeDiff(existingContent, newContent)
```

---

## Conclusion

This MVP approach leverages Amp's strengths while dogfooding Effect patterns. It's the simplest path to valuable functionality, with clear upgrade paths if deterministic generation becomes necessary.

**Recommended first step:** Prototype `DirectorySummarizer` and validate that checkpoint data contains sufficient information for meaningful AGENTS.md generation.

---

**Last Updated:** 2025-11-08  
**Maintainer:** Ari Dyckovsky  
**Status:** Ready for implementation  
**Next Steps:** Prototype DirectorySummarizer, validate summary schema with team, implement AmpService wrapper
