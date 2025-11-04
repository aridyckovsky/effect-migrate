---
created: 2025-11-04
lastUpdated: 2025-11-04
author: Generated via Amp (Oracle + AI analysis)
status: ready
thread: https://ampcode.com/threads/T-38c593cf-0e0f-4570-ad73-dfc2c3b1d6c9
related: ../concepts/amp-integration.md
---

# Thread Command Implementation Plan

## Goal

Implement `effect-migrate thread add` and `effect-migrate thread list` commands to manage Amp thread references in migration context.

**Estimated Effort:** 4-6 hours coding + 1-3 hours testing/docs

---

## Overview

Add thread management commands that read/write `.amp/effect-migrate/threads.json` and integrate with existing audit/metrics context generation.

**Commands to implement:**

```bash
effect-migrate thread add <url> [--scope src/api/*] [--tags migration,api]
effect-migrate thread list [--json]
```

---

## Implementation Order

### Phase 1: Core Infrastructure (1-2 hours)

#### 1.1 Create `packages/cli/src/amp/thread-manager.ts`

**Purpose:** Centralize thread validation, read/write, and merge logic.

**Schemas to define:**

```typescript
import * as Schema from "effect/Schema"

// Thread entry for threads.json
export const ThreadEntry = Schema.Struct({
  id: Schema.String, // e.g., "T-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  url: Schema.String.pipe(
    Schema.pattern(
      /^https:\/\/ampcode\.com\/threads\/T-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  ),
  createdAt: Schema.DateTimeUtc,
  tags: Schema.optional(Schema.Array(Schema.String)),
  scope: Schema.optional(Schema.Array(Schema.String)), // file globs or paths
  description: Schema.optional(Schema.String)
})

// File format for threads.json
export const ThreadsFile = Schema.Struct({
  version: Schema.Number,
  threads: Schema.Array(ThreadEntry)
})

export type ThreadEntry = typeof ThreadEntry.Type
export type ThreadsFile = typeof ThreadsFile.Type
```

**Functions to implement:**

```typescript
// 1. Validate thread URL and extract ID
export const validateThreadUrl = (url: string): Effect.Effect<{ id: string; url: string }, Error> =>
  Effect.gen(function* () {
    const regex =
      /^https:\/\/ampcode\.com\/threads\/(T-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
    const match = url.match(regex)

    if (!match) {
      return yield* Effect.fail(
        new Error(`Invalid thread URL. Expected format: https://ampcode.com/threads/T-{uuid}`)
      )
    }

    return { id: match[1], url }
  })

// 2. Read threads.json (returns empty if missing/invalid)
export const readThreads = (
  outputDir: string
): Effect.Effect<ThreadsFile, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const threadsPath = path.join(outputDir, "threads.json")

    // If file doesn't exist, return empty
    const exists = yield* fs.exists(threadsPath)
    if (!exists) {
      return { version: 1, threads: [] }
    }

    // Try to read and decode
    const content = yield* fs
      .readFileString(threadsPath)
      .pipe(Effect.catchAll(() => Effect.succeed("")))

    if (!content) {
      return { version: 1, threads: [] }
    }

    // Parse and decode with schema
    const data = JSON.parse(content)
    const decode = Schema.decodeUnknownSync(ThreadsFile)

    return yield* Effect.try({
      try: () => decode(data),
      catch: (error) => {
        // Log warning but don't fail
        console.warn(`Malformed threads.json: ${error}`)
        return { version: 1, threads: [] }
      }
    })
  })

// 3. Write threads.json
export const writeThreads = (
  outputDir: string,
  data: ThreadsFile
): Effect.Effect<void, Error, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Ensure directory exists
    yield* fs.makeDirectory(outputDir, { recursive: true })

    // Encode and write
    const encode = Schema.encodeSync(ThreadsFile)
    const encoded = encode(data)
    const threadsPath = path.join(outputDir, "threads.json")

    yield* fs.writeFileString(threadsPath, JSON.stringify(encoded, null, 2))
  })

// 4. Add or merge thread
export const addThread = (
  outputDir: string,
  input: {
    url: string
    tags?: string[]
    scope?: string[]
    description?: string
  }
): Effect.Effect<
  { added: boolean; merged: boolean; current: ThreadEntry },
  Error,
  FileSystem.FileSystem | Path.Path | Clock.Clock
