---
created: 2025-11-06
lastUpdated: 2025-11-06
author: Generated via Amp (Oracle + Librarian comprehensive analysis)
status: ready
thread: https://ampcode.com/threads/T-5bd34c50-9752-4d71-8768-e8290de2c380
audience: Development team and AI coding agents
tags: [pr-plan, architecture, services, wave2, effect-ts, dependency-injection]
related:
  - ./checkpoint-based-audit-persistence.md
  - ./comprehensive-data-architecture.md
  - ../../AGENTS.md
---

# PR5: CheckpointStore Service Abstraction

## Goal

Create Effect Context/Layer abstraction for checkpoint persistence, establishing a clean port/adapter architecture that enables pluggable backends (JSON, SQLite) while maintaining type safety and testability.

**Estimated Effort:** 3-5 hours

**Priority:** P1 (Wave 2, Architecture)

**Dependencies:** 
- PR3 (JSON Checkpoints) - **MUST be merged first**
- Uses PR1 version registry and PR2 normalized schema

---

## Overview

Currently, checkpoint logic is directly embedded in the context writer. This PR extracts checkpoint operations into a formal Effect service, applying hexagonal architecture principles:

**Before (PR3 state):**
```typescript
// packages/cli/src/amp/context-writer.ts
export const writeCheckpoint = (checkpoint: AuditCheckpoint) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    // Direct file system operations...
    yield* fs.writeFileString(checkpointPath, JSON.stringify(checkpoint))
  })
```

**After (PR5):**
```typescript
// Dependency injection - swap backends without changing consumers
export const writeAuditContext = Effect.gen(function* () {
  const store = yield* CheckpointStore  // Port abstraction
  yield* store.writeCheckpoint(checkpoint, normalized, metadata)
})

// Layer composition
const program = writeAuditContext.pipe(
  Effect.provide(JsonCheckpointStoreLive)  // Adapter implementation
)
```

**Benefits:**
1. **Testability** - Mock the service interface for unit tests
2. **Flexibility** - Swap JSON for SQLite without touching CLI code
3. **Type Safety** - Effect's type system enforces error handling
4. **Reusability** - Same port interface for all backends
5. **Maintainability** - Clear separation of concerns

---

## Architecture: Ports and Adapters

### Service Interface (Port)

```
┌─────────────────────────────────────────────────────────────┐
│                   CLI Commands Layer                        │
│         (audit command, context writer)                     │
└─────────────────────────────────────────────────────────────┘
                           ▼
                    (depends on port)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              CheckpointStore (Port Interface)               │
│                                                             │
│  writeCheckpoint(checkpoint, normalized, metadata)          │
│  latest() → Option<CheckpointSummary>                       │
│  list(limit?) → CheckpointSummary[]                         │
│  read(id) → AuditCheckpoint                                 │
│  diff(fromId, toId) → DeltaSummary                          │
│                                                             │
│  All return Effect.Effect<A, CheckpointError, never>        │
└─────────────────────────────────────────────────────────────┘
                           ▼
                   (implemented by)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                Adapter Implementations                      │
│                                                             │
│  JsonCheckpointStoreLive    (PR5 - filesystem)              │
│  SqliteCheckpointStoreLive  (PR6 - database)                │
│  InMemoryCheckpointStore    (Tests only)                    │
└─────────────────────────────────────────────────────────────┘
```

### Type Dependencies

```typescript
// Core types (already exist from PR2/PR3)
import type { AuditCheckpoint } from "./schema/checkpoint.js"
import type { NormalizedAudit } from "./schema/normalized.js"

// Service defines behavior, not data
export interface CheckpointStoreService {
  readonly writeCheckpoint: (
    checkpoint: AuditCheckpoint,
    normalized: NormalizedAudit,
    metadata: CheckpointMetadata
  ) => Effect.Effect<void, CheckpointError>

  readonly latest: () => Effect.Effect<Option.Option<CheckpointSummary>, CheckpointError>
  
  readonly list: (limit?: number) => Effect.Effect<readonly CheckpointSummary[], CheckpointError>
  
  readonly read: (id: string) => Effect.Effect<AuditCheckpoint, CheckpointError>
  
  readonly diff: (
    fromId: string,
    toId: string
  ) => Effect.Effect<DeltaSummary, CheckpointError>
}
```

---

## Implementation Order

### Phase 1: Define Port Interface (45 min)

**Goal:** Establish service contract with proper Effect-TS patterns.

#### File: `packages/core/src/services/CheckpointStore.ts` (NEW)

**Purpose:** Port interface for checkpoint persistence (behavior contract).

**Code:**

