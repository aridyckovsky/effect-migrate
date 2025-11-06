---
created: 2025-11-06
lastUpdated: 2025-11-06
author: Generated via Amp (based on thread T-b45a5ac4-b859-4f11-95f4-c872c6e7eae0)
status: ready
thread: https://ampcode.com/threads/T-5d39c44c-3f5e-4112-b0b1-d9b9add1eea7
audience: Development team and AI coding agents
tags: [schema, versioning, checkpoints, persistence, amp-integration]
related:
  - ./schema-versioning-and-normalization.md
  - ../concepts/amp-integration.md
  - ../../AGENTS.md
---

# Checkpoint-Based Audit Persistence

## Goal

Implement checkpoint-based audit persistence to track migration progress over time, with special integration for Amp coding agent threads.

**Key Requirements:**

1. **Preserve audit history** - Don't overwrite audit.json; create checkpoints
2. **Track progress over time** - Users can see migration evolution across many Amp sessions
3. **Thread association** - Automatically link audits to Amp thread when tool is used during a thread
4. **Agent-friendly** - Coding agents can easily find "latest" audit without confusion from historical checkpoints
5. **Efficient storage** - Use normalized schema from schema-versioning plan to keep checkpoint size reasonable

**Estimated Effort:** 6-10 hours (additional to schema-versioning plan)

---

## Problem: Current Overwrite Behavior

### What Happens Now

```bash
# First audit
$ effect-migrate audit --amp-out .amp/effect-migrate
# Creates: .amp/effect-migrate/audit.json (revision: 1)

# Second audit (after fixing some issues)
$ effect-migrate audit --amp-out .amp/effect-migrate
# Overwrites: .amp/effect-migrate/audit.json (revision: 2)
# ❌ Lost: Previous state showing what was fixed
```

**Problems:**
- No historical record of migration progress
- Can't see what improved between audits
- Can't correlate audits with specific Amp threads where work happened
- Agent in new thread can't understand "what we did last time"

### What We Need

```bash
# First audit (in thread T-abc123)
$ effect-migrate audit --amp-out .amp/effect-migrate
# Creates:
#   .amp/effect-migrate/checkpoints/2025-11-06T10-00-00Z.json
#   .amp/effect-migrate/audit.json -> symlink to latest

# Second audit (in thread T-def456, after fixing issues)
$ effect-migrate audit --amp-out .amp/effect-migrate
# Creates:
#   .amp/effect-migrate/checkpoints/2025-11-06T11-30-00Z.json
#   Updates .amp/effect-migrate/audit.json -> points to new latest
#   Updates .amp/effect-migrate/index.json -> lists all checkpoints

# Agent reads index.json
$ cat .amp/effect-migrate/index.json
{
  "latestCheckpoint": "2025-11-06T11-30-00Z",
  "checkpoints": [
    {
      "timestamp": "2025-11-06T10:00:00Z",
      "thread": "T-abc123",
      "findings": { "errors": 45, "warnings": 120 }
    },
    {
      "timestamp": "2025-11-06T11:30:00Z",
      "thread": "T-def456",
      "findings": { "errors": 30, "warnings": 100 }
    }
  ]
}
```

---

## Architecture Design

### Directory Structure

```
.amp/effect-migrate/
├── index.json                    # Navigation index (MCP-compatible)
├── audit.json                    # Symlink to latest checkpoint
├── checkpoints/
│   ├── 2025-11-06T10-00-00Z.json # First audit
│   ├── 2025-11-06T11-30-00Z.json # Second audit
│   ├── 2025-11-06T14-15-00Z.json # Third audit
│   └── manifest.json             # Checkpoint metadata
├── threads.json                  # Thread registry (existing)
├── metrics.json                  # Overall metrics (existing)
└── badges.md                     # Progress badges (existing)
```

### File Schemas

#### 1. index.json (Updated)

**Purpose:** Entry point for agents, points to latest audit and lists checkpoint history.

```typescript
export const AmpContextIndex = Schema.Struct({
  /** Index format version */
  schemaVersion: Schema.String,
  
  /** Schema versions for artifacts */
  versions: Schema.Struct({
    audit: Schema.String,
    metrics: Schema.optional(Schema.String),
    threads: Schema.optional(Schema.String),
    checkpoints: Schema.String  // NEW
  }),
  
  /** effect-migrate package version */
  toolVersion: Schema.String,
  
  /** Project root directory */
  projectRoot: Schema.String,
  
  /** ISO timestamp */
  timestamp: Schema.DateTimeUtc,
  
  /** Latest checkpoint timestamp (ISO format) */
  latestCheckpoint: Schema.String,
  
  /** Checkpoint history summary (last 10) */
  checkpoints: Schema.Array(CheckpointSummary),
  
  /** Relative paths to artifacts */
  files: Schema.Struct({
    audit: Schema.String,           // Points to latest checkpoint or symlink
    checkpoints: Schema.String,     // Path to checkpoints/ directory
    manifest: Schema.String,        // Path to checkpoints/manifest.json
    metrics: Schema.optional(Schema.String),
    threads: Schema.optional(Schema.String),
    badges: Schema.optional(Schema.String)
  })
})

export const CheckpointSummary = Schema.Struct({
  /** Checkpoint timestamp (ISO format, used as ID) */
  timestamp: Schema.String,
  
  /** Amp thread ID if audit was run during a thread */
  thread: Schema.optional(Schema.String),
  
  /** Summary of findings */
  summary: Schema.Struct({
    errors: Schema.Number,
    warnings: Schema.Number,
    totalFiles: Schema.Number,
    totalFindings: Schema.Number
  }),
  
  /** Change from previous checkpoint */
  delta: Schema.optional(Schema.Struct({
    errors: Schema.Number,      // Positive = more errors, negative = fixed
    warnings: Schema.Number,
    totalFindings: Schema.Number
  }))
})
```

