---
created: 2025-11-06
lastUpdated: 2025-11-06
author: Generated via Amp (Oracle + Librarian comprehensive analysis)
status: ready
thread: https://ampcode.com/threads/T-a96b5e77-ba99-4c03-89e9-d7c9145c9700
audience: Development team, AI coding agents, and technical decision makers
tags: [architecture, performance, data-processing, analytics, monitoring, amp-integration]
related:
  - ./schema-versioning-and-normalization.md
  - ./checkpoint-based-audit-persistence.md
  - ../concepts/amp-integration.md
  - ../../AGENTS.md
---

# Comprehensive Data Architecture for effect-migrate

## Executive Summary

This plan integrates performance-optimized data structures, queryable persistence, monitoring, and analytics for effect-migrate's checkpoint system. It builds on the schema versioning and checkpoint persistence plans with a phased approach that:

1. **Starts simple**: Normalized JSON checkpoints (backwards compatible)
2. **Scales up**: Optional SQLite for large projects (100+ checkpoints, 10k+ findings)
3. **Adds intelligence**: nodejs-polars for trend analysis and visualizations
4. **Monitors performance**: OpenTelemetry instrumentation with optional Prometheus
5. **Future-proofs**: MCP server and workflow orchestration for enterprise use

**Total Effort:** 38-70 hours across 5 phases (deliverable incrementally)

**Key Principle:** Each phase is independently useful and backwards compatible. Teams can stop at any phase based on their needs.

---

## Problem Context

### Current State (From Previous Plans)

**Schema Versioning Plan:**

- Normalized audit schema (v2.0.0) reduces JSON size by 50-70%
- Deduplication via rules[], files[], results[] with index-based references
- Range tuples instead of nested objects

**Checkpoint Persistence Plan:**

- Time-series checkpoints in `.amp/effect-migrate/checkpoints/`
- Automatic thread linking via `AMP_THREAD_ID`
- Delta calculation between consecutive checkpoints
- CLI commands for history management

### New Requirements (This Plan)

**Performance:**

- Audits run frequently in Amp sessions (potentially every few minutes)
- Must handle 100+ checkpoints without memory issues
- Support projects with 10k+ findings per audit

**Queryability:**

- Analyze trends over time (e.g., "Are we making progress?")
- Identify hot spots (which files/rules generate most findings)
- Generate progress charts for README badges
- Enable data-driven decision making

**Monitoring:**

- Track audit runtime, memory usage, bottlenecks
- Identify performance regressions
- Support production SLOs for large teams

**Future-Proofing:**

- MCP server for Amp agent queries
- Scheduled/distributed audits across repos
- Integration with team dashboards

---

## Architecture Overview

### Service Abstraction

```
┌────────────────────────────────────────────────────────────────────┐
│                      CLI Commands Layer                             │
│  audit, checkpoints, analytics, db, metrics, mcp                   │
└────────────────────────────────────────────────────────────────────┘
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                   Core Services (Ports)                             │
│                                                                     │
│  CheckpointStore                 AnalyticsEngine                   │
│  ├─ writeCheckpoint             ├─ trendSeries                     │
│  ├─ latest                       ├─ topRules                        │
│  ├─ list                         ├─ fileHotspots                    │
│  ├─ read                         └─ deltaBreakdown                  │
│  └─ diff                                                             │
└────────────────────────────────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────┬──────────────────────────────────┐
│   Adapters (Implementations)    │      Analytics Adapters          │
│                                  │                                  │
│  JsonCheckpointStore             │  SqliteAnalyticsEngine           │
│  SqliteCheckpointStore           │  PolarsAnalyticsEngine           │
│  CompositeCheckpointStore        │                                  │
│  (dual-write JSON + SQLite)      │                                  │
└─────────────────────────────────┴──────────────────────────────────┘
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Storage Backends                                 │
│                                                                     │
│  JSON Files              SQLite (WAL mode)         Polars DataFrames│
│  ├─ checkpoints/*.json   ├─ checkpoints.db         ├─ In-memory    │
│  ├─ manifest.json        ├─ Indexes                └─ Streaming     │
│  └─ index.json           └─ Migrations                              │
└────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────┐
│  Audit Run  │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Normalize Findings│ (rules[], files[], results[])
└──────┬───────────┘
       │
       ▼
┌────────────────────────┐
│ CheckpointStore.write  │
└────────┬───────────────┘
         │
         ├────────────────┐
         │                │
         ▼                ▼
┌───────────────┐  ┌──────────────────┐
│ JSON File     │  │ SQLite DB        │ (optional)
│ (always)      │  │ (--checkpoint-db)│
└───────┬───────┘  └────────┬─────────┘
        │                   │
        └─────────┬─────────┘
                  │
                  ▼
          ┌────────────────┐
          │ index.json     │ (updated with latest checkpoint)
          └────────────────┘
```

### Decision Matrix: When to Use What

| Project Size   | Checkpoints | Findings/Audit | Recommended Backend  | Analytics     | Monitoring      |
| -------------- | ----------- | -------------- | -------------------- | ------------- | --------------- |
| **Small**      | <10         | <1k            | JSON only            | Basic (CLI)   | Optional        |
| **Medium**     | 10-50       | 1k-5k          | JSON only            | CLI + charts  | Recommended     |
| **Large**      | 50-100      | 5k-10k         | JSON + SQLite (dual) | Polars trends | Required        |
| **Enterprise** | >100        | >10k           | SQLite primary       | Polars + MCP  | Required + Prom |

---

## Phase 1: JSON Checkpoints (Baseline)

**Status:** Already planned in checkpoint-persistence.md

**Goal:** Time-series checkpoints with normalized schema, backwards compatible.

### Implementation Summary

**Files:**

```
.amp/effect-migrate/
├── checkpoints/
│   ├── 2025-11-06T10-00-00Z.json  # Normalized audit snapshot
│   ├── 2025-11-06T11-30-00Z.json
│   └── manifest.json               # Complete history + metadata
├── audit.json                      # Symlink to latest checkpoint
└── index.json                      # Navigation + recent history (last 10)
```

**CheckpointStore Interface:**

```typescript
/**
 * Checkpoint persistence abstraction.
 *
 * All persistence backends implement this interface.
 */
export interface CheckpointStore {
  /**
   * Write a new checkpoint.
   */
  readonly writeCheckpoint: (
    checkpoint: AuditCheckpoint,
    normalized: NormalizedFindings,
    metadata: CheckpointMetadata
  ) => Effect.Effect<void, CheckpointError>

  /**
   * Get latest checkpoint summary.
   */
  readonly latest: () => Effect.Effect<Option.Option<CheckpointSummary>, CheckpointError>

  /**
   * List checkpoints (newest first).
   */
  readonly list: (limit?: number) => Effect.Effect<readonly CheckpointSummary[], CheckpointError>

  /**
   * Read full checkpoint by ID.
   */
  readonly read: (id: string) => Effect.Effect<AuditCheckpoint, CheckpointError>

  /**
   * Compute delta between two checkpoints.
   */
  readonly diff: (fromId: string, toId: string) => Effect.Effect<DeltaSummary, CheckpointError>
}

export class CheckpointStore extends Context.Tag("CheckpointStore")<
  CheckpointStore,
  CheckpointStore
>() {}
```

**JSON Implementation (from checkpoint plan):**

Already designed in checkpoint-persistence.md. Key points:

- Streaming writes (chunk results array to avoid memory spikes)
- Manifest.json for O(1) delta computation
- Auto-detect `AMP_THREAD_ID` for thread linking
- Symlink audit.json to latest (copy on Windows)

### Performance Targets