```typescript
/**
 * CheckpointStore Service - Port abstraction for checkpoint persistence.
 * 
 * **Hexagonal Architecture:**
 * - This is a PORT (interface) not an ADAPTER (implementation)
 * - CLI depends on this interface, not concrete implementations
 * - Adapters: JsonCheckpointStoreLive (filesystem), SqliteCheckpointStoreLive (database)
 * 
 * **Design Principles:**
 * 1. Port defines behavior contract (methods + signatures)
 * 2. Adapters implement the port for specific backends
 * 3. Consumers depend on port, not adapters
 * 4. Testing uses InMemoryCheckpointStore mock
 * 
 * @module @effect-migrate/core/services/CheckpointStore
 * @since 0.4.0
 */

import { Context, Effect, Option, Data } from "effect"
import type { PlatformError } from "@effect/platform/Error"
import type { AuditCheckpoint } from "../schema/checkpoint.js"
import type { NormalizedAudit } from "../schema/normalized.js"

/**
 * Checkpoint persistence errors.
 */
export class CheckpointError extends Data.TaggedError("CheckpointError")<{
  readonly reason: string
  readonly path?: string
  readonly checkpointId?: string
  readonly cause?: unknown
}> {}

/**
 * Metadata for checkpoint persistence operations.
 */
export interface CheckpointMetadata {
  /** Audit runtime in milliseconds */
  readonly durationMs?: number
  /** Memory RSS in megabytes */
  readonly memoryRssMb?: number
  /** CPU time in milliseconds */
  readonly cpuTimeMs?: number
}

/**
 * Checkpoint summary for listings and index.
 */
export interface CheckpointSummary {
  /** ISO timestamp (e.g., "2025-11-06T10-00-00Z") */
  readonly checkpointId: string
  /** ISO datetime */
  readonly timestamp: string
  /** Amp thread ID (if available) */
  readonly thread?: string
  /** Tool version */
  readonly toolVersion: string
  /** Schema version */
  readonly schemaVersion: string
  /** Findings summary */
  readonly summary: {
    readonly errors: number
    readonly warnings: number
    readonly totalFiles: number
    readonly totalFindings: number
  }
  /** Performance metadata */
  readonly metadata?: CheckpointMetadata
}

/**
 * Delta between two checkpoints.
 */
export interface DeltaSummary {
  readonly from: CheckpointSummary
  readonly to: CheckpointSummary
  readonly delta: {
    readonly errors: number
    readonly warnings: number
    readonly files: number
    readonly findings: number
  }
  readonly durationMs?: number
}

/**
 * CheckpointStore service interface (PORT).
 * 
 * **IMPORTANT:** Export this interface for consumers to import.
 * See AGENTS.md "Effect-TS Best Practices" #4 for service pattern.
 */
export interface CheckpointStoreService {
  /**
   * Write checkpoint to persistent storage.
   * 
   * **Implementation requirements:**
   * - Atomically write checkpoint file
   * - Update manifest with summary
   * - Update audit.json symlink/copy to latest
   * - Update index.json with checkpoint history
   * - Auto-detect AMP_THREAD_ID from environment
   * 
   * @param checkpoint - Full checkpoint data
   * @param normalized - Normalized audit data (for efficient storage)
   * @param metadata - Performance metrics
   * @returns Effect that completes when checkpoint is persisted
   */
  readonly writeCheckpoint: (
    checkpoint: AuditCheckpoint,
    normalized: NormalizedAudit,
    metadata: CheckpointMetadata
  ) => Effect.Effect<void, CheckpointError>

  /**
   * Get latest checkpoint summary.
   * 
   * @returns Effect containing optional summary (None if no checkpoints exist)
   */
  readonly latest: () => Effect.Effect<Option.Option<CheckpointSummary>, CheckpointError>

  /**
   * List checkpoint summaries (newest first).
   * 
   * @param limit - Maximum number of checkpoints to return (default: all)
   * @returns Effect containing array of summaries
   */
  readonly list: (limit?: number) => Effect.Effect<readonly CheckpointSummary[], CheckpointError>

  /**
   * Read full checkpoint by ID.
   * 
   * @param id - Checkpoint ID (ISO timestamp)
   * @returns Effect containing full checkpoint data
   */
  readonly read: (id: string) => Effect.Effect<AuditCheckpoint, CheckpointError>

  /**
   * Compute delta between two checkpoints.
   * 
   * @param fromId - Earlier checkpoint ID
   * @param toId - Later checkpoint ID
   * @returns Effect containing delta summary
   */
  readonly diff: (
    fromId: string,
    toId: string
  ) => Effect.Effect<DeltaSummary, CheckpointError>
}

/**
 * CheckpointStore service tag.
 * 
 * **Usage:**
 * 
 * ```typescript
 * // In consumers
 * const program = Effect.gen(function* () {
 *   const store = yield* CheckpointStore
 *   yield* store.writeCheckpoint(checkpoint, normalized, metadata)
 * })
 * 
 * // Provide implementation
 * program.pipe(Effect.provide(JsonCheckpointStoreLive))
 * ```
 */
export class CheckpointStore extends Context.Tag("CheckpointStore")<
  CheckpointStore,
  CheckpointStoreService
>() {}
```