> =>
  Effect.gen(function* () {
    // Validate URL
    const { id, url } = yield* validateThreadUrl(input.url)

    // Get current timestamp
    const now = yield* Clock.currentTimeMillis
    const createdAt = DateTime.unsafeMake(now)

    // Read existing threads
    const threadsFile = yield* readThreads(outputDir)

    // Check if thread already exists
    const existingIndex = threadsFile.threads.findIndex((t) => t.url === url)

    if (existingIndex >= 0) {
      // Merge tags and scope (set union)
      const existing = threadsFile.threads[existingIndex]
      const mergedTags = Array.from(
        new Set([...(existing.tags ?? []), ...(input.tags ?? [])])
      ).sort()
      const mergedScope = Array.from(
        new Set([...(existing.scope ?? []), ...(input.scope ?? [])])
      ).sort()

      const updated: ThreadEntry = {
        id: existing.id,
        url: existing.url,
        createdAt: existing.createdAt, // Preserve original
        ...(mergedTags.length > 0 && { tags: mergedTags }),
        ...(mergedScope.length > 0 && { scope: mergedScope }),
        ...(input.description && !existing.description && { description: input.description })
      }

      threadsFile.threads[existingIndex] = updated

      // Sort by createdAt descending
      threadsFile.threads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      yield* writeThreads(outputDir, threadsFile)

      return { added: false, merged: true, current: updated }
    } else {
      // Add new thread
      const newEntry: ThreadEntry = {
        id,
        url,
        createdAt,
        ...(input.tags && input.tags.length > 0 && { tags: input.tags.sort() }),
        ...(input.scope && input.scope.length > 0 && { scope: input.scope.sort() }),
        ...(input.description && { description: input.description })
      }

      threadsFile.threads.push(newEntry)

      // Sort by createdAt descending
      threadsFile.threads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      yield* writeThreads(outputDir, threadsFile)

      return { added: true, merged: false, current: newEntry }
    }
  })
```

**Key patterns:**

- Use `@effect/schema` for validation
- Return empty `ThreadsFile` on errors (don't crash)
- Merge tags/scope using set union
- Always sort threads by `createdAt` descending

---

### Phase 2: CLI Commands (1-2 hours)

#### 2.1 Create `packages/cli/src/commands/thread.ts`

**Structure:**

```typescript
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { addThread, readThreads } from "../amp/thread-manager.js"

// ADD subcommand
const threadAddCommand = Command.make(
  "add",
  {
    url: Options.text("url"), // Required
    scope: Options.text("scope").pipe(Options.optional), // Optional comma-separated
    tags: Options.text("tags").pipe(Options.optional), // Optional comma-separated
    ampOut: Options.text("amp-out").pipe(Options.withDefault(".amp/effect-migrate"))
  },
  ({ url, scope, tags, ampOut }) =>
    Effect.gen(function* () {
      // Parse comma-separated values
      const tagsList = tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : []
      const scopeList = scope
        ? scope
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []

      // Add thread
      const result = yield* addThread(ampOut, {
        url,
        tags: tagsList.length > 0 ? tagsList : undefined,
        scope: scopeList.length > 0 ? scopeList : undefined
      })

      // Log result
      if (result.added) {
        yield* Console.log(`✓ Added thread ${result.current.id}`)
        yield* Console.log(`  ${result.current.url}`)
      } else if (result.merged) {
        yield* Console.log(`✓ Updated thread ${result.current.id}: merged tags/scope`)
        yield* Console.log(`  ${result.current.url}`)
      } else {
        yield* Console.log(`✓ Thread already tracked ${result.current.id}`)
      }

      return 0
    }).pipe(
      Effect.provide(NodeFileSystem.layer),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(`❌ Thread add failed: ${error}`)
          return 1
        })
      )
    )
)

// LIST subcommand
const threadListCommand = Command.make(
  "list",
  {
    ampOut: Options.text("amp-out").pipe(Options.withDefault(".amp/effect-migrate")),
    json: Options.boolean("json").pipe(Options.withDefault(false))
  },
  ({ ampOut, json }) =>
    Effect.gen(function* () {
      const threadsFile = yield* readThreads(ampOut)

      if (json) {
        yield* Console.log(JSON.stringify(threadsFile, null, 2))
      } else {
        if (threadsFile.threads.length === 0) {
          yield* Console.log("No threads tracked")
        } else {
          yield* Console.log(`\nTracked threads (${threadsFile.threads.length}):\n`)

          for (const thread of threadsFile.threads) {
            yield* Console.log(`${thread.id}`)
            yield* Console.log(`  URL: ${thread.url}`)
            yield* Console.log(`  Created: ${thread.createdAt.toISOString()}`)
            if (thread.tags && thread.tags.length > 0) {
              yield* Console.log(`  Tags: ${thread.tags.join(", ")}`)
            }
            if (thread.scope && thread.scope.length > 0) {
              yield* Console.log(`  Scope: ${thread.scope.join(", ")}`)
            }
            if (thread.description) {
              yield* Console.log(`  Description: ${thread.description}`)
            }
            yield* Console.log("")
          }
        }
      }

      return 0
    }).pipe(
      Effect.provide(NodeFileSystem.layer),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(`❌ Thread list failed: ${error}`)
          return 1
        })
      )
    )
)

// Main thread command with subcommands
export const threadCommand = Command.make("thread", {}, () =>
  Effect.gen(function* () {
    yield* Console.log("Use 'thread add' or 'thread list'")
    return 0
  })
).pipe(Command.withSubcommands([threadAddCommand, threadListCommand]))
```

---

### Phase 3: Integration (0.5-1 hour)

#### 3.1 Update `packages/cli/src/index.ts`

**Changes:**

```typescript
// Add import
import { threadCommand } from "./commands/thread.js"