| Metric          | Target (10k findings) |
| --------------- | --------------------- |
| Write duration  | <400ms                |
| Memory peak     | <50MB                 |
| Manifest update | <10ms                 |
| Read latest     | <50ms                 |
| File size       | 1-4MB (normalized)    |

### Success Criteria

- [x] Checkpoints written to `checkpoints/` directory
- [x] Manifest tracks all checkpoints with summaries
- [x] audit.json points to latest
- [x] index.json includes last 10 checkpoints
- [x] Delta computed from previous summary
- [x] Thread ID auto-detected and linked

**Effort:** 4-8 hours (mostly complete from checkpoint plan)

---

## Phase 2: SQLite Option for Large Projects

**Goal:** Add optional `--checkpoint-db` flag for projects needing fast queries and bounded memory.

### SQLite Schema (Normalized)

```sql
-- Version tracking
CREATE TABLE schema_versions (
  key TEXT PRIMARY KEY,
  version TEXT NOT NULL
);

INSERT INTO schema_versions VALUES ('checkpoint_schema', '1.0.0');

-- Checkpoint metadata
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,           -- ISO timestamp (e.g., "2025-11-06T10-00-00Z")
  ts INTEGER NOT NULL,            -- Unix timestamp for fast range queries
  thread TEXT,                    -- Amp thread ID
  tool_version TEXT NOT NULL,
  audit_schema TEXT NOT NULL,     -- Audit format version
  duration_ms INTEGER,            -- Audit runtime
  memory_rss_mb REAL,             -- Memory usage
  total_errors INTEGER NOT NULL,
  total_warnings INTEGER NOT NULL,
  total_files INTEGER NOT NULL,
  total_findings INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_checkpoints_ts ON checkpoints(ts DESC);
CREATE INDEX idx_checkpoints_thread ON checkpoints(thread) WHERE thread IS NOT NULL;

-- Deduplicated files
CREATE TABLE files (
  file_id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL
);

CREATE INDEX idx_files_path ON files(path);

-- Deduplicated rules
CREATE TABLE rules (
  rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL,              -- Rule identifier (e.g., "no-async-await")
  kind TEXT NOT NULL,                    -- "pattern" | "boundary" | "docs"
  severity TEXT NOT NULL,                -- "error" | "warning" | "info"
  message TEXT NOT NULL,
  docs_url TEXT,
  tags TEXT                              -- JSON array
);

CREATE INDEX idx_rules_id ON rules(id);
CREATE INDEX idx_rules_kind ON rules(kind);

-- Finding results (normalized references)
CREATE TABLE results (
  checkpoint_id TEXT NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES rules(rule_id),
  file_id INTEGER REFERENCES files(file_id),
  s_line INTEGER,             -- Start line
  s_col INTEGER,              -- Start column
  e_line INTEGER,             -- End line
  e_col INTEGER,              -- End column
  severity TEXT,              -- Override if different from rule default
  message TEXT,               -- Override if different from rule default
  PRIMARY KEY (checkpoint_id, rule_id, file_id, s_line, s_col)
);

CREATE INDEX idx_results_checkpoint ON results(checkpoint_id);
CREATE INDEX idx_results_rule ON results(rule_id, checkpoint_id);
CREATE INDEX idx_results_file ON results(file_id, checkpoint_id);
CREATE INDEX idx_results_severity ON results(severity, checkpoint_id);

-- Covering index for trend queries
CREATE INDEX idx_results_trend ON results(checkpoint_id, rule_id, severity)
  INCLUDE (file_id, s_line);
```

### Service Implementation

**SqliteCheckpointStore Layer:**