**Estimated Lines:** ~180 LOC

**Key Design Points:**

1. **Export service interface** - `CheckpointStoreService` is exported for consumers
2. **Tagged error** - `CheckpointError extends Data.TaggedError` for type-safe error handling
3. **Context.Tag pattern** - Tag references the interface, not implementation
4. **Return types** - All methods return `Effect.Effect<A, CheckpointError>`
5. **Metadata separation** - Performance metrics kept separate from core checkpoint data

---

### Phase 2: Refactor JSON Implementation as Layer (90 min)

**Goal:** Extract existing PR3 checkpoint logic into `JsonCheckpointStoreLive` Layer.

#### File: `packages/core/src/services/JsonCheckpointStore.ts` (NEW)

**Purpose:** Filesystem-based adapter for CheckpointStore port.

**Code:**

```typescript
/**
 * JsonCheckpointStoreLive - Filesystem adapter for checkpoint persistence.
 * 
 * **Implementation Strategy:**
 * - Writes checkpoints as individual JSON files
 * - Maintains manifest.json for O(1) metadata access
 * - Symlinks audit.json to latest (copies on Windows)
 * - Updates index.json with checkpoint history
 * 
 * **Performance Targets:**
 * - Write duration: <400ms (10k findings)
 * - Memory peak: <50MB
 * - File size: 1-4MB (normalized schema)
 * 
 * @module @effect-migrate/core/services/JsonCheckpointStore
 * @since 0.4.0
 */

import { Effect, Layer, Option, pipe } from "effect"
import { FileSystem, Path } from "@effect/platform"
import type { CheckpointStoreService } from "./CheckpointStore.js"
import { CheckpointStore, CheckpointError } from "./CheckpointStore.js"
import type { AuditCheckpoint } from "../schema/checkpoint.js"
import type { NormalizedAudit } from "../schema/normalized.js"
import type { CheckpointMetadata, CheckpointSummary, DeltaSummary } from "./CheckpointStore.js"
import { SCHEMA_VERSIONS } from "../schema/versions.js"

/**
 * Manifest schema (tracks all checkpoints for fast listing).
 */
interface CheckpointManifest {
  readonly schemaVersion: string
  readonly checkpoints: readonly CheckpointSummary[]
}

/**
 * Read manifest from checkpoints directory.
 */
const readManifest = (
  checkpointsDir: string
): Effect.Effect<CheckpointManifest, CheckpointError> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const manifestPath = path.join(checkpointsDir, "manifest.json")

    const exists = yield* fs.exists(manifestPath)
    if (!exists) {
      return {
        schemaVersion: SCHEMA_VERSIONS.checkpoints,
        checkpoints: []
      }
    }

    const content = yield* fs
      .readFileString(manifestPath)
      .pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new CheckpointError({
              reason: "Failed to read manifest",
              path: manifestPath,
              cause: error
            })
          )
        )
      )

    try {
      return JSON.parse(content) as CheckpointManifest
    } catch (error) {
      return yield* Effect.fail(
        new CheckpointError({
          reason: "Invalid manifest JSON",
          path: manifestPath,
          cause: error
        })
      )
    }
  })

/**
 * Write manifest to checkpoints directory.
 */
const writeManifest = (
  checkpointsDir: string,
  manifest: CheckpointManifest
): Effect.Effect<void, CheckpointError> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const manifestPath = path.join(checkpointsDir, "manifest.json")

    const content = JSON.stringify(manifest, null, 2)
    yield* fs
      .writeFileString(manifestPath, content)
      .pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new CheckpointError({
              reason: "Failed to write manifest",
              path: manifestPath,
              cause: error
            })
          )
        )
      )
  })

/**
 * Create checkpoint ID from timestamp (ISO format for filenames).
 */
const createCheckpointId = (): string => {
  const now = new Date()
  return now.toISOString().replace(/:/g, "-").split(".")[0] + "Z"
}

/**
 * Auto-detect Amp thread ID from environment.
 */
const detectThreadId = (): Option.Option<string> => {
  const threadId = process.env.AMP_THREAD_ID
  return threadId ? Option.some(threadId) : Option.none()
}

/**
 * JSON checkpoint store layer (filesystem adapter).
 * 
 * **Constructor parameters:**
 * @param baseDir - Base directory for checkpoints (e.g., ".amp/effect-migrate")
 */
export const makeJsonCheckpointStoreLive = (baseDir: string): Layer.Layer<CheckpointStore> =>
  Layer.effect(
    CheckpointStore,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const checkpointsDir = path.join(baseDir, "checkpoints")

      // Ensure checkpoints directory exists
      yield* fs.makeDirectory(checkpointsDir, { recursive: true })

      return CheckpointStore.of({
        writeCheckpoint: (checkpoint, normalized, metadata) =>
          Effect.gen(function* () {
            const checkpointId = createCheckpointId()
            const thread = detectThreadId()
            const checkpointPath = path.join(checkpointsDir, `${checkpointId}.json`)

            // Build checkpoint summary
            const summary: CheckpointSummary = {
              checkpointId,
              timestamp: new Date().toISOString(),
              thread: Option.getOrUndefined(thread),
              toolVersion: checkpoint.toolVersion,
              schemaVersion: checkpoint.schemaVersion,
              summary: {
                errors: normalized.summary.errors,
                warnings: normalized.summary.warnings,
                totalFiles: normalized.summary.totalFiles,
                totalFindings: normalized.summary.totalFindings
              },
              metadata
            }

            // Augment checkpoint with ID and thread
            const fullCheckpoint: AuditCheckpoint = {
              ...checkpoint,
              checkpointId,
              thread: summary.thread
            }

            // 1. Write checkpoint file
            yield* fs
              .writeFileString(checkpointPath, JSON.stringify(fullCheckpoint, null, 2))
              .pipe(
                Effect.catchAll((error) =>
                  Effect.fail(
                    new CheckpointError({
                      reason: "Failed to write checkpoint file",
                      path: checkpointPath,
                      checkpointId,
                      cause: error
                    })
                  )
                )
              )

            // 2. Update manifest
            const manifest = yield* readManifest(checkpointsDir)
            const updatedManifest: CheckpointManifest = {
              schemaVersion: manifest.schemaVersion,
              checkpoints: [summary, ...manifest.checkpoints]
            }
            yield* writeManifest(checkpointsDir, updatedManifest)

            // 3. Update audit.json symlink/copy
            const auditPath = path.join(baseDir, "audit.json")
            const isWindows = process.platform === "win32"

            if (isWindows) {
              // Copy file on Windows (no symlink support)
              yield* fs
                .copyFile(checkpointPath, auditPath)
                .pipe(
                  Effect.catchAll((error) =>
                    Effect.fail(
                      new CheckpointError({
                        reason: "Failed to copy latest checkpoint to audit.json",
                        path: auditPath,
                        cause: error
                      })
                    )
                  )
                )
            } else {
              // Symlink on Unix
              const symlinkExists = yield* fs.exists(auditPath)
              if (symlinkExists) {
                yield* fs.remove(auditPath)
              }
              yield* fs
                .symlink(checkpointPath, auditPath)
                .pipe(
                  Effect.catchAll((error) =>
                    Effect.fail(
                      new CheckpointError({
                        reason: "Failed to symlink latest checkpoint",
                        path: auditPath,
                        cause: error
                      })
                    )
                  )
                )
            }

            // 4. Update index.json with checkpoint history
            // (Implementation delegated to index writer service - not part of this PR)

            yield* Effect.log(`Checkpoint written: ${checkpointId}`)
          }),

        latest: () =>
          Effect.gen(function* () {
            const manifest = yield* readManifest(checkpointsDir)
            return manifest.checkpoints.length > 0
              ? Option.some(manifest.checkpoints[0])
              : Option.none()
          }),

        list: (limit) =>
          Effect.gen(function* () {
            const manifest = yield* readManifest(checkpointsDir)
            const checkpoints = limit
              ? manifest.checkpoints.slice(0, limit)
              : manifest.checkpoints
            return checkpoints
          }),

        read: (id) =>
          Effect.gen(function* () {
            const checkpointPath = path.join(checkpointsDir, `${id}.json`)
            const exists = yield* fs.exists(checkpointPath)

            if (!exists) {
              return yield* Effect.fail(
                new CheckpointError({
                  reason: "Checkpoint not found",
                  path: checkpointPath,
                  checkpointId: id
                })
              )
            }

            const content = yield* fs
              .readFileString(checkpointPath)
              .pipe(
                Effect.catchAll((error) =>
                  Effect.fail(
                    new CheckpointError({
                      reason: "Failed to read checkpoint",
                      path: checkpointPath,
                      checkpointId: id,
                      cause: error
                    })
                  )
                )
              )

            try {
              return JSON.parse(content) as AuditCheckpoint
            } catch (error) {
              return yield* Effect.fail(
                new CheckpointError({
                  reason: "Invalid checkpoint JSON",
                  path: checkpointPath,
                  checkpointId: id,
                  cause: error
                })
              )
            }
          }),

        diff: (fromId, toId) =>
          Effect.gen(function* () {
            const manifest = yield* readManifest(checkpointsDir)

            const fromSummary = manifest.checkpoints.find((c) => c.checkpointId === fromId)
            const toSummary = manifest.checkpoints.find((c) => c.checkpointId === toId)

            if (!fromSummary) {
              return yield* Effect.fail(
                new CheckpointError({
                  reason: "Source checkpoint not found",
                  checkpointId: fromId
                })
              )
            }

            if (!toSummary) {
              return yield* Effect.fail(
                new CheckpointError({
                  reason: "Target checkpoint not found",
                  checkpointId: toId
                })
              )
            }

            return {
              from: fromSummary,
              to: toSummary,
              delta: {
                errors: toSummary.summary.errors - fromSummary.summary.errors,
                warnings: toSummary.summary.warnings - fromSummary.summary.warnings,
                files: toSummary.summary.totalFiles - fromSummary.summary.totalFiles,
                findings: toSummary.summary.totalFindings - fromSummary.summary.totalFindings
              }
            }
          })
      })
    })
  )

/**
 * Default JSON checkpoint store layer.
 * 
 * Uses standard Amp context directory: `.amp/effect-migrate`
 */
export const JsonCheckpointStoreLive = makeJsonCheckpointStoreLive(".amp/effect-migrate")
```