**Example output:**

```json
{
  "schemaVersion": "1.2.0",
  "versions": {
    "audit": "2.0.0",
    "checkpoints": "1.0.0",
    "metrics": "0.1.0",
    "threads": "1.0.0"
  },
  "toolVersion": "0.3.0",
  "projectRoot": ".",
  "timestamp": "2025-11-06T14:15:00.000Z",
  "latestCheckpoint": "2025-11-06T14-15-00Z",
  "checkpoints": [
    {
      "timestamp": "2025-11-06T10:00:00Z",
      "thread": "T-abc123",
      "summary": {
        "errors": 45,
        "warnings": 120,
        "totalFiles": 50,
        "totalFindings": 165
      }
    },
    {
      "timestamp": "2025-11-06T11:30:00Z",
      "thread": "T-def456",
      "summary": {
        "errors": 30,
        "warnings": 100,
        "totalFiles": 50,
        "totalFindings": 130
      },
      "delta": {
        "errors": -15,
        "warnings": -20,
        "totalFindings": -35
      }
    },
    {
      "timestamp": "2025-11-06T14:15:00Z",
      "summary": {
        "errors": 20,
        "warnings": 85,
        "totalFiles": 50,
        "totalFindings": 105
      },
      "delta": {
        "errors": -10,
        "warnings": -15,
        "totalFindings": -25
      }
    }
  ],
  "files": {
    "audit": "./audit.json",
    "checkpoints": "./checkpoints",
    "manifest": "./checkpoints/manifest.json",
    "metrics": "./metrics.json",
    "threads": "./threads.json",
    "badges": "./badges.md"
  }
}
```

#### 2. checkpoints/manifest.json

**Purpose:** Complete checkpoint history with metadata.

```typescript
export const CheckpointManifest = Schema.Struct({
  /** Manifest schema version */
  schemaVersion: Schema.String,
  
  /** Project root */
  projectRoot: Schema.String,
  
  /** All checkpoints (newest first) */
  checkpoints: Schema.Array(CheckpointMetadata)
})

export const CheckpointMetadata = Schema.Struct({
  /** Checkpoint ID (ISO timestamp) */
  id: Schema.String,
  
  /** ISO timestamp */
  timestamp: Schema.DateTimeUtc,
  
  /** Relative path to checkpoint file */
  path: Schema.String,
  
  /** Amp thread ID if audit was run during a thread */
  thread: Schema.optional(Schema.String),
  
  /** Audit schema version used for this checkpoint */
  schemaVersion: Schema.String,
  
  /** effect-migrate version that created checkpoint */
  toolVersion: Schema.String,
  
  /** Summary statistics */
  summary: Schema.Struct({
    errors: Schema.Number,
    warnings: Schema.Number,
    totalFiles: Schema.Number,
    totalFindings: Schema.Number
  }),
  
  /** Change from previous checkpoint */
  delta: Schema.optional(Schema.Struct({
    errors: Schema.Number,
    warnings: Schema.Number,
    totalFindings: Schema.Number
  })),
  
  /** User-provided description (optional) */
  description: Schema.optional(Schema.String),
  
  /** Tags for categorization */
  tags: Schema.optional(Schema.Array(Schema.String))
})
```

**Example:**

```json
{
  "schemaVersion": "1.0.0",
  "projectRoot": ".",
  "checkpoints": [
    {
      "id": "2025-11-06T14-15-00Z",
      "timestamp": "2025-11-06T14:15:00.000Z",
      "path": "./2025-11-06T14-15-00Z.json",
      "thread": "T-ghi789",
      "schemaVersion": "2.0.0",
      "toolVersion": "0.3.0",
      "summary": {
        "errors": 20,
        "warnings": 85,
        "totalFiles": 50,
        "totalFindings": 105
      },
      "delta": {
        "errors": -10,
        "warnings": -15,
        "totalFindings": -25
      },
      "tags": ["post-refactor", "boundaries-cleaned"]
    },
    {
      "id": "2025-11-06T11-30-00Z",
      "timestamp": "2025-11-06T11:30:00.000Z",
      "path": "./2025-11-06T11-30-00Z.json",
      "thread": "T-def456",
      "schemaVersion": "2.0.0",
      "toolVersion": "0.3.0",
      "summary": {
        "errors": 30,
        "warnings": 100,
        "totalFiles": 50,
        "totalFindings": 130
      },
      "delta": {
        "errors": -15,
        "warnings": -20,
        "totalFindings": -35
      },
      "tags": ["async-fixes"]
    }
  ]
}
```

#### 3. Individual Checkpoint File

**Purpose:** Full audit snapshot at a point in time.

```typescript
export const AuditCheckpoint = Schema.Struct({
  /** Same as AmpAuditContext from schema-versioning plan */
  
  /** Audit format version */
  schemaVersion: Schema.String,
  
  /** Checkpoint ID (matches filename) */
  checkpointId: Schema.String,
  
  /** effect-migrate package version */
  toolVersion: Schema.String,
  
  /** Project root directory */
  projectRoot: Schema.String,
  
  /** ISO timestamp */
  timestamp: Schema.DateTimeUtc,
  
  /** Amp thread ID if audit was run during a thread */
  thread: Schema.optional(Schema.String),
  
  /** Normalized findings (from schema-versioning plan) */
  findings: NormalizedFindings,
  
  /** Config snapshot */
  config: ConfigSnapshot,
  
  /** Thread references (all threads linked to this project) */
  threads: Schema.optional(Schema.Array(ThreadReference))
})
```

**Example:** `checkpoints/2025-11-06T14-15-00Z.json`