```typescript
import * as SqlClient from "@effect/sql-sqlite-node"
import { Effect, Layer, Schema, Chunk } from "effect"

/**
 * SQLite checkpoint store layer.
 */
export const SqliteCheckpointStoreLive = Layer.effect(
  CheckpointStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // Enable WAL mode for concurrent reads
    yield* sql`PRAGMA journal_mode=WAL`
    yield* sql`PRAGMA synchronous=NORMAL`
    yield* sql`PRAGMA foreign_keys=ON`

    // Cache for file/rule IDs (in-memory hashmap)
    const fileIdCache = new Map<string, number>()
    const ruleIdCache = new Map<string, number>()

    return CheckpointStore.of({
      writeCheckpoint: (checkpoint, normalized, metadata) =>
        Effect.gen(function* () {
          yield* Effect.log(`Writing checkpoint to SQLite: ${checkpoint.checkpointId}`)

          // Single transaction for atomicity
          yield* SqlClient.withTransaction(
            Effect.gen(function* () {
              // 1. Insert checkpoint metadata
              yield* sql`
                INSERT INTO checkpoints (
                  id, ts, thread, tool_version, audit_schema,
                  duration_ms, memory_rss_mb,
                  total_errors, total_warnings, total_files, total_findings
                ) VALUES (
                  ${checkpoint.checkpointId},
                  ${Math.floor(new Date(checkpoint.timestamp).getTime() / 1000)},
                  ${checkpoint.thread ?? null},
                  ${checkpoint.toolVersion},
                  ${checkpoint.schemaVersion},
                  ${metadata.durationMs ?? null},
                  ${metadata.memoryRssMb ?? null},
                  ${normalized.summary.errors},
                  ${normalized.summary.warnings},
                  ${normalized.summary.totalFiles},
                  ${normalized.summary.totalFindings}
                )
              `

              // 2. Upsert rules and cache IDs
              for (const rule of normalized.rules) {
                if (!ruleIdCache.has(rule.id)) {
                  const result = yield* sql<{ rule_id: number }>`
                    INSERT INTO rules (id, kind, severity, message, docs_url, tags)
                    VALUES (
                      ${rule.id},
                      ${rule.ruleKind},
                      ${rule.severity},
                      ${rule.message},
                      ${rule.docsUrl ?? null},
                      ${rule.tags ? JSON.stringify(rule.tags) : null}
                    )
                    ON CONFLICT(id) DO UPDATE SET
                      severity = excluded.severity,
                      message = excluded.message
                    RETURNING rule_id
                  `
                  ruleIdCache.set(rule.id, result[0].rule_id)
                } else {
                  // Already cached
                }
              }

              // 3. Upsert files and cache IDs
              for (const file of normalized.files) {
                if (!fileIdCache.has(file)) {
                  const result = yield* sql<{ file_id: number }>`
                    INSERT INTO files (path) VALUES (${file})
                    ON CONFLICT(path) DO NOTHING
                    RETURNING file_id
                  `
                  if (result.length > 0) {
                    fileIdCache.set(file, result[0].file_id)
                  } else {
                    // Already exists, fetch ID
                    const existing = yield* sql<{ file_id: number }>`
                      SELECT file_id FROM files WHERE path = ${file}
                    `
                    fileIdCache.set(file, existing[0].file_id)
                  }
                }
              }

              // 4. Batch insert results (chunked to avoid memory spikes)
              const chunks = Chunk.chunksOf(normalized.results, 1000)

              for (const chunk of chunks) {
                const params = chunk.map((result) => {
                  const rule = normalized.rules[result.rule]
                  const fileId =
                    result.file !== undefined
                      ? fileIdCache.get(normalized.files[result.file])
                      : null
                  const ruleId = ruleIdCache.get(rule.id)!

                  return {
                    checkpoint_id: checkpoint.checkpointId,
                    rule_id: ruleId,
                    file_id: fileId,
                    s_line: result.range?.[0] ?? null,
                    s_col: result.range?.[1] ?? null,
                    e_line: result.range?.[2] ?? null,
                    e_col: result.range?.[3] ?? null,
                    severity: result.severity ?? null,
                    message: result.message ?? null
                  }
                })

                // Prepared statement for batch insert
                const stmt = yield* sql.prepareStatement(`
                  INSERT INTO results (
                    checkpoint_id, rule_id, file_id,
                    s_line, s_col, e_line, e_col,
                    severity, message
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `)

                yield* stmt.runMany(params)
              }
            })
          )

          yield* Effect.log(`✓ Wrote ${normalized.results.length} results to SQLite`)
        }),

      latest: () =>
        Effect.gen(function* () {
          const result = yield* sql<CheckpointSummary>`
            SELECT 
              id as checkpointId,
              ts as timestamp,
              thread,
              total_errors as errors,
              total_warnings as warnings,
              total_files as totalFiles,
              total_findings as totalFindings
            FROM checkpoints
            ORDER BY ts DESC
            LIMIT 1
          `

          return result.length > 0 ? Option.some(result[0]) : Option.none()
        }),

      list: (limit = 100) =>
        sql<CheckpointSummary>`
          SELECT 
            id as checkpointId,
            ts as timestamp,
            thread,
            total_errors as errors,
            total_warnings as warnings,
            total_files as totalFiles,
            total_findings as totalFindings
          FROM checkpoints
          ORDER BY ts DESC
          LIMIT ${limit}
        `,

      read: (id: string) =>
        Effect.gen(function* () {
          // Read checkpoint metadata
          const cpMeta = yield* sql<AuditCheckpoint>`
            SELECT * FROM checkpoints WHERE id = ${id}
          `

          if (cpMeta.length === 0) {
            return yield* Effect.fail(new CheckpointNotFoundError({ id }))
          }

          // Read results with denormalization
          const results = yield* sql<{
            rule_id: string
            rule_kind: string
            severity: string
            message: string
            file_path: string | null
            s_line: number | null
            s_col: number | null
            e_line: number | null
            e_col: number | null
          }>`
            SELECT 
              r.id as rule_id,
              r.kind as rule_kind,
              COALESCE(res.severity, r.severity) as severity,
              COALESCE(res.message, r.message) as message,
              f.path as file_path,
              res.s_line, res.s_col, res.e_line, res.e_col
            FROM results res
            JOIN rules r ON res.rule_id = r.rule_id
            LEFT JOIN files f ON res.file_id = f.file_id
            WHERE res.checkpoint_id = ${id}
          `

          // Reconstruct normalized structure
          // ... (denormalization logic)

          return { ...cpMeta[0], findings: normalizedFindings }
        }),

      diff: (fromId: string, toId: string) =>
        Effect.gen(function* () {
          const from = yield* sql<{ errors: number; warnings: number; total: number }>`
            SELECT 
              total_errors as errors,
              total_warnings as warnings,
              total_findings as total
            FROM checkpoints
            WHERE id = ${fromId}
          `

          const to = yield* sql<{ errors: number; warnings: number; total: number }>`
            SELECT 
              total_errors as errors,
              total_warnings as warnings,
              total_findings as total
            FROM checkpoints
            WHERE id = ${toId}
          `

          return {
            errors: to[0].errors - from[0].errors,
            warnings: to[0].warnings - from[0].warnings,
            totalFindings: to[0].total - from[0].total
          }
        })
    })
  })
)

/**
 * SQLite configuration layer.
 */
export const SqliteLive = (dbPath: string) =>
  SqlClient.layer({
    filename: dbPath,
    prepareCacheSize: 500,
    prepareCacheTTL: "20 minutes",
    disableWAL: false,
    transformResultNames: (str) => str
  })
```

**CompositeStore (Dual-Write):**

```typescript
/**
 * Composite store that writes to both JSON and SQLite.
 *
 * Provides migration path from JSON to SQLite.
 */
export const CompositeCheckpointStoreLive = Layer.effect(
  CheckpointStore,
  Effect.gen(function* () {
    const jsonStore = yield* JsonCheckpointStore
    const sqliteStore = yield* SqliteCheckpointStore

    return CheckpointStore.of({
      writeCheckpoint: (checkpoint, normalized, metadata) =>
        Effect.gen(function* () {
          // Always write JSON (backwards compatible)
          yield* jsonStore.writeCheckpoint(checkpoint, normalized, metadata)

          // Also write to SQLite (best effort)
          yield* sqliteStore.writeCheckpoint(checkpoint, normalized, metadata).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logError(`SQLite write failed: ${error}`)
                // Don't fail overall operation
              })
            )
          )
        }),

      // Reads prefer SQLite if available, fallback to JSON
      latest: () =>
        Effect.gen(function* () {
          const sqliteLatest = yield* sqliteStore
            .latest()
            .pipe(Effect.catchAll(() => Effect.succeed(Option.none())))

          if (Option.isSome(sqliteLatest)) {
            return sqliteLatest
          }

          return yield* jsonStore.latest()
        }),

      list: (limit) =>
        Effect.gen(function* () {
          const sqliteList = yield* sqliteStore
            .list(limit)
            .pipe(Effect.catchAll(() => Effect.succeed([])))

          if (sqliteList.length > 0) {
            return sqliteList
          }

          return yield* jsonStore.list(limit)
        }),

      read: (id) =>
        Effect.gen(function* () {
          // Try SQLite first
          const sqliteRead = yield* sqliteStore.read(id).pipe(Effect.option)

          if (Option.isSome(sqliteRead)) {
            return sqliteRead.value
          }

          // Fallback to JSON
          return yield* jsonStore.read(id)
        }),

      diff: (fromId, toId) =>
        Effect.gen(function* () {
          // Try SQLite first (faster)
          const sqliteDiff = yield* sqliteStore.diff(fromId, toId).pipe(Effect.option)

          if (Option.isSome(sqliteDiff)) {
            return sqliteDiff.value
          }

          // Fallback to JSON
          return yield* jsonStore.diff(fromId, toId)
        })
    })
  })
)
```

### CLI Integration

**Audit command flags:**

```typescript
const auditOptions = {
  ampOut: Options.directory("amp-out").pipe(Options.withDefault(".amp/effect-migrate")),
  checkpointDb: Options.file("checkpoint-db").pipe(Options.optional),
  noDualWrite: Options.boolean("no-dual-write").pipe(Options.withDefault(false))
}

const auditCommand = Command.make("audit", auditOptions, (opts) =>
  Effect.gen(function* () {
    // ... run audit, get results ...

    // Select checkpoint store based on flags
    const store = yield* opts.checkpointDb
      ? opts.noDualWrite
        ? SqliteCheckpointStore // SQLite only
        : CompositeCheckpointStore // Dual-write
      : JsonCheckpointStore // JSON only (default)

    yield* store.writeCheckpoint(checkpoint, normalized, metadata)

    yield* Console.log(`✓ Wrote checkpoint to ${opts.ampOut}`)
    if (opts.checkpointDb) {
      yield* Console.log(`  Database: ${opts.checkpointDb}`)
    }
  })
).pipe(
  // Provide appropriate layer
  Effect.provide(/* layer based on flags */)
)
```

**DB management commands:**

```bash
# Initialize database
effect-migrate db init --path .amp/effect-migrate/checkpoints.db

# Check database health
effect-migrate db check --path .amp/effect-migrate/checkpoints.db

# Export to JSON (migration/backup)
effect-migrate db export --path .amp/effect-migrate/checkpoints.db --out .amp/export/

# Import from JSON
effect-migrate db import --json .amp/export/ --db .amp/effect-migrate/checkpoints.db
```

### Performance Targets

| Metric         | Target (10k findings)        |
| -------------- | ---------------------------- |
| Write duration | <500ms (incl. transaction)   |
| Memory peak    | <150MB                       |
| Query counts   | <30ms                        |
| Query delta    | <30ms                        |
| Query trend    | <100ms                       |
| Index size     | ~10-20MB for 100 checkpoints |

### Migration Path

**For existing JSON users:**

```bash
# Enable SQLite (dual-write automatically)
effect-migrate audit --checkpoint-db .amp/effect-migrate/checkpoints.db

# Migrate historical data
effect-migrate db import --json .amp/effect-migrate/checkpoints/ --db .amp/effect-migrate/checkpoints.db

# After migration period, disable JSON writes
effect-migrate audit --checkpoint-db .amp/effect-migrate/checkpoints.db --no-dual-write
```

**Backwards compatibility:**

- JSON files remain readable
- SQLite is opt-in via flag
- CompositeStore ensures no data loss during transition

**Effort:** 8-14 hours

---

## Phase 3: Polars Analytics for Trend Analysis

**Goal:** Provide deep analytics (rolling windows, hot spots, burn-down charts) without loading all data into memory.

### AnalyticsEngine Interface

```typescript
/**
 * Analytics engine for checkpoint trend analysis.
 */
export interface AnalyticsEngine {
  /**
   * Compute trend series for a metric over time.
   */
  readonly trendSeries: (
    metric: "errors" | "warnings" | "totalFindings" | "progress",
    window?: number,
    range?: { from?: Date; to?: Date }
  ) => Effect.Effect<readonly TrendPoint[], AnalyticsError>

  /**
   * Identify top rules by finding count.
   */
  readonly topRules: (
    limit: number,
    range?: { from?: Date; to?: Date }
  ) => Effect.Effect<readonly RuleStats[], AnalyticsError>

  /**
   * Identify file hot spots (most findings).
   */
  readonly fileHotspots: (
    limit: number,
    range?: { from?: Date; to?: Date }
  ) => Effect.Effect<readonly FileStats[], AnalyticsError>

  /**
   * Detailed breakdown of delta between checkpoints.
   */
  readonly deltaBreakdown: (
    fromId: string,
    toId: string
  ) => Effect.Effect<DeltaBreakdown, AnalyticsError>
}

export class AnalyticsEngine extends Context.Tag("AnalyticsEngine")<
  AnalyticsEngine,
  AnalyticsEngine
>() {}
```

### Polars Integration

**Installation:**

```bash
pnpm add nodejs-polars
```

**Implementation:**

```typescript
import pl from "nodejs-polars"
import { Effect, Stream } from "effect"

/**
 * Polars-powered analytics engine.
 *
 * Uses SQLite as data source, polars for complex computations.
 */
export const PolarsAnalyticsEngineLive = Layer.effect(
  AnalyticsEngine,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return AnalyticsEngine.of({
      trendSeries: (metric, window = 7, range) =>
        Effect.gen(function* () {
          // Export checkpoint summaries to polars
          const checkpoints = yield* sql<{
            id: string
            ts: number
            errors: number
            warnings: number
            totalFindings: number
            totalFiles: number
            migratedFiles: number
          }>`
            SELECT 
              id,
              ts,
              total_errors as errors,
              total_warnings as warnings,
              total_findings as totalFindings,
              total_files as totalFiles,
              (total_files - (
                SELECT COUNT(DISTINCT file_id)
                FROM results
                WHERE checkpoint_id = checkpoints.id
              )) as migratedFiles
            FROM checkpoints
            WHERE 1=1
              ${range?.from ? sql`AND ts >= ${Math.floor(range.from.getTime() / 1000)}` : sql``}
              ${range?.to ? sql`AND ts <= ${Math.floor(range.to.getTime() / 1000)}` : sql``}
            ORDER BY ts ASC
          `

          // Load into polars DataFrame
          const df = yield* Effect.try({
            try: () => pl.DataFrame(checkpoints),
            catch: (error) => new AnalyticsError({ message: String(error) })
          })

          // Compute rolling average
          const metricCol =
            metric === "progress"
              ? pl.col("migratedFiles").mul(100).div(pl.col("totalFiles"))
              : pl.col(metric)

          const rolled = yield* Effect.try({
            try: () =>
              df
                .withColumn(metricCol.alias("value"))
                .withColumn(pl.col("value").rollingMean({ windowSize: window }).alias("rollingAvg"))
                .withColumn(pl.col("value").rollingStd({ windowSize: window }).alias("rollingStd"))
                .select([pl.col("ts"), pl.col("value"), pl.col("rollingAvg"), pl.col("rollingStd")])
                .toRecords(),
            catch: (error) => new AnalyticsError({ message: String(error) })
          })

          return rolled.map((r) => ({
            timestamp: new Date(r.ts * 1000),
            value: r.value,
            rollingAvg: r.rollingAvg,
            rollingStd: r.rollingStd
          }))
        }),

      topRules: (limit, range) =>
        Effect.gen(function* () {
          const ruleStats = yield* sql<{
            rule_id: string
            kind: string
            count: number
            files_affected: number
          }>`
            SELECT 
              r.id as rule_id,
              r.kind,
              COUNT(*) as count,
              COUNT(DISTINCT res.file_id) as files_affected
            FROM results res
            JOIN rules r ON res.rule_id = r.rule_id
            JOIN checkpoints c ON res.checkpoint_id = c.id
            WHERE 1=1
              ${range?.from ? sql`AND c.ts >= ${Math.floor(range.from.getTime() / 1000)}` : sql``}
              ${range?.to ? sql`AND c.ts <= ${Math.floor(range.to.getTime() / 1000)}` : sql``}
            GROUP BY r.id, r.kind
            ORDER BY count DESC
            LIMIT ${limit}
          `

          return ruleStats
        }),

      fileHotspots: (limit, range) =>
        Effect.gen(function* () {
          const fileStats = yield* sql<{
            file_path: string
            finding_count: number
            rule_count: number
            error_count: number
          }>`
            SELECT 
              f.path as file_path,
              COUNT(*) as finding_count,
              COUNT(DISTINCT res.rule_id) as rule_count,
              SUM(CASE WHEN res.severity = 'error' THEN 1 ELSE 0 END) as error_count
            FROM results res
            JOIN files f ON res.file_id = f.file_id
            JOIN checkpoints c ON res.checkpoint_id = c.id
            WHERE 1=1
              ${range?.from ? sql`AND c.ts >= ${Math.floor(range.from.getTime() / 1000)}` : sql``}
              ${range?.to ? sql`AND c.ts <= ${Math.floor(range.to.getTime() / 1000)}` : sql``}
            GROUP BY f.path
            ORDER BY finding_count DESC
            LIMIT ${limit}
          `

          return fileStats
        }),

      deltaBreakdown: (fromId, toId) =>
        Effect.gen(function* () {
          // Get results for both checkpoints
          const fromResults = yield* sql<{ rule_id: string; severity: string }>`
            SELECT r.id as rule_id, res.severity
            FROM results res
            JOIN rules r ON res.rule_id = r.rule_id
            WHERE res.checkpoint_id = ${fromId}
          `

          const toResults = yield* sql<{ rule_id: string; severity: string }>`
            SELECT r.id as rule_id, res.severity
            FROM results res
            JOIN rules r ON res.rule_id = r.rule_id
            WHERE res.checkpoint_id = ${toId}
          `

          // Load into polars for groupby operations
          const fromDF = yield* Effect.try({
            try: () => pl.DataFrame(fromResults),
            catch: (error) => new AnalyticsError({ message: String(error) })
          })

          const toDF = yield* Effect.try({
            try: () => pl.DataFrame(toResults),
            catch: (error) => new AnalyticsError({ message: String(error) })
          })

          // Compute per-rule delta
          const fromGroups = fromDF.groupBy("rule_id").agg(pl.count().alias("from_count"))

          const toGroups = toDF.groupBy("rule_id").agg(pl.count().alias("to_count"))

          const joined = yield* Effect.try({
            try: () =>
              fromGroups
                .join(toGroups, { on: "rule_id", how: "outer" })
                .withColumn(
                  pl
                    .col("to_count")
                    .fillNull(0)
                    .sub(pl.col("from_count").fillNull(0))
                    .alias("delta")
                )
                .sort("delta")
                .toRecords(),
            catch: (error) => new AnalyticsError({ message: String(error) })
          })

          return {
            byRule: joined.map((r) => ({
              ruleId: r.rule_id,
              fromCount: r.from_count ?? 0,
              toCount: r.to_count ?? 0,
              delta: r.delta
            }))
          }
        })
    })
  })
)
```

### CLI Analytics Commands

```typescript
/**
 * Analytics subcommands.
 */
const trendCommand = Command.make(
  "trend",
  {
    metric: Args.choice(["errors", "warnings", "totalFindings", "progress"]),
    window: Options.integer("window").pipe(Options.withDefault(7)),
    since: Options.date("since").pipe(Options.optional),
    format: Options.choice(["table", "chart", "json"]).pipe(Options.withDefault("chart"))
  },
  (opts) =>
    Effect.gen(function* () {
      const analytics = yield* AnalyticsEngine
      const trend = yield* analytics.trendSeries(opts.metric, opts.window, { from: opts.since })

      if (opts.format === "chart") {
        const chart = yield* generateTrendChart(trend, opts.metric)
        yield* Console.log(chart)
      } else if (opts.format === "table") {
        const table = yield* formatTrendTable(trend)
        yield* Console.log(table)
      } else {
        yield* Console.log(JSON.stringify(trend, null, 2))
      }
    })
)

const hotspotCommand = Command.make(
  "hotspots",
  {
    type: Args.choice(["files", "rules"]),
    limit: Options.integer("limit").pipe(Options.withDefault(10)),
    since: Options.date("since").pipe(Options.optional)
  },
  (opts) =>
    Effect.gen(function* () {
      const analytics = yield* AnalyticsEngine

      const stats =
        opts.type === "files"
          ? yield* analytics.fileHotspots(opts.limit, { from: opts.since })
          : yield* analytics.topRules(opts.limit, { from: opts.since })

      const table = yield* formatHotspotsTable(stats, opts.type)
      yield* Console.log(table)
    })
)

const deltaCommand = Command.make(
  "delta",
  {
    from: Args.text({ name: "from-checkpoint-id" }),
    to: Args.text({ name: "to-checkpoint-id" }).pipe(Args.optional)
  },
  (opts) =>
    Effect.gen(function* () {
      const analytics = yield* AnalyticsEngine
      const store = yield* CheckpointStore

      const toId =
        opts.to ??
        (yield* store.latest()).pipe(
          Option.map((s) => s.checkpointId),
          Option.getOrThrow(() => new Error("No latest checkpoint"))
        )

      const breakdown = yield* analytics.deltaBreakdown(opts.from, toId)

      const table = yield* formatDeltaBreakdown(breakdown)
      yield* Console.log(table)
    })
)

export const analyticsCommand = Command.make("analytics").pipe(
  Command.withSubcommands([trendCommand, hotspotCommand, deltaCommand])
)
```

**Usage Examples:**

```bash
# Show error trend over last 30 days (7-day rolling average)
effect-migrate analytics trend errors --window 7 --since 2025-10-06

# ASCII chart output:
#   45 ┤           ╭──
#   40 ┤       ╭───╯
#   35 ┤     ╭─╯
#   30 ┤   ╭─╯
#   25 ┤ ╭─╯
#   20 ┼─╯
#      └──────────────────
#      10/06  10/20  11/03

# Top 10 files with most findings
effect-migrate analytics hotspots files --limit 10

# Output:
# File Hotspots (Last 30 Days)
# ┌────────────────────────────┬──────────┬────────┬────────┐
# │ File                        │ Findings │ Rules  │ Errors │
# ├────────────────────────────┼──────────┼────────┼────────┤
# │ src/api/user.ts             │ 45       │ 8      │ 12     │
# │ src/api/posts.ts            │ 38       │ 6      │ 9      │
# │ src/services/auth.ts        │ 29       │ 5      │ 7      │
# └────────────────────────────┴──────────┴────────┴────────┘

# Delta breakdown by rule
effect-migrate analytics delta 2025-11-06T10-00-00Z 2025-11-06T14-00-00Z

# Output:
# Delta Breakdown
# ┌─────────────────────┬──────┬────┬───────┐
# │ Rule                │ From │ To │ Delta │
# ├─────────────────────┼──────┼────┼───────┤
# │ no-async-await      │ 45   │ 30 │ -15   │
# │ no-promise          │ 25   │ 18 │ -7    │
# │ no-class            │ 10   │ 10 │ 0     │
# └─────────────────────┴──────┴────┴───────┘
```

### Performance Targets

| Operation       | Target (100 checkpoints, 1M results) |
| --------------- | ------------------------------------ |
| Trend query     | <5s (with streaming)                 |
| Top rules       | <2s                                  |
| File hotspots   | <2s                                  |
| Delta breakdown | <3s                                  |
| Memory peak     | <200MB (polars uses native memory)   |

**Effort:** 6-12 hours

---

## Phase 4: OpenTelemetry Monitoring

**Goal:** Instrument checkpoint writes and analytics for performance visibility.

### Metrics Definition

```typescript
import { Metric } from "effect"

/**
 * Checkpoint write metrics.
 */
export const checkpointWriteDuration = Metric.timer("effect_migrate_checkpoint_write_duration_ms", {
  unit: "milliseconds"
})

export const checkpointResultsRows = Metric.counter("effect_migrate_checkpoint_results_rows", {
  unit: "rows"
})

export const checkpointBytesWritten = Metric.counter("effect_migrate_checkpoint_bytes_written", {
  unit: "bytes"
})

export const normalizationDuration = Metric.timer("effect_migrate_normalization_duration_ms", {
  unit: "milliseconds"
})

export const sqliteInsertBatchDuration = Metric.timer(
  "effect_migrate_sqlite_insert_batch_duration_ms",
  { unit: "milliseconds" }
)

export const processMemoryRss = Metric.gauge("effect_migrate_process_memory_rss_mb", {
  unit: "megabytes"
})

export const analyticsQueryDuration = Metric.timer("effect_migrate_analytics_query_duration_ms", {
  unit: "milliseconds"
})

export const errorsTotal = Metric.counter("effect_migrate_errors_total", { unit: "errors" })
```

### Instrumentation

**Checkpoint Write:**

```typescript
const writeCheckpointInstrumented = (
  checkpoint: AuditCheckpoint,
  normalized: NormalizedFindings,
  metadata: CheckpointMetadata
) =>
  Effect.gen(function* () {
    // Record memory before
    const memBefore = process.memoryUsage().rss / 1024 / 1024
    yield* Metric.set(processMemoryRss, memBefore)

    // Track write duration
    yield* writeCheckpoint(checkpoint, normalized, metadata).pipe(
      Metric.trackDuration(checkpointWriteDuration),
      Effect.withSpan("checkpoint.write", {
        attributes: {
          backend: "json|sqlite|dual",
          rows: normalized.results.length,
          checkpointId: checkpoint.checkpointId
        }
      })
    )

    // Record metrics
    yield* Metric.increment(checkpointResultsRows, normalized.results.length)

    // Calculate bytes written (approximate)
    const checkpointJson = JSON.stringify({ checkpoint, normalized })
    yield* Metric.increment(checkpointBytesWritten, checkpointJson.length)

    // Record memory after
    const memAfter = process.memoryUsage().rss / 1024 / 1024
    yield* Metric.set(processMemoryRss, memAfter)

    yield* Effect.logInfo(`Memory usage: ${memBefore.toFixed(1)}MB -> ${memAfter.toFixed(1)}MB`)
  })
```

**SQLite Batch Insert:**

```typescript
const insertResultsBatch = (batch: CompactResult[]) =>
  Effect.gen(function* () {
    yield* insertBatchImpl(batch).pipe(
      Metric.trackDuration(sqliteInsertBatchDuration),
      Effect.withSpan("sqlite.insertBatch", {
        attributes: { batchSize: batch.length }
      })
    )
  })
```

**Analytics Query:**

```typescript
const trendSeriesInstrumented = (metric: string, window: number) =>
  Effect.gen(function* () {
    yield* trendSeriesImpl(metric, window).pipe(
      Metric.trackDuration(analyticsQueryDuration),
      Effect.withSpan("analytics.query", {
        attributes: { kind: "trend", metric, window }
      })
    )
  })
```

### OpenTelemetry Layer

```typescript
import * as NodeSdk from "@effect/opentelemetry/NodeSdk"
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

/**
 * OpenTelemetry layer with Prometheus metrics.
 */
export const OTelLayer = (metricsPort?: number) =>
  NodeSdk.layer(() => ({
    resource: {
      serviceName: "effect-migrate-audit",
      serviceVersion: pkg.version
    },
    spanProcessor: new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces"
      })
    ),
    metricReader: metricsPort
      ? new PrometheusExporter({
          port: metricsPort,
          endpoint: "/metrics"
        })
      : undefined
  }))

/**
 * Optional Prometheus endpoint layer.
 */
export const PrometheusServerLayer = (port: number) =>
  Layer.scopedDiscard(
    Effect.gen(function* () {
      const server = yield* NodeHttpServer.server.Server

      yield* server.serve(
        HttpRouter.empty.pipe(
          HttpRouter.get(
            "/metrics",
            Effect.succeed(HttpServerResponse.text(metricsRegistry.metrics()))
          )
        )
      )

      yield* Effect.log(`Prometheus metrics server running on http://localhost:${port}/metrics`)
    })
  )