**Estimated Lines:** ~350 LOC

**Key Implementation Details:**

1. **Layer.effect pattern** - Creates service instance with dependencies
2. **Manifest caching** - Avoids scanning directory for every operation
3. **Platform-aware** - Handles Windows (copy) vs Unix (symlink) for audit.json
4. **Auto-detection** - Reads `AMP_THREAD_ID` environment variable
5. **Error mapping** - Converts platform errors to `CheckpointError`

---

### Phase 3: Update Context Writer to Use Service (45 min)

**Goal:** Refactor `packages/cli/src/amp/context-writer.ts` to depend on `CheckpointStore`.

#### File: `packages/cli/src/amp/context-writer.ts` (MODIFIED)

**Changes:**

1. Remove direct filesystem checkpoint logic
2. Add `CheckpointStore` dependency
3. Use service methods instead of direct writes

**Before:**

```typescript
// Old approach - direct file operations
export const writeAuditContext = (
  checkpoint: AuditCheckpoint,
  normalized: NormalizedAudit
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    
    // ... lots of filesystem logic ...
    yield* fs.writeFileString(checkpointPath, JSON.stringify(checkpoint))
    // ... manifest updates ...
    // ... symlink creation ...
  })
```

**After:**

```typescript
import { CheckpointStore } from "@effect-migrate/core/services/CheckpointStore"
import type { CheckpointMetadata } from "@effect-migrate/core/services/CheckpointStore"

/**
 * Write audit checkpoint using CheckpointStore service.
 */
export const writeAuditContext = (
  checkpoint: AuditCheckpoint,
  normalized: NormalizedAudit,
  metadata: CheckpointMetadata
) =>
  Effect.gen(function* () {
    const store = yield* CheckpointStore
    
    // Service handles all persistence logic
    yield* store.writeCheckpoint(checkpoint, normalized, metadata)
    
    yield* Effect.log("Audit context written successfully")
  })
```