// Update withSubcommands
const cli = mainCommand.pipe(
  Command.withSubcommands([
    auditCommand,
    initCommand,
    metricsCommand,
    threadCommand // Add this
  ])
)
```

#### 3.2 Update `packages/cli/src/amp/context-writer.ts`

**Changes:**

1. **Extend ThreadReference schema** (add optional fields):

```typescript
export const ThreadReference = Schema.Struct({
  url: Schema.String.pipe(Schema.pattern(/^https:\/\/ampcode\.com\/threads\/T-[a-f0-9-]+$/)),
  timestamp: Schema.DateTimeUtc,
  description: Schema.optional(Schema.String),
  filesChanged: Schema.optional(Schema.Array(Schema.String)),
  rulesResolved: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)), // ADD THIS
  scope: Schema.optional(Schema.Array(Schema.String)) // ADD THIS
})
```

2. **Import thread-manager:**

```typescript
import { readThreads } from "./thread-manager.js"
```

3. **In `writeAmpContext` function, after creating `auditContext` but before encoding:**

```typescript
// Read threads and add to context
const threadsFile =
  yield *
  readThreads(outputDir).pipe(Effect.catchAll(() => Effect.succeed({ version: 1, threads: [] })))

if (threadsFile.threads.length > 0) {
  const threadsAsRefs: ThreadReference[] = threadsFile.threads.map((t) => ({
    url: t.url,
    timestamp: t.createdAt,
    ...(t.description && { description: t.description }),
    ...(t.tags && t.tags.length > 0 && { tags: t.tags }),
    ...(t.scope && t.scope.length > 0 && { scope: t.scope })
  }))

  auditContext.threads = threadsAsRefs
}
```

---

### Phase 4: Testing (1-2 hours)

#### 4.1 Unit Tests

**File:** `packages/cli/test/amp/thread-manager.test.ts`

**Test cases:**

- `validateThreadUrl` accepts valid URLs
- `validateThreadUrl` rejects invalid URLs
- `addThread` adds new thread
- `addThread` merges tags/scope on duplicate
- `addThread` preserves earliest `createdAt`
- `readThreads` returns empty on missing file
- `readThreads` handles malformed JSON gracefully
- Read/write round-trip

#### 4.2 CLI Integration Tests

**File:** `packages/cli/test/commands/thread.test.ts`

**Test cases:**

- `thread add` with valid URL succeeds
- `thread add` with invalid URL fails
- `thread add` with tags/scope parses correctly
- `thread list` shows threads
- `thread list --json` outputs valid JSON

#### 4.3 Context Integration Test

**Test scenario:**

1. Create `threads.json` via `thread add`
2. Run `audit --amp-out`
3. Assert `audit.json` includes threads array
4. Verify threads match expected format

---

## Edge Cases to Handle

1. **Empty strings in tags/scope:** Filter with `.filter(Boolean)`
2. **Duplicate tags/scope:** Use `Set` for deduplication
3. **Concurrent writes:** Simple approach acceptable for CLI; can add locking later
4. **Malformed threads.json:** Log warning, return empty, don't crash
5. **Case sensitivity:** Enforce lowercase in URL regex
6. **Windows paths:** Store globs as-is, don't normalize

---

## Testing Commands

**After implementation, verify:**

```bash
# Build
pnpm build

# Test add command
effect-migrate thread add \
  --url https://ampcode.com/threads/T-12345678-1234-1234-1234-123456789abc \
  --tags migration,api \
  --scope "src/api/*"

# Test list command
effect-migrate thread list

# Test list JSON
effect-migrate thread list --json

# Test audit integration
effect-migrate audit --amp-out .amp/effect-migrate

# Verify threads in audit.json
cat .amp/effect-migrate/audit.json | jq '.threads'
```

---

## Success Criteria

- [ ] `thread add` validates URLs and writes to `threads.json`
- [ ] `thread add` merges tags/scope on duplicates
- [ ] `thread list` displays threads in readable format
- [ ] `thread list --json` outputs valid JSON
- [ ] `audit --amp-out` includes threads in `audit.json`
- [ ] All tests pass
- [ ] Documentation updated (README, AGENTS.md)

---

## Future Enhancements (Not in MVP)

- Positional `<url>` argument instead of `--url` flag
- Multiple `--tag` and `--scope` flags (instead of comma-separated)
- Filter threads by tag/scope in `list` command
- Relative time display ("3d ago")
- Atomic writes with temp file + rename
- Thread metadata enrichment (title, visibility from Amp API)

---

## Files Summary

**New files:**

- `packages/cli/src/amp/thread-manager.ts` (~200 lines)
- `packages/cli/src/commands/thread.ts` (~150 lines)
- `packages/cli/test/amp/thread-manager.test.ts` (~150 lines)
- `packages/cli/test/commands/thread.test.ts` (~100 lines)

**Modified files:**

- `packages/cli/src/index.ts` (2 lines)
- `packages/cli/src/amp/context-writer.ts` (~20 lines)

**Total LOC:** ~600 lines (including tests)

---

## Dependencies

All dependencies already in the project:

- `effect`
- `@effect/schema`
- `@effect/platform`
- `@effect/platform-node`
- `@effect/cli`
- `@effect/vitest` (for tests)

No new dependencies required.