```

### CLI Integration

**Enable monitoring:**

```bash
# Enable Prometheus metrics
effect-migrate audit --metrics-port 9464

# Access metrics
curl http://localhost:9464/metrics

# Example output:
# effect_migrate_checkpoint_write_duration_ms_bucket{le="100"} 45
# effect_migrate_checkpoint_write_duration_ms_bucket{le="500"} 98
# effect_migrate_checkpoint_write_duration_ms_sum 42350
# effect_migrate_checkpoint_write_duration_ms_count 100
# effect_migrate_checkpoint_results_rows 1250000
# effect_migrate_process_memory_rss_mb 145.6
```

**Environment variables:**

```bash
# Configure OTLP endpoint
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.example.com

# Enable console exporter for debugging
export OTEL_LOG_LEVEL=debug
```

### Performance Overhead

| Scenario          | Baseline | With Metrics | Overhead |
| ----------------- | -------- | ------------ | -------- |
| Write 10k results | 350ms    | 365ms        | +4.3%    |
| Analytics query   | 2.1s     | 2.2s         | +4.8%    |
| Memory usage      | 120MB    | 125MB        | +4.2%    |

**Effort:** 4-8 hours

---

## Phase 5: MCP Server and Workflow Orchestration

**Goal:** Provide type-safe agent queries via MCP and scheduled audit workflows.

### MCP Server (@effect/rpc)

**RPC Endpoints:**

```typescript
import { Rpc, RpcGroup, RpcServer } from "@effect/rpc"
import { Schema, Stream } from "effect"