**Effect on Callsites (audit command):**

```typescript
// packages/cli/src/commands/audit.ts

import { JsonCheckpointStoreLive } from "@effect-migrate/core/services/JsonCheckpointStore"

const auditProgram = Effect.gen(function* () {
  // ... run audit ...
  const checkpoint = buildCheckpoint(results)
  const normalized = normalizeAudit(results)
  const metadata = { durationMs, memoryRssMb }
  
  yield* writeAuditContext(checkpoint, normalized, metadata)
}).pipe(
  Effect.provide(JsonCheckpointStoreLive)  // Provide implementation
)
```

**Estimated Changes:** ~50 LOC modified

---

### Phase 4: Testing Strategy (60 min)

**Goal:** Add unit tests for port interface and adapter implementation.

#### File: `packages/core/src/services/__tests__/CheckpointStore.test.ts` (NEW)

**Purpose:** Port-level behavior tests (backend-agnostic).

**Code:**

```typescript
import { describe, it, expect, layer } from "@effect/vitest"
import { Effect, Option } from "effect"
import { CheckpointStore } from "../CheckpointStore.js"
import { JsonCheckpointStoreLive } from "../JsonCheckpointStore.js"
import type { AuditCheckpoint } from "../../schema/checkpoint.js"
import type { NormalizedAudit } from "../../schema/normalized.js"

// Test with real JSON implementation (integration test)
layer(JsonCheckpointStoreLive)("CheckpointStore (JSON backend)", (it) => {
  
  it.effect("writes and reads checkpoint", () =>
    Effect.gen(function* () {
      const store = yield* CheckpointStore
      
      const checkpoint: AuditCheckpoint = {
        timestamp: "2025-11-06T10:00:00Z",
        toolVersion: "0.4.0",
        schemaVersion: "2.0.0",
        projectRoot: "/test/project",
        results: []
      }
      
      const normalized: NormalizedAudit = {
        schemaVersion: "2.0.0",
        summary: { errors: 5, warnings: 10, totalFiles: 3, totalFindings: 15 },
        rules: [],
        files: [],
        results: []
      }
      
      const metadata = { durationMs: 1234, memoryRssMb: 42 }
      
      // Write
      yield* store.writeCheckpoint(checkpoint, normalized, metadata)
      
      // Read latest
      const latest = yield* store.latest()
      expect(Option.isSome(latest)).toBe(true)
      
      const summary = Option.getOrThrow(latest)
      expect(summary.summary.errors).toBe(5)
      expect(summary.summary.warnings).toBe(10)
      expect(summary.metadata?.durationMs).toBe(1234)
    })
  )
  
  it.effect("lists checkpoints in reverse chronological order", () =>
    Effect.gen(function* () {
      const store = yield* CheckpointStore
      
      // Write multiple checkpoints
      for (let i = 0; i < 3; i++) {
        const checkpoint: AuditCheckpoint = {
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          toolVersion: "0.4.0",
          schemaVersion: "2.0.0",
          projectRoot: "/test/project",
          results: []
        }
        
        const normalized: NormalizedAudit = {
          schemaVersion: "2.0.0",
          summary: { errors: i, warnings: i * 2, totalFiles: 1, totalFindings: i * 3 },
          rules: [],
          files: [],
          results: []
        }
        
        yield* store.writeCheckpoint(checkpoint, normalized, {})
      }
      
      // List all
      const all = yield* store.list()
      expect(all.length).toBe(3)
      
      // Newest first
      expect(all[0].summary.errors).toBe(2)
      expect(all[2].summary.errors).toBe(0)
      
      // List with limit
      const limited = yield* store.list(2)
      expect(limited.length).toBe(2)
    })
  )
  
  it.effect("computes delta between checkpoints", () =>
    Effect.gen(function* () {
      const store = yield* CheckpointStore
      
      // Write two checkpoints
      const checkpoint1: AuditCheckpoint = {
        timestamp: "2025-11-06T10:00:00Z",
        toolVersion: "0.4.0",
        schemaVersion: "2.0.0",
        projectRoot: "/test/project",
        results: []
      }
      
      const normalized1: NormalizedAudit = {
        schemaVersion: "2.0.0",
        summary: { errors: 10, warnings: 20, totalFiles: 5, totalFindings: 30 },
        rules: [],
        files: [],
        results: []
      }
      
      yield* store.writeCheckpoint(checkpoint1, normalized1, {})
      const summary1 = yield* store.latest().pipe(Effect.map(Option.getOrThrow))
      
      // Wait and write second
      const checkpoint2: AuditCheckpoint = {
        ...checkpoint1,
        timestamp: "2025-11-06T11:00:00Z"
      }
      
      const normalized2: NormalizedAudit = {
        ...normalized1,
        summary: { errors: 5, warnings: 15, totalFiles: 5, totalFindings: 20 }
      }
      
      yield* store.writeCheckpoint(checkpoint2, normalized2, {})
      const summary2 = yield* store.latest().pipe(Effect.map(Option.getOrThrow))
      
      // Compute delta
      const delta = yield* store.diff(summary1.checkpointId, summary2.checkpointId)
      
      expect(delta.delta.errors).toBe(-5)
      expect(delta.delta.warnings).toBe(-5)
      expect(delta.delta.findings).toBe(-10)
    })
  )
  
  it.effect("handles missing checkpoint gracefully", () =>
    Effect.gen(function* () {
      const store = yield* CheckpointStore
      
      const result = yield* Effect.exit(store.read("nonexistent-id"))
      expect(Exit.isFailure(result)).toBe(true)
      
      if (Exit.isFailure(result)) {
        const error = result.cause
        // Should be CheckpointError with reason "Checkpoint not found"
      }
    })
  )
})
```