```json
{
  "schemaVersion": "2.0.0",
  "checkpointId": "2025-11-06T14-15-00Z",
  "toolVersion": "0.3.0",
  "projectRoot": ".",
  "timestamp": "2025-11-06T14:15:00.000Z",
  "thread": "T-ghi789",
  "findings": {
    "files": ["src/api/user.ts", "src/api/posts.ts"],
    "rules": [
      {
        "id": "no-async-await",
        "ruleKind": "pattern",
        "severity": "warning",
        "message": "Replace async/await with Effect.gen",
        "docsUrl": "https://effect.website/docs/guides/essentials/async",
        "tags": ["async", "migration"]
      }
    ],
    "results": [
      {
        "rule": 0,
        "file": 0,
        "range": [23, 5, 23, 19]
      }
    ],
    "groups": {
      "byFile": {
        "0": [0],
        "1": []
      },
      "byRule": {
        "0": [0]
      }
    },
    "summary": {
      "errors": 20,
      "warnings": 85,
      "totalFiles": 50,
      "totalFindings": 105
    }
  },
  "config": {
    "rulesEnabled": ["no-async-await", "no-promise", "no-class"],
    "failOn": ["error"]
  },
  "threads": [
    {
      "url": "https://ampcode.com/threads/T-abc123",
      "timestamp": "2025-11-06T10:00:00.000Z",
      "description": "Initial migration audit"
    },
    {
      "url": "https://ampcode.com/threads/T-def456",
      "timestamp": "2025-11-06T11:30:00.000Z",
      "description": "Fixed async/await patterns in user API"
    },
    {
      "url": "https://ampcode.com/threads/T-ghi789",
      "timestamp": "2025-11-06T14:15:00.000Z",
      "description": "Cleaned up boundary violations"
    }
  ]
}
```

---

## Implementation

### Phase 1: Checkpoint Infrastructure (Priority: P0, Effort: 2-3h)

**Objective:** Create checkpoint directory structure and manifest management.

#### Files Created

**`packages/cli/src/amp/checkpoint-manager.ts`:**