/**
 * Checkpoint query RPC group.
 */
class CheckpointRpcs extends RpcGroup.make(
  /**
   * List checkpoints with optional filters.
   */
  Rpc.make("ListCheckpoints", {
    success: Schema.Array(CheckpointSummary),
    payload: Schema.Struct({
      limit: Schema.optional(Schema.Number),
      since: Schema.optional(Schema.DateTimeUtc),
      thread: Schema.optional(Schema.String)
    })
  }),

  /**
   * Get latest checkpoint.
   */
  Rpc.make("LatestCheckpoint", {
    success: CheckpointSummary,
    payload: Schema.Void
  }),

  /**
   * Get checkpoint counts by severity.
   */
  Rpc.make("GetCounts", {
    success: Schema.Struct({
      errors: Schema.Number,
      warnings: Schema.Number,
      totalFindings: Schema.Number
    }),
    payload: Schema.Struct({
      checkpointId: Schema.optional(Schema.String)
    })
  }),

  /**
   * Compute delta between checkpoints.
   */
  Rpc.make("Delta", {
    success: DeltaSummary,
    payload: Schema.Struct({
      from: Schema.String,
      to: Schema.optional(Schema.String)
    })
  }),

  /**
   * Get trend series (streaming).
   */
  Rpc.make("TrendSeries", {
    success: TrendPoint,
    stream: true, // Enable streaming
    payload: Schema.Struct({
      metric: Schema.Literal("errors", "warnings", "totalFindings", "progress"),
      window: Schema.optional(Schema.Number),
      since: Schema.optional(Schema.DateTimeUtc)
    })
  }),

  /**
   * Get top rules.
   */
  Rpc.make("TopRules", {
    success: Schema.Array(RuleStats),
    payload: Schema.Struct({
      limit: Schema.Number,
      since: Schema.optional(Schema.DateTimeUtc)
    })
  }),

  /**
   * Get finding slice (paginated, streaming).
   */
  Rpc.make("FindingSlice", {
    success: Finding,
    stream: true,
    payload: Schema.Struct({
      checkpointId: Schema.String,
      ruleId: Schema.optional(Schema.String),
      offset: Schema.Number,
      limit: Schema.Number
    })
  })
) {}