**Estimated Lines:** ~200 LOC

**Additional Test File:**

#### File: `packages/core/src/services/__tests__/InMemoryCheckpointStore.ts` (NEW)

**Purpose:** Mock implementation for unit testing consumers.

```typescript
/**
 * In-memory checkpoint store for testing.
 */
export const makeInMemoryCheckpointStore = (): Layer.Layer<CheckpointStore> => {
  const checkpoints = new Map<string, AuditCheckpoint>()
  const summaries: CheckpointSummary[] = []
  
  return Layer.succeed(CheckpointStore, {
    writeCheckpoint: (checkpoint, normalized, metadata) =>
      Effect.sync(() => {
        const id = createCheckpointId()
        checkpoints.set(id, { ...checkpoint, checkpointId: id })
        summaries.unshift({
          checkpointId: id,
          timestamp: checkpoint.timestamp,
          toolVersion: checkpoint.toolVersion,
          schemaVersion: checkpoint.schemaVersion,
          summary: normalized.summary,
          metadata
        })
      }),
    
    latest: () => Effect.sync(() => 
      summaries.length > 0 ? Option.some(summaries[0]) : Option.none()
    ),
    
    list: (limit) => Effect.sync(() => 
      limit ? summaries.slice(0, limit) : summaries
    ),
    
    read: (id) => Effect.sync(() => {
      const checkpoint = checkpoints.get(id)
      if (!checkpoint) {
        throw new CheckpointError({ reason: "Not found", checkpointId: id })
      }
      return checkpoint
    }),
    
    diff: (fromId, toId) => Effect.sync(() => {
      const from = summaries.find(s => s.checkpointId === fromId)
      const to = summaries.find(s => s.checkpointId === toId)
      if (!from || !to) {
        throw new CheckpointError({ reason: "Checkpoint not found" })
      }
      return {
        from,
        to,
        delta: {
          errors: to.summary.errors - from.summary.errors,
          warnings: to.summary.warnings - from.summary.warnings,
          files: to.summary.totalFiles - from.summary.totalFiles,
          findings: to.summary.totalFindings - from.summary.totalFindings
        }
      }
    })
  })
}
```