```typescript
/**
 * Checkpoint Manager - Manages audit checkpoint persistence and history.
 * 
 * @module @effect-migrate/cli/amp/checkpoint-manager
 * @since 0.3.0
 */

import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Clock from "effect/Clock"
import * as Console from "effect/Console"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SCHEMA_VERSIONS } from "@effect-migrate/core"
import type { RuleResult, Config } from "@effect-migrate/core"
import { normalizeResults, type NormalizedFindings } from "./schema.js"
import { readThreads, type ThreadsFile } from "./thread-manager.js"

/**
 * Generate checkpoint ID from timestamp.
 * Format: "2025-11-06T14-15-00Z" (filesystem-safe)
 */
export const generateCheckpointId = (timestamp: DateTime.DateTime): string => {
  const iso = DateTime.formatIso(timestamp)
  return iso.replace(/:/g, "-").replace(/\.\d{3}/, "")
}

/**
 * Checkpoint metadata schema.
 */
export const CheckpointMetadata = Schema.Struct({
  id: Schema.String,
  timestamp: Schema.DateTimeUtc,
  path: Schema.String,
  thread: Schema.optional(Schema.String),
  schemaVersion: Schema.String,
  toolVersion: Schema.String,
  summary: Schema.Struct({
    errors: Schema.Number,
    warnings: Schema.Number,
    totalFiles: Schema.Number,
    totalFindings: Schema.Number
  }),
  delta: Schema.optional(Schema.Struct({
    errors: Schema.Number,
    warnings: Schema.Number,
    totalFindings: Schema.Number
  })),
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String))
})

/**
 * Checkpoint manifest schema.
 */
export const CheckpointManifest = Schema.Struct({
  schemaVersion: Schema.String,
  projectRoot: Schema.String,
  checkpoints: Schema.Array(CheckpointMetadata)
})

export type CheckpointMetadata = typeof CheckpointMetadata.Type
export type CheckpointManifest = typeof CheckpointManifest.Type

/**
 * Read checkpoint manifest.
 */
export const readManifest = (outputDir: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const manifestPath = path.join(outputDir, "checkpoints", "manifest.json")
    
    const exists = yield* fs.exists(manifestPath)
    if (!exists) {
      // Return empty manifest
      return {
        schemaVersion: SCHEMA_VERSIONS.index,
        projectRoot: ".",
        checkpoints: []
      } satisfies CheckpointManifest
    }
    
    const content = yield* fs.readFileString(manifestPath)
    const manifest = yield* Schema.decodeUnknown(CheckpointManifest)(JSON.parse(content))
    return manifest
  })

/**
 * Write checkpoint manifest.
 */
export const writeManifest = (outputDir: string, manifest: CheckpointManifest) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    
    const checkpointsDir = path.join(outputDir, "checkpoints")
    yield* fs.makeDirectory(checkpointsDir, { recursive: true })
    
    const manifestPath = path.join(checkpointsDir, "manifest.json")
    const encoded = yield* Schema.encode(CheckpointManifest)(manifest)
    yield* fs.writeFileString(manifestPath, JSON.stringify(encoded, null, 2))
  })

/**
 * Calculate delta between two summaries.
 */
export const calculateDelta = (
  current: CheckpointMetadata["summary"],
  previous: CheckpointMetadata["summary"] | null
): CheckpointMetadata["delta"] | undefined => {
  if (!previous) return undefined
  
  return {
    errors: current.errors - previous.errors,
    warnings: current.warnings - previous.warnings,
    totalFindings: current.totalFindings - previous.totalFindings
  }
}

/**
 * Detect current Amp thread ID from environment.
 * 
 * Amp sets AMP_THREAD_ID when running commands during a thread.
 */
export const detectThreadId = (): string | undefined => {
  return process.env.AMP_THREAD_ID
}

/**
 * Create a new checkpoint.
 */
export const createCheckpoint = (
  outputDir: string,
  results: readonly RuleResult[],
  config: Config,
  options?: {
    description?: string
    tags?: string[]
  }
) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const now = yield* Clock.currentTimeMillis
    const timestamp = DateTime.unsafeMake(now)
    const checkpointId = generateCheckpointId(timestamp)
    
    // Detect thread ID
    const threadId = detectThreadId()
    
    // Get package metadata
    const pkgPath = path.join(import.meta.url, "../../../package.json")
    const pkgContent = yield* fs.readFileString(pkgPath)
    const pkg = JSON.parse(pkgContent)
    const toolVersion = pkg.version
    
    // Normalize findings
    const normalized = normalizeResults(results)
    
    // Read existing threads
    const threadsFile = yield* readThreads(outputDir).pipe(
      Effect.catchAll(() => Effect.succeed({ version: 1, threads: [] }))
    )
    
    // Build checkpoint content
    const checkpoint = {
      schemaVersion: SCHEMA_VERSIONS.audit,
      checkpointId,
      toolVersion,
      projectRoot: ".",
      timestamp,
      ...(threadId && { thread: threadId }),
      findings: normalized,
      config: {
        rulesEnabled: Array.from(new Set(results.map(r => r.id))),
        failOn: ["error"]  // TODO: Get from config
      },
      threads: threadsFile.threads.map(t => ({
        url: t.url,
        timestamp: t.createdAt,
        ...(t.description && { description: t.description })
      }))
    }
    
    // Write checkpoint file
    const checkpointsDir = path.join(outputDir, "checkpoints")
    yield* fs.makeDirectory(checkpointsDir, { recursive: true })
    
    const checkpointPath = path.join(checkpointsDir, `${checkpointId}.json`)
    yield* fs.writeFileString(checkpointPath, JSON.stringify(checkpoint, null, 2))
    
    // Read existing manifest
    const manifest = yield* readManifest(outputDir)
    
    // Calculate delta
    const previousSummary = manifest.checkpoints[0]?.summary ?? null
    const delta = calculateDelta(normalized.summary, previousSummary)
    
    // Create metadata
    const metadata: CheckpointMetadata = {
      id: checkpointId,
      timestamp,
      path: `./${checkpointId}.json`,
      ...(threadId && { thread: threadId }),
      schemaVersion: SCHEMA_VERSIONS.audit,
      toolVersion,
      summary: normalized.summary,
      ...(delta && { delta }),
      ...(options?.description && { description: options.description }),
      ...(options?.tags && { tags: options.tags })
    }
    
    // Update manifest (prepend new checkpoint)
    const updatedManifest: CheckpointManifest = {
      ...manifest,
      checkpoints: [metadata, ...manifest.checkpoints]
    }
    
    yield* writeManifest(outputDir, updatedManifest)
    
    // Update audit.json symlink (or copy on Windows)
    const auditPath = path.join(outputDir, "audit.json")
    const isWindows = process.platform === "win32"
    
    if (isWindows) {
      // Windows: copy file instead of symlink
      const checkpointContent = yield* fs.readFileString(checkpointPath)
      yield* fs.writeFileString(auditPath, checkpointContent)
    } else {
      // Unix: create symlink
      const relativeCheckpointPath = `./checkpoints/${checkpointId}.json`
      
      // Remove existing symlink/file
      const auditExists = yield* fs.exists(auditPath)
      if (auditExists) {
        yield* fs.remove(auditPath)
      }
      
      // Create new symlink
      yield* Effect.tryPromise({
        try: () => {
          const nodeFs = require("fs")
          return nodeFs.promises.symlink(relativeCheckpointPath, auditPath)
        },
        catch: (error) => new Error(`Failed to create symlink: ${error}`)
      })
    }
    
    yield* Console.log(`✓ Created checkpoint: ${checkpointId}`)
    if (threadId) {
      yield* Console.log(`  Linked to thread: ${threadId}`)
    }
    if (delta) {
      yield* Console.log(`  Delta: ${delta.errors >= 0 ? "+" : ""}${delta.errors} errors, ${delta.warnings >= 0 ? "+" : ""}${delta.warnings} warnings`)
    }
    
    return { checkpointId, metadata }
  })

/**
 * List checkpoints (newest first).
 */
export const listCheckpoints = (outputDir: string) =>
  Effect.gen(function*() {
    const manifest = yield* readManifest(outputDir)
    return manifest.checkpoints
  })

/**
 * Get latest checkpoint.
 */
export const getLatestCheckpoint = (outputDir: string) =>
  Effect.gen(function*() {
    const manifest = yield* readManifest(outputDir)
    return manifest.checkpoints[0] ?? null
  })

/**
 * Read a specific checkpoint.
 */
export const readCheckpoint = (outputDir: string, checkpointId: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    
    const checkpointPath = path.join(outputDir, "checkpoints", `${checkpointId}.json`)
    const content = yield* fs.readFileString(checkpointPath)
    return JSON.parse(content)
  })
```

#### Files Modified

**`packages/cli/src/amp/context-writer.ts`:**