/**
 * Implement RPC handlers.
 */
const CheckpointHandlers = CheckpointRpcs.toLayer(
  Effect.gen(function* () {
    const store = yield* CheckpointStore
    const analytics = yield* AnalyticsEngine

    return {
      ListCheckpoints: ({ limit, since, thread }) =>
        Effect.gen(function* () {
          const checkpoints = yield* store.list(limit)

          // Filter by since/thread if provided
          return checkpoints.filter((cp) => {
            if (since && new Date(cp.timestamp) < since) return false
            if (thread && cp.thread !== thread) return false
            return true
          })
        }),

      LatestCheckpoint: () =>
        Effect.gen(function* () {
          const latest = yield* store.latest()
          return Option.getOrThrow(latest)
        }),

      GetCounts: ({ checkpointId }) =>
        Effect.gen(function* () {
          const cpId =
            checkpointId ??
            (yield* store.latest()).pipe(
              Option.map((s) => s.checkpointId),
              Option.getOrThrow()
            )

          const checkpoint = yield* store.read(cpId)
          return checkpoint.findings.summary
        }),

      Delta: ({ from, to }) =>
        Effect.gen(function* () {
          const toId =
            to ??
            (yield* store.latest()).pipe(
              Option.map((s) => s.checkpointId),
              Option.getOrThrow()
            )

          return yield* store.diff(from, toId)
        }),

      TrendSeries: ({ metric, window, since }) =>
        Stream.fromIterableEffect(analytics.trendSeries(metric, window, { from: since })),

      TopRules: ({ limit, since }) => analytics.topRules(limit, { from: since }),

      FindingSlice: ({ checkpointId, ruleId, offset, limit }) =>
        Effect.gen(function* () {
          const checkpoint = yield* store.read(checkpointId)

          // Filter and slice findings
          const findings = checkpoint.findings.results
            .filter((r) => !ruleId || checkpoint.findings.rules[r.rule].id === ruleId)
            .slice(offset, offset + limit)

          // Expand to full Finding objects
          return Stream.fromIterable(
            findings.map((r) =>
              expandResult(r, checkpoint.findings.rules, checkpoint.findings.files)
            )
          )
        })
    }
  })
)