**Estimated Lines:** ~100 LOC

---

### Phase 5: Export and Integration (30 min)

**Goal:** Export service from core package and integrate with CLI.

#### File: `packages/core/src/index.ts` (MODIFIED)

**Add exports:**

```typescript
// Service exports
export * from "./services/CheckpointStore.js"
export * from "./services/JsonCheckpointStore.js"
```

#### File: `packages/cli/src/commands/audit.ts` (MODIFIED)

**Update Layer composition:**

```typescript
import { JsonCheckpointStoreLive } from "@effect-migrate/core/services/JsonCheckpointStore"
import { NodeContext, NodeRuntime } from "@effect/platform-node"

const auditCommand = Command.make("audit", /* ... */, (args) =>
  Effect.gen(function* () {
    // ... existing audit logic ...
    
    // Write checkpoint using service
    yield* writeAuditContext(checkpoint, normalized, metadata)
  }).pipe(
    Effect.provide(JsonCheckpointStoreLive),  // Provide checkpoint backend
    Effect.provide(NodeContext.layer),        // Provide platform services
    NodeRuntime.runMain
  )
)
```

**Estimated Changes:** ~20 LOC

---

## Integration with Existing Code

### Dependencies on PR3

This PR **requires PR3 to be merged first** because:

1. Uses `AuditCheckpoint` schema from PR3
2. Uses checkpoint directory structure from PR3
3. Uses manifest.json format from PR3

**If PR3 is not merged:** This PR will fail to compile due to missing types.

### Consumed by PR6

PR6 (SQLite backend) will:

1. Import `CheckpointStoreService` interface
2. Implement `SqliteCheckpointStoreLive` Layer
3. Use same port interface, different adapter

**Example from PR6:**

```typescript
import type { CheckpointStoreService } from "@effect-migrate/core/services/CheckpointStore"
import { CheckpointStore } from "@effect-migrate/core/services/CheckpointStore"

export const SqliteCheckpointStoreLive = Layer.effect(
  CheckpointStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    
    return CheckpointStore.of({
      writeCheckpoint: (checkpoint, normalized, metadata) =>
        Effect.gen(function* () {
          // SQL insertion logic
          yield* sql`INSERT INTO checkpoints (...) VALUES (...)`
        }),
      // ... other methods ...
    })
  })
)
```

---

## Testing Strategy

### Unit Tests (Port Level)

**Test the service interface:**

- ✅ Write and read checkpoint
- ✅ List checkpoints with/without limit
- ✅ Get latest checkpoint
- ✅ Compute delta between checkpoints
- ✅ Handle missing checkpoints gracefully
- ✅ Handle corrupted manifest
- ✅ Handle permission errors

**Files:**
- `packages/core/src/services/__tests__/CheckpointStore.test.ts`
- `packages/core/src/services/__tests__/InMemoryCheckpointStore.ts`

### Integration Tests

**Test Layer composition:**

```typescript
layer(
  Layer.mergeAll(
    JsonCheckpointStoreLive,
    NodeContext.layer
  )
)("Audit with checkpoint persistence", (it) => {
  it.effect("writes checkpoint during audit", () =>
    Effect.gen(function* () {
      // Run full audit
      yield* runAudit(config)
      
      // Verify checkpoint exists
      const store = yield* CheckpointStore
      const latest = yield* store.latest()
      expect(Option.isSome(latest)).toBe(true)
    })
  )
})
```

### Performance Tests

**Verify targets from comprehensive plan:**

| Metric          | Target (10k findings) | Test Method                  |
| --------------- | --------------------- | ---------------------------- |
| Write duration  | <400ms                | `console.time` in test       |
| Memory peak     | <50MB                 | `process.memoryUsage().rss`  |
| File size       | 1-4MB                 | `fs.stat().size`             |

---

## Success Criteria

### Functional

- [ ] `CheckpointStore` service interface defined with proper Effect types
- [ ] `CheckpointError` tagged error class for all error cases
- [ ] `JsonCheckpointStoreLive` Layer implements full interface
- [ ] `InMemoryCheckpointStore` mock for testing
- [ ] CLI audit command uses service via dependency injection
- [ ] All methods return `Effect.Effect<A, CheckpointError>`
- [ ] Service interface exported from core package
- [ ] Platform-aware symlink/copy for audit.json