```diff
+ import { createCheckpoint } from "./checkpoint-manager.js"

  export const writeAmpContext = (
    outputDir: string,
    results: readonly RuleResult[],
    config: Config
  ) =>
    Effect.gen(function*() {
-     // Old behavior: overwrite audit.json
-     const auditVersion = yield* getNextAuditVersion(outputDir)
-     const auditContent = { ... }
-     yield* fs.writeFileString(auditPath, JSON.stringify(auditContent, null, 2))
      
+     // New behavior: create checkpoint
+     const { checkpointId, metadata } = yield* createCheckpoint(outputDir, results, config)
      
+     // Update index.json with checkpoint summary
+     const manifest = yield* readManifest(outputDir)
+     const recentCheckpoints = manifest.checkpoints.slice(0, 10)  // Last 10
      
      const indexContent: AmpContextIndex = {
        schemaVersion: SCHEMA_VERSIONS.index,
        versions: {
          audit: SCHEMA_VERSIONS.audit,
+         checkpoints: SCHEMA_VERSIONS.index,
          metrics: SCHEMA_VERSIONS.metrics,
          threads: SCHEMA_VERSIONS.threads
        },
        toolVersion,
        projectRoot: ".",
        timestamp,
+       latestCheckpoint: checkpointId,
+       checkpoints: recentCheckpoints.map(cp => ({
+         timestamp: DateTime.formatIso(cp.timestamp),
+         thread: cp.thread,
+         summary: cp.summary,
+         delta: cp.delta
+       })),
        files: {
          audit: "./audit.json",
+         checkpoints: "./checkpoints",
+         manifest: "./checkpoints/manifest.json",
          metrics: "./metrics.json",
          threads: "./threads.json",
          badges: "./badges.md"
        }
      }
      
      yield* fs.writeFileString(indexPath, JSON.stringify(indexContent, null, 2))
    })
```

#### Tests

**`packages/cli/test/amp/checkpoint-manager.test.ts`:**

```typescript
import { expect, it } from "@effect/vitest"
import { Effect } from "effect"
import {
  createCheckpoint,
  readManifest,
  listCheckpoints,
  getLatestCheckpoint,
  generateCheckpointId
} from "../../src/amp/checkpoint-manager.js"
import type { RuleResult } from "@effect-migrate/core"

it.effect("creates checkpoint with metadata", () =>
  Effect.gen(function*() {
    const outputDir = yield* createTempDir()
    
    const results: RuleResult[] = [
      {
        id: "no-async",
        ruleKind: "pattern",
        severity: "warning",
        message: "Replace async/await",
        file: "src/api/user.ts",
        range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } }
      }
    ]
    
    const { checkpointId, metadata } = yield* createCheckpoint(outputDir, results, mockConfig)
    
    expect(checkpointId).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/)
    expect(metadata.summary.errors).toBe(0)
    expect(metadata.summary.warnings).toBe(1)
    expect(metadata.summary.totalFindings).toBe(1)
  })
)

it.effect("calculates delta from previous checkpoint", () =>
  Effect.gen(function*() {
    const outputDir = yield* createTempDir()
    
    // First checkpoint: 10 warnings
    yield* createCheckpoint(outputDir, generateResults(10, "warning"), mockConfig)
    
    // Second checkpoint: 5 warnings
    const { metadata } = yield* createCheckpoint(outputDir, generateResults(5, "warning"), mockConfig)
    
    expect(metadata.delta).toBeDefined()
    expect(metadata.delta!.warnings).toBe(-5)  // Improvement
  })
)

it.effect("links checkpoint to Amp thread", () =>
  Effect.gen(function*() {
    const outputDir = yield* createTempDir()
    
    // Simulate Amp environment
    process.env.AMP_THREAD_ID = "T-abc123"
    
    const { metadata } = yield* createCheckpoint(outputDir, [], mockConfig)
    
    expect(metadata.thread).toBe("T-abc123")
    
    delete process.env.AMP_THREAD_ID
  })
)

it.effect("lists checkpoints newest first", () =>
  Effect.gen(function*() {
    const outputDir = yield* createTempDir()
    
    yield* createCheckpoint(outputDir, [], mockConfig)
    yield* Effect.sleep("100 millis")
    yield* createCheckpoint(outputDir, [], mockConfig)
    yield* Effect.sleep("100 millis")
    yield* createCheckpoint(outputDir, [], mockConfig)
    
    const checkpoints = yield* listCheckpoints(outputDir)
    
    expect(checkpoints).toHaveLength(3)
    // Verify newest first
    expect(checkpoints[0].timestamp.getTime()).toBeGreaterThan(checkpoints[1].timestamp.getTime())
    expect(checkpoints[1].timestamp.getTime()).toBeGreaterThan(checkpoints[2].timestamp.getTime())
  })
)
```

#### Success Criteria

- [ ] `createCheckpoint` creates checkpoint file in `checkpoints/` directory
- [ ] `manifest.json` tracks all checkpoints
- [ ] `audit.json` symlinks to latest checkpoint (or copies on Windows)
- [ ] Thread ID detected from `AMP_THREAD_ID` environment variable
- [ ] Delta calculated correctly from previous checkpoint
- [ ] Tests pass for checkpoint creation and listing

---

### Phase 2: CLI Integration (Priority: P1, Effort: 1-2h)

**Objective:** Update audit command to use checkpoints, provide checkpoint management commands.

#### Files Modified

**`packages/cli/src/commands/audit.ts`:**

```diff
  const auditCommand = Command.make("audit", options, (opts) =>
    Effect.gen(function*() {
      // ... load config, run rules ...
      
      if (opts.ampOut) {
-       yield* writeAmpContext(opts.ampOut, results, config)
+       // writeAmpContext now creates checkpoint internally
+       yield* writeAmpContext(opts.ampOut, results, config)
        yield* Console.log(`✓ Wrote Amp context to ${opts.ampOut}`)
+       yield* Console.log(`  View checkpoint history: effect-migrate checkpoints list`)
      }
      
      // ... format output ...
    })
  )
```

#### New Commands

**`packages/cli/src/commands/checkpoints.ts`:**