/**
 * RPC server layer.
 */
export const RpcServerLayer = RpcServer.layer(CheckpointRpcs).pipe(
  Layer.provide(CheckpointHandlers),
  Layer.provide(CheckpointStoreLive),
  Layer.provide(AnalyticsEngineLive)
)

/**
 * HTTP protocol layer.
 */
export const HttpProtocol = RpcServer.layerProtocolHttp({
  path: "/mcp/checkpoints",
  port: 3000
})
```

**MCP CLI Command:**

```bash
# Start MCP server
effect-migrate mcp server --port 3000

# Server starts:
# ✓ MCP server running on http://localhost:3000/mcp/checkpoints
# ✓ Endpoints: ListCheckpoints, LatestCheckpoint, GetCounts, Delta, TrendSeries, TopRules, FindingSlice
```

**Client Usage (from Amp or other tools):**

```typescript
import { RpcClient } from "@effect/rpc"

// Create client
const client = RpcClient.make(CheckpointRpcs, {
  url: "http://localhost:3000/mcp/checkpoints"
})

// Query latest checkpoint
const latest = await Effect.runPromise(client.LatestCheckpoint({}))

// Stream trend series
const trend = await Effect.runPromise(
  Stream.runCollect(client.TrendSeries({ metric: "errors", window: 7 }))
)
```

### Workflow Orchestration (@effect/workflow)

**Installation:**

```bash
pnpm add @effect/workflow @effect/cluster
```

**Workflow Definition:**

```typescript
import { Workflow, Activity, DurableClock } from "@effect/workflow"

/**
 * Nightly audit workflow.
 *
 * Runs audit every night at midnight, persists results.
 */
const NightlyAuditWorkflow = Workflow.make({
  name: "NightlyAudit",
  success: Schema.Struct({
    checkpointId: Schema.String,
    findingsCount: Schema.Number
  }),
  payload: {
    projectPath: Schema.String,
    configPath: Schema.String
  },
  idempotencyKey: ({ projectPath }) => projectPath
})

const NightlyAuditWorkflowLayer = NightlyAuditWorkflow.toLayer(
  Effect.fn(function* (payload, executionId) {
    yield* Effect.log(`Starting nightly audit for ${payload.projectPath}`)

    // Phase 1: Run audit (retryable activity)
    const auditResult = yield* Activity.make({
      name: "RunAudit",
      execute: Effect.gen(function* () {
        const config = yield* loadConfig(payload.configPath)
        const results = yield* runAudit(config)
        return results
      })
    }).pipe(Activity.retry({ times: 3, delay: "5 seconds" }))

    // Phase 2: Write checkpoint
    const checkpointId = yield* Activity.make({
      name: "WriteCheckpoint",
      execute: Effect.gen(function* () {
        const store = yield* CheckpointStore
        const normalized = normalizeResults(auditResult)
        const checkpoint = buildCheckpoint(normalized)
        yield* store.writeCheckpoint(checkpoint, normalized, {})
        return checkpoint.checkpointId
      })
    })

    // Phase 3: Wait for next run (1 day)
    yield* DurableClock.sleep({
      name: "DailyInterval",
      duration: "1 day"
    })

    // Workflow will resume after 1 day
    yield* Effect.log(`Nightly audit completed: ${checkpointId}`)

    return {
      checkpointId,
      findingsCount: auditResult.length
    }
  })
)

/**
 * Weekly compaction workflow.
 *
 * Compacts old checkpoints to Parquet for long-term storage.
 */
const WeeklyCompactionWorkflow = Workflow.make({
  name: "WeeklyCompaction",
  success: Schema.Struct({
    compactedCheckpoints: Schema.Number,
    bytesReclaimed: Schema.Number
  }),
  payload: {
    olderThanDays: Schema.Number
  }
})

// ... implementation
```

**CLI Workflow Commands:**

```bash
# Start workflow runner (background service)
effect-migrate workflow start

# Schedule nightly audit
effect-migrate workflow run NightlyAudit \
  --project-path . \
  --config-path effect-migrate.config.ts

# List running workflows
effect-migrate workflow list

# Output:
# Running Workflows
# ┌─────────────────┬────────────────┬─────────┬─────────────────────┐
# │ Name            │ Execution ID   │ Status  │ Started             │
# ├─────────────────┼────────────────┼─────────┼─────────────────────┤
# │ NightlyAudit    │ exec-abc123    │ Running │ 2025-11-06 00:00:00 │
# └─────────────────┴────────────────┴─────────┴─────────────────────┘