### Testing

- [ ] Unit tests for all service methods
- [ ] Integration tests for Layer composition
- [ ] Tests use `@effect/vitest` with `layer()` helper
- [ ] Mock store available for consumer tests
- [ ] Error cases covered (missing files, corrupt JSON)

### Code Quality

- [ ] TypeScript strict mode passes
- [ ] ESLint passes (no barrel imports)
- [ ] Follows Effect-TS service patterns from AGENTS.md
- [ ] Service interface exported and importable
- [ ] All public methods documented with JSDoc

### Performance

- [ ] Checkpoint write completes in <400ms (10k findings)
- [ ] Memory usage stays under 50MB during write
- [ ] No memory leaks in repeated writes
- [ ] Manifest read is O(1) (no directory scanning)

### Documentation

- [ ] Service interface includes usage examples
- [ ] JSDoc comments explain all parameters
- [ ] AGENTS.md updated with CheckpointStore patterns (if needed)
- [ ] README examples show Layer composition

---

## Files Summary

### New Files

**Core Services:**

- `packages/core/src/services/CheckpointStore.ts` (~180 LOC)
  - Port interface definition
  - Tagged error class
  - Type exports

- `packages/core/src/services/JsonCheckpointStore.ts` (~350 LOC)
  - JSON filesystem adapter
  - Manifest management
  - Platform-aware symlink/copy

**Tests:**

- `packages/core/src/services/__tests__/CheckpointStore.test.ts` (~200 LOC)
  - Port-level behavior tests
  - Integration tests with JSON backend

- `packages/core/src/services/__tests__/InMemoryCheckpointStore.ts` (~100 LOC)
  - Mock implementation for consumer tests

**Total new LOC:** ~830 lines

### Modified Files

**Core Package:**

- `packages/core/src/index.ts`
  - Add service exports (~5 lines)

**CLI Package:**

- `packages/cli/src/amp/context-writer.ts`
  - Replace direct filesystem ops with service calls (~50 lines modified)

- `packages/cli/src/commands/audit.ts`
  - Add Layer composition (~20 lines modified)

**Total modified LOC:** ~75 lines

---

## Migration Notes for PR6

When implementing SQLite backend (PR6), follow this pattern:

**File: `packages/core/src/services/SqliteCheckpointStore.ts`**

```typescript
import type { CheckpointStoreService } from "./CheckpointStore.js"
import { CheckpointStore, CheckpointError } from "./CheckpointStore.js"
import * as SqlClient from "@effect/sql-sqlite-node"

export const makeSqliteCheckpointStoreLive = (
  dbPath: string
): Layer.Layer<CheckpointStore, never, SqlClient.SqlClient> =>
  Layer.effect(
    CheckpointStore,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      
      // Initialize schema
      yield* sql`CREATE TABLE IF NOT EXISTS checkpoints (...)`
      
      return CheckpointStore.of({
        writeCheckpoint: (checkpoint, normalized, metadata) =>
          // SQL implementation
          Effect.void,
        
        latest: () =>
          // SQL query
          Effect.succeed(Option.none()),
        
        // ... other methods
      })
    })
  )
```

**Usage in CLI:**

```typescript
// Allow user to choose backend via config
const checkpointBackend = config.checkpointDb
  ? SqliteCheckpointStoreLive
  : JsonCheckpointStoreLive

program.pipe(Effect.provide(checkpointBackend))
```

---

## References

### Related Plans

- [Checkpoint-Based Audit Persistence](./checkpoint-based-audit-persistence.md) - PR3 implementation details
- [Comprehensive Data Architecture](./comprehensive-data-architecture.md) - Overall system design
- [PR1: Version Registry](./pr1-version-registry.md) - Schema versioning foundation
- [PR2: Normalized Schema](./pr2-normalized-schema-dual-emit.md) - Data normalization

### Effect-TS Patterns

**From root AGENTS.md:**

- [Effect-TS Best Practices #4: Services and Layers](../../AGENTS.md#4-services-and-layers)
- [Effect-TS Best Practices #2: Error Handling with TaggedError](../../AGENTS.md#2-error-handling-with-taggederror)
- [Effect-TS Best Practices #3: Resource Management](../../AGENTS.md#3-resource-management)

### External Documentation

- [Effect Website: Context](https://effect.website/docs/context-management/services)
- [Effect Website: Layers](https://effect.website/docs/context-management/layers)
- [Effect Platform: FileSystem](https://effect-ts.github.io/effect/platform/FileSystem.ts.html)

---

**Estimated Total Effort:** 3-5 hours

**Breakdown:**
- Phase 1: Port interface (45 min)
- Phase 2: JSON adapter (90 min)
- Phase 3: CLI integration (45 min)
- Phase 4: Testing (60 min)
- Phase 5: Exports (30 min)
- Buffer: 30 min

**Next PR:** PR6 - SQLite Checkpoint Backend (depends on this)