```typescript
/**
 * Checkpoint management commands.
 * 
 * @module @effect-migrate/cli/commands/checkpoints
 * @since 0.3.0
 */

import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Args from "@effect/cli/Args"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as DateTime from "effect/DateTime"
import {
  listCheckpoints,
  getLatestCheckpoint,
  readCheckpoint,
  readManifest
} from "../amp/checkpoint-manager.js"
import Table from "cli-table3"

const ampOutOption = Options.directory("amp-out").pipe(
  Options.withDefault(".amp/effect-migrate")
)

/**
 * List all checkpoints.
 */
const listCommand = Command.make("list", { ampOut: ampOutOption }, (opts) =>
  Effect.gen(function*() {
    const checkpoints = yield* listCheckpoints(opts.ampOut)
    
    if (checkpoints.length === 0) {
      yield* Console.log("No checkpoints found. Run 'effect-migrate audit --amp-out .amp' to create one.")
      return
    }
    
    const table = new Table({
      head: ["Timestamp", "Thread", "Errors", "Warnings", "Total", "Delta"],
      colWidths: [25, 12, 8, 10, 8, 15]
    })
    
    for (const cp of checkpoints) {
      table.push([
        DateTime.formatIso(cp.timestamp),
        cp.thread ?? "-",
        cp.summary.errors.toString(),
        cp.summary.warnings.toString(),
        cp.summary.totalFindings.toString(),
        cp.delta
          ? `${cp.delta.errors >= 0 ? "+" : ""}${cp.delta.errors} / ${cp.delta.warnings >= 0 ? "+" : ""}${cp.delta.warnings}`
          : "-"
      ])
    }
    
    yield* Console.log(table.toString())
  })
)

/**
 * Show details of a specific checkpoint.
 */
const showCommand = Command.make(
  "show",
  {
    ampOut: ampOutOption,
    checkpoint: Args.text({ name: "checkpoint-id" })
  },
  (opts) =>
    Effect.gen(function*() {
      const checkpoint = yield* readCheckpoint(opts.ampOut, opts.checkpoint)
      
      yield* Console.log(JSON.stringify(checkpoint, null, 2))
    })
)

/**
 * Show latest checkpoint.
 */
const latestCommand = Command.make("latest", { ampOut: ampOutOption }, (opts) =>
  Effect.gen(function*() {
    const latest = yield* getLatestCheckpoint(opts.ampOut)
    
    if (!latest) {
      yield* Console.log("No checkpoints found.")
      return
    }
    
    yield* Console.log(`Latest checkpoint: ${latest.id}`)
    yield* Console.log(`  Timestamp: ${DateTime.formatIso(latest.timestamp)}`)
    if (latest.thread) {
      yield* Console.log(`  Thread: ${latest.thread}`)
    }
    yield* Console.log(`  Errors: ${latest.summary.errors}`)
    yield* Console.log(`  Warnings: ${latest.summary.warnings}`)
    yield* Console.log(`  Total findings: ${latest.summary.totalFindings}`)
    
    if (latest.delta) {
      const errorsSign = latest.delta.errors >= 0 ? "+" : ""
      const warningsSign = latest.delta.warnings >= 0 ? "+" : ""
      yield* Console.log(`  Delta: ${errorsSign}${latest.delta.errors} errors, ${warningsSign}${latest.delta.warnings} warnings`)
    }
  })
)

/**
 * Compare two checkpoints.
 */
const diffCommand = Command.make(
  "diff",
  {
    ampOut: ampOutOption,
    from: Args.text({ name: "from-checkpoint-id" }),
    to: Args.text({ name: "to-checkpoint-id" }).pipe(Args.optional)
  },
  (opts) =>
    Effect.gen(function*() {
      const fromCheckpoint = yield* readCheckpoint(opts.ampOut, opts.from)
      const toCheckpoint = opts.to
        ? yield* readCheckpoint(opts.ampOut, opts.to)
        : yield* getLatestCheckpoint(opts.ampOut).pipe(
            Effect.flatMap(latest => latest ? readCheckpoint(opts.ampOut, latest.id) : Effect.fail(new Error("No latest checkpoint")))
          )
      
      const fromSummary = fromCheckpoint.findings.summary
      const toSummary = toCheckpoint.findings.summary
      
      yield* Console.log(`Comparing checkpoints:`)
      yield* Console.log(`  From: ${fromCheckpoint.checkpointId}`)
      yield* Console.log(`  To:   ${toCheckpoint.checkpointId}`)
      yield* Console.log(``)
      yield* Console.log(`Errors:   ${fromSummary.errors} → ${toSummary.errors} (${toSummary.errors - fromSummary.errors >= 0 ? "+" : ""}${toSummary.errors - fromSummary.errors})`)
      yield* Console.log(`Warnings: ${fromSummary.warnings} → ${toSummary.warnings} (${toSummary.warnings - fromSummary.warnings >= 0 ? "+" : ""}${toSummary.warnings - fromSummary.warnings})`)
      yield* Console.log(`Total:    ${fromSummary.totalFindings} → ${toSummary.totalFindings} (${toSummary.totalFindings - fromSummary.totalFindings >= 0 ? "+" : ""}${toSummary.totalFindings - fromSummary.totalFindings})`)
    })
)

/**
 * Checkpoints subcommand.
 */
export const checkpointsCommand = Command.make("checkpoints").pipe(
  Command.withSubcommands([listCommand, showCommand, latestCommand, diffCommand])
)
```

**Register in main CLI:**

```diff
// packages/cli/src/index.ts
+ import { checkpointsCommand } from "./commands/checkpoints.js"

  const cli = Command.make("effect-migrate").pipe(
    Command.withSubcommands([
      auditCommand,
      metricsCommand,
      docsCommand,
      initCommand,
+     checkpointsCommand
    ])
  )
```