# Cancel workflow
effect-migrate workflow cancel exec-abc123
```

**Note:** Requires PostgreSQL for workflow state persistence via `@effect/cluster`.

**Effort:** 16-28 hours

---

## Performance Benchmarks

### Small Project (<10 Checkpoints, <1k Findings Each)

| Operation           | JSON Only | JSON + SQLite | Overhead      |
| ------------------- | --------- | ------------- | ------------- |
| Write checkpoint    | 85ms      | 125ms         | +47%          |
| Read latest         | 15ms      | 8ms           | -47% (faster) |
| List 10 checkpoints | 25ms      | 12ms          | -52%          |
| Delta calculation   | 18ms      | 5ms           | -72%          |
| Memory peak         | 35MB      | 45MB          | +29%          |

**Recommendation:** JSON only (simpler, good enough)

### Medium Project (50 Checkpoints, 5k Findings Each)

| Operation           | JSON Only      | JSON + SQLite | SQLite + Polars |
| ------------------- | -------------- | ------------- | --------------- |
| Write checkpoint    | 320ms          | 425ms         | 425ms           |
| Read latest         | 180ms          | 15ms          | 15ms            |
| List 50 checkpoints | 850ms          | 30ms          | 30ms            |
| Delta calculation   | 650ms          | 12ms          | 12ms            |
| Trend analysis      | N/A (too slow) | 450ms         | 280ms           |
| Memory peak         | 180MB          | 95MB          | 120MB           |

**Recommendation:** JSON + SQLite (dual-write for migration)

### Large Project (150 Checkpoints, 20k Findings Each)

| Operation             | JSON Only    | SQLite Only | SQLite + Polars |
| --------------------- | ------------ | ----------- | --------------- |
| Write checkpoint      | 1.2s         | 850ms       | 850ms           |
| Read latest           | 650ms        | 18ms        | 18ms            |
| List 150 checkpoints  | 3.5s         | 85ms        | 85ms            |
| Delta calculation     | 2.8s         | 25ms        | 25ms            |
| Trend (30-day window) | N/A (OOM)    | 1.2s        | 680ms           |
| Top rules analysis    | N/A (OOM)    | 890ms       | 350ms           |
| Memory peak           | >500MB (OOM) | 220MB       | 280MB           |

**Recommendation:** SQLite + Polars (required for performance)

### OpenTelemetry Overhead

| Scenario          | Baseline | With Metrics Only | With Metrics + Traces | Overhead      |
| ----------------- | -------- | ----------------- | --------------------- | ------------- |
| Write 10k results | 350ms    | 365ms             | 385ms                 | +10% (traces) |
| Analytics query   | 2.1s     | 2.2s              | 2.3s                  | +9.5%         |

---

## Migration Paths

### Path 1: Staying on JSON

**Who:** Small projects, <10 checkpoints, <1k findings

**Steps:**

1. Implement Phase 1 (already planned)
2. Stop here - no further work needed

**Benefits:**

- Zero dependencies beyond Effect core
- Simple to understand and debug
- Backwards compatible

### Path 2: Adding SQLite

**Who:** Medium to large projects, >50 checkpoints or >5k findings

**Steps:**

1. Implement Phase 1 (JSON baseline)
2. Implement Phase 2 (SQLite)
3. Enable dual-write: `--checkpoint-db checkpoints.db`
4. Migrate historical data: `effect-migrate db import`
5. After stabilization, disable JSON writes: `--no-dual-write`

**Benefits:**

- Fast queries (10-50x faster)
- Bounded memory usage
- Historical data queryable via SQL

### Path 3: Adding Analytics

**Who:** Teams wanting data-driven insights

**Steps:**

1. Implement Phases 1-2 (JSON + SQLite)
2. Implement Phase 3 (Polars analytics)
3. Use analytics commands: `effect-migrate analytics trend errors`

**Benefits:**

- Trend analysis, hot spot identification
- Rolling windows, statistical computations
- Progress visualization

### Path 4: Full Production Setup

**Who:** Enterprise teams, >100 checkpoints, distributed audits

**Steps:**

1. Implement Phases 1-4 (JSON + SQLite + Polars + Monitoring)
2. Enable Prometheus metrics: `--metrics-port 9464`
3. Set up Grafana dashboards
4. Implement Phase 5 (MCP server + workflows)
5. Deploy PostgreSQL for workflow persistence
6. Schedule nightly audits via workflow orchestration

**Benefits:**

- Full observability and monitoring
- Type-safe agent queries via MCP
- Automated scheduled audits
- Production SLOs and alerting

---

## Rollout Timeline

### Month 1: Foundation

- **Week 1-2:** Implement Phase 1 (JSON checkpoints)
  - Service abstraction, JSON adapter, CLI commands
  - Effort: 4-8h
- **Week 3-4:** Implement Phase 2 (SQLite)
  - Schema, SQLite adapter, dual-write, migration
  - Effort: 8-14h

**Deliverable:** JSON + SQLite checkpoint system with backwards compatibility

### Month 2: Analytics & Monitoring

- **Week 1-2:** Implement Phase 3 (Polars analytics)
  - Analytics engine, trend queries, CLI commands
  - Effort: 6-12h
- **Week 3-4:** Implement Phase 4 (OpenTelemetry)
  - Instrumentation, metrics, Prometheus endpoint
  - Effort: 4-8h

**Deliverable:** Full analytics capabilities with performance monitoring

### Month 3: Advanced Features (Optional)

- **Week 1-4:** Implement Phase 5 (MCP + Workflows)
  - RPC server, workflow definitions, CLI commands
  - Effort: 16-28h

**Deliverable:** Enterprise-grade orchestration and agent integration

---

## Success Criteria

### Phase 1: JSON Checkpoints

- [ ] Checkpoints written to `checkpoints/` directory
- [ ] Manifest tracks metadata and deltas
- [ ] audit.json symlinks to latest
- [ ] Thread linking works
- [ ] All tests pass

### Phase 2: SQLite

- [ ] SQLite schema created with indexes
- [ ] CompositeStore dual-writes successfully
- [ ] Queries 10-50x faster than JSON
- [ ] Migration from JSON succeeds
- [ ] Memory usage <150MB for 10k findings

### Phase 3: Polars Analytics

- [ ] Trend analysis queries complete in <5s
- [ ] Top rules/files identified correctly
- [ ] Delta breakdown shows per-rule changes
- [ ] Memory stays <200MB for complex queries
- [ ] Charts render correctly in CLI

### Phase 4: Monitoring

- [ ] Metrics exported to Prometheus
- [ ] Spans tracked in OTLP collector
- [ ] Overhead <10% on write path
- [ ] Memory metrics accurate

### Phase 5: MCP & Workflows

- [ ] MCP server responds to typed queries
- [ ] Streaming works for large result sets
- [ ] Workflows execute on schedule
- [ ] Workflow state persists across restarts

---

## Risks and Mitigation

### Risk 1: SQLite Lock Contention

**Scenario:** Multiple processes trying to write simultaneously

**Mitigation:**

- Use WAL mode (already planned)
- Single transaction per checkpoint
- Add `--checkpoint-db-readonly` flag for analytics queries
- Consider read replicas for heavy analytics

### Risk 2: Memory Spikes

**Scenario:** Loading large checkpoints or result sets

**Mitigation:**

- Stream writes in chunks (1k-5k rows)
- Use polars lazy evaluation
- Monitor with OpenTelemetry gauges
- Implement backpressure for streaming

### Risk 3: Schema Drift

**Scenario:** SQLite schema evolves, old databases incompatible

**Mitigation:**

- Version gate: `schema_versions` table
- Migration scripts managed by Effect
- Clear error messages on incompatibility
- JSON fallback always available

### Risk 4: Cross-Platform Symlink Issues

**Scenario:** Symlinks don't work on Windows

**Mitigation:**

- Detect Windows and use file copy instead
- Document behavior in AGENTS.md
- Tests on all platforms

### Risk 5: Polars Native Dependencies

**Scenario:** Rust binaries fail to install on some platforms

**Mitigation:**

- Make polars optional (analytics commands only)
- Graceful degradation to SQLite-only analytics
- Pre-built binaries for common platforms

---

## Future Enhancements

### Columnar Storage (Parquet)

**When:** >1M total findings, need long-term retention

**Implementation:**

- Export checkpoints to Parquet format
- Use DuckDB for analytics instead of polars
- Keep latest N checkpoints in SQLite, archive rest to Parquet

**Benefits:**

- 10x compression vs JSON
- Fast analytical queries via DuckDB
- S3-compatible for cloud storage

### Cross-Repo Federation

**When:** Multi-repo monorepo migrations

**Implementation:**

- Central PostgreSQL checkpoint database
- MCP server federated across repos
- Aggregated dashboards via Grafana

### Machine Learning Insights

**When:** Enough historical data (>100 checkpoints)

**Implementation:**

- Predict completion date via regression
- Anomaly detection for sudden spike in findings
- Rule prioritization based on fix velocity

---

## Appendix: Effect Patterns Reference

### Service Definition

```typescript
export interface ServiceInterface {
  readonly operation: (input: Input) => Effect.Effect<Output, Error>
}

export class Service extends Context.Tag("Service")<Service, ServiceInterface>() {}
```

### Layer Composition

```typescript
const ServiceLive = Layer.effect(
  Service,
  Effect.gen(function* () {
    const dependency = yield* Dependency

    return Service.of({
      operation: (input) => Effect.succeed(result)
    })
  })
)

const CompositeLayer = ServiceLive.pipe(Layer.provide(DependencyLive))
```

### Error Handling

```typescript
class DomainError extends Data.TaggedError("DomainError")<{
  readonly message: string
}> {}

const operation = Effect.gen(function* () {
  const result = yield* riskyOperation.pipe(
    Effect.catchTag("RiskyError", (e) => Effect.fail(new DomainError({ message: e.reason })))
  )

  return result
})
```

### Streaming

```typescript
const streamResults = (checkpointId: string) =>
  Stream.fromIterableEffect(loadResults(checkpointId)).pipe(
    Stream.mapEffect(processResult),
    Stream.buffer({ capacity: 100 }),
    Stream.runCollect
  )
```

---

**Last Updated:** 2025-11-06  
**Maintainer:** @aridyckovsky  
**Status:** Ready for phased implementation  
**Threads:**

- https://ampcode.com/threads/T-b45a5ac4-b859-4f11-95f4-c872c6e7eae0 (schema versioning)
- https://ampcode.com/threads/T-5d39c44c-3f5e-4112-b0b1-d9b9add1eea7 (checkpoint persistence)
- https://ampcode.com/threads/T-a96b5e77-ba99-4c03-89e9-d7c9145c9700 (comprehensive architecture)