#### Usage Examples

```bash
# Create checkpoint (automatic during audit)
$ effect-migrate audit --amp-out .amp/effect-migrate

# List all checkpoints
$ effect-migrate checkpoints list
┌─────────────────────────┬────────────┬────────┬──────────┬────────┬───────────────┐
│ Timestamp               │ Thread     │ Errors │ Warnings │ Total  │ Delta         │
├─────────────────────────┼────────────┼────────┼──────────┼────────┼───────────────┤
│ 2025-11-06T14:15:00Z    │ T-ghi789   │ 20     │ 85       │ 105    │ -10 / -15     │
│ 2025-11-06T11:30:00Z    │ T-def456   │ 30     │ 100      │ 130    │ -15 / -20     │
│ 2025-11-06T10:00:00Z    │ T-abc123   │ 45     │ 120      │ 165    │ -            │
└─────────────────────────┴────────────┴────────┴──────────┴────────┴───────────────┘

# Show latest checkpoint
$ effect-migrate checkpoints latest
Latest checkpoint: 2025-11-06T14-15-00Z
  Timestamp: 2025-11-06T14:15:00Z
  Thread: T-ghi789
  Errors: 20
  Warnings: 85
  Total findings: 105
  Delta: -10 errors, -15 warnings

# Show specific checkpoint
$ effect-migrate checkpoints show 2025-11-06T10-00-00Z
{
  "schemaVersion": "2.0.0",
  "checkpointId": "2025-11-06T10-00-00Z",
  ...
}

# Compare checkpoints
$ effect-migrate checkpoints diff 2025-11-06T10-00-00Z 2025-11-06T14-15-00Z
Comparing checkpoints:
  From: 2025-11-06T10-00-00Z
  To:   2025-11-06T14-15-00Z

Errors:   45 → 20 (-25)
Warnings: 120 → 85 (-35)
Total:    165 → 105 (-60)
```

#### Success Criteria

- [ ] `audit` command creates checkpoints automatically
- [ ] `checkpoints list` shows checkpoint history
- [ ] `checkpoints latest` shows most recent checkpoint
- [ ] `checkpoints diff` compares two checkpoints
- [ ] Tests pass for all checkpoint commands

---

### Phase 3: Amp Thread Detection (Priority: P1, Effort: 1h)

**Objective:** Automatically detect and link Amp thread when audit is run.

#### Implementation

**Environment Variable Detection:**

Amp sets `AMP_THREAD_ID` when running commands during a thread:

```bash
# When user runs command in Amp thread T-abc123:
$ effect-migrate audit --amp-out .amp
# Amp sets: AMP_THREAD_ID=T-abc123
# Checkpoint automatically linked to thread
```

**Thread Detection Logic (already in checkpoint-manager.ts):**

```typescript
export const detectThreadId = (): string | undefined => {
  return process.env.AMP_THREAD_ID
}
```

**Auto-register Thread:**

```typescript
// In createCheckpoint
const threadId = detectThreadId()

if (threadId) {
  // Auto-add to threads.json if not already registered
  const threadsFile = yield* readThreads(outputDir).pipe(
    Effect.catchAll(() => Effect.succeed({ version: 1, threads: [] }))
  )
  
  const threadExists = threadsFile.threads.some(t => t.url.includes(threadId))
  
  if (!threadExists) {
    const newThread: ThreadEntry = {
      url: `https://ampcode.com/threads/${threadId}`,
      createdAt: timestamp,
      description: "Auto-linked from audit checkpoint"
    }
    
    const updated: ThreadsFile = {
      ...threadsFile,
      threads: [...threadsFile.threads, newThread]
    }
    
    yield* writeThreads(outputDir, updated)
  }
}
```

#### Success Criteria

- [ ] `AMP_THREAD_ID` environment variable detected
- [ ] Checkpoint automatically linked to thread
- [ ] Thread auto-registered in `threads.json` if new
- [ ] Works seamlessly during Amp coding sessions

---

### Phase 4: Agent Guidance (Priority: P2, Effort: 1h)

**Objective:** Ensure AI coding agents can easily find and use checkpoints.

#### AGENTS.md Updates

**`AGENTS.md`:**

```diff
  ## Amp Integration
  
+ ### Checkpoint-Based Audits
+ 
+ effect-migrate persists audit checkpoints over time, enabling agents to track migration progress across sessions.
+ 
+ **Finding the latest audit:**
+ 
+ 1. Read `@.amp/effect-migrate/index.json`
+ 2. Use `latestCheckpoint` field to identify most recent audit
+ 3. Read `@.amp/effect-migrate/audit.json` (symlink to latest checkpoint)
+ 
+ **Understanding checkpoint history:**
+ 
+ ```typescript
+ // Read index.json
+ const index = JSON.parse(fs.readFileSync(".amp/effect-migrate/index.json", "utf-8"))
+ 
+ // Get latest checkpoint
+ const latest = index.latestCheckpoint  // e.g., "2025-11-06T14-15-00Z"
+ 
+ // See recent history (last 10 checkpoints)
+ for (const cp of index.checkpoints) {
+   console.log(`${cp.timestamp}: ${cp.summary.errors} errors, ${cp.summary.warnings} warnings`)
+   if (cp.thread) {
+     console.log(`  Linked to thread: ${cp.thread}`)
+   }
+ }
+ ```
+ 
+ **Reading a specific checkpoint:**
+ 
+ ```typescript
+ const checkpoint = JSON.parse(
+   fs.readFileSync(`.amp/effect-migrate/checkpoints/${checkpointId}.json`, "utf-8")
+ )
+ ```
+ 
+ **When running audit:**
+ 
+ If you run `effect-migrate audit` during an Amp thread, the checkpoint is automatically linked to the thread via `AMP_THREAD_ID`.
+ 
  ### Migration Context
  
  See @.amp/effect-migrate/index.json for migration context and resources.
+ 
+ **Key fields:**
+ - `latestCheckpoint`: Most recent audit timestamp
+ - `checkpoints`: Recent checkpoint history (last 10)
+ - `files.checkpoints`: Path to checkpoints directory
+ - `files.manifest`: Path to complete checkpoint manifest
```

#### Console Guidance

**When agent reads audit.json:**

```bash
# Add hint in audit.json
$ cat .amp/effect-migrate/audit.json
{
  "_note": "This is the latest checkpoint. See .amp/effect-migrate/checkpoints/ for history.",
  "checkpointId": "2025-11-06T14-15-00Z",
  ...
}
```

#### Success Criteria

- [ ] AGENTS.md documents checkpoint usage for AI agents
- [ ] Examples show how to read checkpoints
- [ ] Guidance on finding latest audit
- [ ] Clear explanation of thread linking

---

## Integration with Schema Versioning Plan

This plan **extends** the [schema-versioning-and-normalization.md](./schema-versioning-and-normalization.md) plan:

**Dependencies:**
1. Normalized audit schema (from schema-versioning plan) is used for checkpoint files
2. Version registry (from schema-versioning plan) includes checkpoint versions
3. Checkpoint files use the same `AmpAuditContext` schema with normalized findings

**Combined Implementation:**
- Implement schema-versioning plan first (Phases 0-2)
- Then implement checkpoint persistence (Phases 1-4 of this plan)
- Total effort: 14-22 hours (1-2 weeks)

---

## Cleanup and Retention

### Checkpoint Retention Policy

**Default:** Keep all checkpoints (users can manually delete old ones)

**Future consideration:** Add retention options:

```typescript
// In config
{
  "checkpoints": {
    "maxCount": 50,           // Keep last 50 checkpoints
    "maxAge": "90 days",      // Keep checkpoints from last 90 days
    "keepThreadLinked": true  // Always keep checkpoints linked to threads
  }
}
```

**Cleanup command:**

```bash
# Future
$ effect-migrate checkpoints clean --keep 30
Removed 15 old checkpoints, kept 30 most recent.
```

---

## Testing Strategy

### Unit Tests

**Checkpoint creation:**
```bash
pnpm test --filter @effect-migrate/cli amp/checkpoint-manager.test.ts
```

**Manifest management:**
```bash
pnpm test --filter @effect-migrate/cli amp/checkpoint-manager.test.ts
```

### Integration Tests

**Full workflow:**
```bash
pnpm test --filter @effect-migrate/cli commands/checkpoints.test.ts
```

**Thread detection:**
```bash
AMP_THREAD_ID=T-test-123 pnpm effect-migrate audit --amp-out .amp/test
# Verify checkpoint linked to thread
```

### Manual Testing

**Multi-session workflow:**

```bash
# Session 1 (thread T-abc123)
AMP_THREAD_ID=T-abc123 pnpm effect-migrate audit --amp-out .amp
# Verify checkpoint created with thread link

# Make some fixes...

# Session 2 (thread T-def456)
AMP_THREAD_ID=T-def456 pnpm effect-migrate audit --amp-out .amp
# Verify new checkpoint, delta calculated

# View history
pnpm effect-migrate checkpoints list
# Verify both checkpoints shown

# Compare
pnpm effect-migrate checkpoints diff <first-id> <second-id>
# Verify delta shown correctly
```

---

## Success Criteria

### Functional

- [ ] Checkpoints created in `checkpoints/` directory
- [ ] `manifest.json` tracks all checkpoints
- [ ] `audit.json` points to latest (symlink or copy)
- [ ] `index.json` includes checkpoint history
- [ ] Thread ID auto-detected from `AMP_THREAD_ID`
- [ ] Delta calculated between consecutive checkpoints
- [ ] CLI commands for listing, showing, comparing checkpoints

### Performance

- [ ] Checkpoint creation adds <100ms to audit runtime
- [ ] Checkpoint files use normalized schema (50-70% size reduction)
- [ ] Manifest reads <50ms for 100 checkpoints

### Developer Experience

- [ ] Clear console output on checkpoint creation
- [ ] Easy CLI commands for viewing history
- [ ] AGENTS.md guidance for AI agents
- [ ] Examples in documentation

---

## Future Enhancements

### Checkpoint Metadata Enrichment

**Auto-detect migration milestones:**

```typescript
// Detect when all errors are fixed
if (metadata.summary.errors === 0 && previousSummary.errors > 0) {
  metadata.tags.push("zero-errors-achieved")
}

// Detect significant improvements
if (metadata.delta && Math.abs(metadata.delta.totalFindings) > 50) {
  metadata.tags.push("major-improvement")
}
```

### Visual Progress

**Generate progress charts:**

```bash
$ effect-migrate checkpoints chart
Generating progress chart...

Errors over time:
  45 ┤           ╭──
  40 ┤       ╭───╯
  35 ┤     ╭─╯
  30 ┤   ╭─╯
  25 ┤ ╭─╯
  20 ┼─╯
     └──────────────────
     10:00  11:30  14:15
```

### Checkpoint Annotations

**Allow users to annotate checkpoints:**

```bash
$ effect-migrate checkpoints annotate 2025-11-06T14-15-00Z \
  --description "Completed async/await migration" \
  --tags "milestone,async-complete"
```

---

**Last Updated:** 2025-11-06  
**Maintainer:** @aridyckovsky  
**Status:** Ready for implementation  
**Thread:** https://ampcode.com/threads/T-5d39c44c-3f5e-4112-b0b1-d9b9add1eea7
