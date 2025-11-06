---
created: 2025-11-06
lastUpdated: 2025-11-06
author: Generated via Amp (Oracle + detailed analysis)
status: ready
thread: https://ampcode.com/threads/T-96089cb6-c4c1-4aea-8878-21670c44ea6d
audience: Development team and AI coding agents
tags: [pr-plan, analytics, polars, dataframes, wave3, performance]
related:
  - ./pr6-sqlite-backend.md
  - ./comprehensive-data-architecture.md
  - ./schema-versioning-and-normalization.md
  - ../../AGENTS.md
---

# PR7: Polars Analytics Engine

## Goal

Add nodejs-polars for advanced trend analysis and visualizations without loading all checkpoint data into memory.

**Estimated Effort:** 8-12 hours coding + 2-3 hours testing

**Dependencies:**

- PR6 (SQLite backend - Polars reads from SQLite)
- PR5 (CheckpointStore service abstraction)

---

## Overview

**Problem:** SQL queries for trend analysis are adequate but limited for complex statistical computations and time-series analysis. Loading all checkpoint data into JavaScript memory for analysis causes OOM errors on large projects (>100 checkpoints).

**Solution:** Use nodejs-polars DataFrames for:

- Lazy evaluation (doesn't load all data at once)
- Vectorized operations (10-50x faster than JS loops)
- Built-in rolling windows, aggregations, and time-series functions
- Interoperability with SQLite (read directly from database)

**Architecture:**

```
┌─────────────────────────┐
│  CLI Analytics Commands │
│  analytics trend        │
│  analytics top-rules    │
│  analytics hotspots     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│       AnalyticsEngine (Port)                │
│  ├─ trendSeries(metric, window)             │
│  ├─ topRules(limit, severity?)              │
│  ├─ fileHotspots(limit, ruleId?)            │
│  └─ deltaBreakdown(fromId, toId)            │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  PolarsAnalyticsEngineLive (Adapter)        │
│  ├─ Load data from SQLite → DataFrame       │
│  ├─ Apply lazy transformations              │
│  ├─ Compute aggregations                    │
│  └─ Return results as Effect                │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│           nodejs-polars                     │
│  ├─ pl.readDatabase(sql)                    │
│  ├─ .groupBy().agg()                        │
│  ├─ .rollingMean(), .rollingStd()           │
│  └─ .collect() / .fetchAll()                │
└─────────────────────────────────────────────┘
```

---

## Implementation Order

### Phase 1: Install Polars and Define Service Interface (1.5 hours)

#### Task 1.1: Install nodejs-polars

**File:** `package.json` (root)

```bash
pnpm add nodejs-polars
```

**Type definitions:**

```bash
pnpm add -D @types/nodejs-polars
```

**Note:** nodejs-polars includes Rust native bindings. Pre-built binaries exist for:

- macOS (Intel + ARM)
- Linux (x64 + ARM)
- Windows (x64)

If native bindings fail, the package falls back to WASM (slower but portable).

#### Task 1.2: Define AnalyticsEngine Service Interface

**File:** `packages/core/src/services/AnalyticsEngine.ts` (new)

**Purpose:** Port (interface) for analytics operations.

**Code:**

```typescript
/**
 * Analytics Engine Service.
 *
 * Provides advanced analytics and trend analysis over checkpoint data.
 *
 * @since 1.0.0
 */
import { Context, Effect, Schema, Data } from "effect"
import type { PlatformError } from "@effect/platform/Error"

/**
 * Time-series data point.
 */
export const TrendDataPoint = Schema.Struct({
  timestamp: Schema.String, // ISO timestamp
  value: Schema.Number,
  rollingMean: Schema.optional(Schema.Number),
  rollingStd: Schema.optional(Schema.Number)
})

export type TrendDataPoint = Schema.Schema.Type<typeof TrendDataPoint>

/**
 * Metric types for trend analysis.
 */
export type MetricType = "errors" | "warnings" | "totalFindings" | "totalFiles"

/**
 * Trend series result.
 */
export const TrendSeries = Schema.Struct({
  metric: Schema.String,
  window: Schema.Number,
  dataPoints: Schema.Array(TrendDataPoint)
})

export type TrendSeries = Schema.Schema.Type<typeof TrendSeries>

/**
 * Rule ranking.
 */
export const RuleRank = Schema.Struct({
  ruleId: Schema.String,
  ruleName: Schema.String,
  severity: Schema.String,
  findingCount: Schema.Number,
  fileCount: Schema.Number,
  percentage: Schema.Number // % of total findings
})

export type RuleRank = Schema.Schema.Type<typeof RuleRank>

/**
 * File hotspot.
 */
export const FileHotspot = Schema.Struct({
  filePath: Schema.String,
  findingCount: Schema.Number,
  ruleBreakdown: Schema.Array(
    Schema.Struct({
      ruleId: Schema.String,
      count: Schema.Number
    })
  )
})

export type FileHotspot = Schema.Schema.Type<typeof FileHotspot>

/**
 * Delta breakdown by rule.
 */
export const DeltaByRule = Schema.Struct({
  ruleId: Schema.String,
  ruleName: Schema.String,
  added: Schema.Number,
  removed: Schema.Number,
  net: Schema.Number
})

export type DeltaByRule = Schema.Schema.Type<typeof DeltaByRule>

/**
 * Analytics engine errors.
 */
export class AnalyticsError extends Data.TaggedError("AnalyticsError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Analytics Engine service interface.
 */
export interface AnalyticsEngineService {
  /**
   * Compute trend series for a metric over time.
   *
   * @param metric - Metric to track (errors, warnings, etc.)
   * @param window - Rolling window size (in checkpoints)
   * @returns Time-series data with rolling averages
   */
  readonly trendSeries: (
    metric: MetricType,
    window?: number
  ) => Effect.Effect<TrendSeries, AnalyticsError | PlatformError>

  /**
   * Rank rules by finding count.
   *
   * @param limit - Maximum number of rules to return
   * @param severity - Filter by severity (optional)
   * @returns Top rules ordered by finding count
   */
  readonly topRules: (
    limit?: number,
    severity?: "error" | "warning"
  ) => Effect.Effect<readonly RuleRank[], AnalyticsError | PlatformError>

  /**
   * Identify file hotspots (files with most findings).
   *
   * @param limit - Maximum number of files to return
   * @param ruleId - Filter by specific rule (optional)
   * @returns Files ordered by finding count
   */
  readonly fileHotspots: (
    limit?: number,
    ruleId?: string
  ) => Effect.Effect<readonly FileHotspot[], AnalyticsError | PlatformError>

  /**
   * Detailed delta breakdown by rule.
   *
   * @param fromId - Starting checkpoint ID
   * @param toId - Ending checkpoint ID
   * @returns Per-rule delta analysis
   */
  readonly deltaBreakdown: (
    fromId: string,
    toId: string
  ) => Effect.Effect<readonly DeltaByRule[], AnalyticsError | PlatformError>
}

/**
 * Analytics Engine service tag.
 */
export class AnalyticsEngine extends Context.Tag("AnalyticsEngine")<
  AnalyticsEngine,
  AnalyticsEngineService
>() {}
```

**Tests:** `packages/core/src/__tests__/services/AnalyticsEngine.test.ts` (new)

```typescript
import { describe, it, expect } from "@effect/vitest"
import { Schema } from "effect"
import { TrendDataPoint, RuleRank, FileHotspot, DeltaByRule } from "../../services/AnalyticsEngine.js"

describe("AnalyticsEngine Schemas", () => {
  it.effect("should validate TrendDataPoint", () =>
    Effect.gen(function* () {
      const data = {
        timestamp: "2025-11-06T10:00:00Z",
        value: 42,
        rollingMean: 38.5,
        rollingStd: 3.2
      }

      const decoded = yield* Schema.decodeUnknown(TrendDataPoint)(data)
      expect(decoded.value).toBe(42)
      expect(decoded.rollingMean).toBe(38.5)
    })
  )

  it.effect("should validate RuleRank", () =>
    Effect.gen(function* () {
      const data = {
        ruleId: "no-async-await",
        ruleName: "No Async/Await",
        severity: "error",
        findingCount: 125,
        fileCount: 18,
        percentage: 45.2
      }

      const decoded = yield* Schema.decodeUnknown(RuleRank)(data)
      expect(decoded.findingCount).toBe(125)
    })
  )
})
```

---

### Phase 2: Implement PolarsAnalyticsEngineLive (3.5 hours)

#### Task 2.1: Create Polars Service Layer

**File:** `packages/core/src/adapters/PolarsAnalyticsEngine.ts` (new)

**Purpose:** Polars-based implementation of AnalyticsEngine using SQLite data source.

**Code:**

```typescript
/**
 * Polars Analytics Engine Implementation.
 *
 * Uses nodejs-polars for advanced time-series and aggregation queries.
 *
 * @since 1.0.0
 */
import { Effect, Layer, Console } from "effect"
import * as pl from "nodejs-polars"
import * as SqlClient from "@effect/sql-sqlite-node"
import {
  AnalyticsEngine,
  type AnalyticsEngineService,
  type MetricType,
  type TrendSeries,
  type RuleRank,
  type FileHotspot,
  type DeltaByRule,
  AnalyticsError
} from "../services/AnalyticsEngine.js"

/**
 * Polars Analytics Engine Layer.
 *
 * Reads data from SQLite and uses Polars for analysis.
 */
export const PolarsAnalyticsEngineLive = Layer.effect(
  AnalyticsEngine,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return AnalyticsEngine.of({
      trendSeries: (metric: MetricType, window = 7) =>
        Effect.gen(function* () {
          yield* Console.log(`Computing trend series for ${metric} (window: ${window})`)

          // 1. Load checkpoint summaries from SQLite
          const query = `
            SELECT 
              id as checkpointId,
              ts,
              total_errors,
              total_warnings,
              total_findings,
              total_files
            FROM checkpoints
            ORDER BY ts ASC
          `

          const rows = yield* sql.unsafe(query).pipe(
            Effect.mapError(
              (e) =>
                new AnalyticsError({
                  message: `Failed to load checkpoints: ${e.message}`,
                  cause: e
                })
            )
          )

          // 2. Convert to Polars DataFrame
          const df = pl.DataFrame({
            checkpointId: rows.map((r) => r.checkpointId),
            ts: rows.map((r) => r.ts),
            errors: rows.map((r) => r.total_errors),
            warnings: rows.map((r) => r.total_warnings),
            totalFindings: rows.map((r) => r.total_findings),
            totalFiles: rows.map((r) => r.total_files)
          })

          // 3. Select metric column and compute rolling statistics
          const metricCol = df.select(metric)
          const rollingMean = metricCol.rollingMean(window, { center: false })
          const rollingStd = metricCol.rollingStd(window, { center: false })

          // 4. Combine into result DataFrame
          const resultDf = pl.DataFrame({
            timestamp: df.getColumn("ts").map((ts) => new Date(ts * 1000).toISOString()),
            value: metricCol.toArray(),
            rollingMean: rollingMean.toArray(),
            rollingStd: rollingStd.toArray()
          })

          // 5. Convert to TrendSeries
          const dataPoints = resultDf.toRecords().map((row) => ({
            timestamp: row.timestamp as string,
            value: row.value as number,
            rollingMean: row.rollingMean as number | undefined,
            rollingStd: row.rollingStd as number | undefined
          }))

          return {
            metric,
            window,
            dataPoints
          }
        }),

      topRules: (limit = 10, severity) =>
        Effect.gen(function* () {
          yield* Console.log(`Finding top ${limit} rules${severity ? ` (severity: ${severity})` : ""}`)

          // 1. Query results with rule metadata
          const severityFilter = severity ? `AND r.severity = '${severity}'` : ""

          const query = `
            SELECT 
              r.id as ruleId,
              r.message as ruleName,
              r.severity,
              COUNT(*) as findingCount,
              COUNT(DISTINCT res.file_id) as fileCount
            FROM results res
            JOIN rules r ON res.rule_id = r.rule_id
            WHERE 1=1 ${severityFilter}
            GROUP BY r.id, r.message, r.severity
            ORDER BY findingCount DESC
            LIMIT ${limit}
          `

          const rows = yield* sql.unsafe(query).pipe(
            Effect.mapError(
              (e) =>
                new AnalyticsError({
                  message: `Failed to load rule rankings: ${e.message}`,
                  cause: e
                })
            )
          )

          // 2. Get total findings for percentage calculation
          const totalQuery = severity
            ? `SELECT COUNT(*) as total FROM results res JOIN rules r ON res.rule_id = r.rule_id WHERE r.severity = '${severity}'`
            : `SELECT COUNT(*) as total FROM results`

          const totalResult = yield* sql.unsafe(totalQuery)
          const totalFindings = totalResult[0]?.total || 0

          // 3. Compute percentages
          const rankings: RuleRank[] = rows.map((row) => ({
            ruleId: row.ruleId,
            ruleName: row.ruleName,
            severity: row.severity,
            findingCount: row.findingCount,
            fileCount: row.fileCount,
            percentage: totalFindings > 0 ? (row.findingCount / totalFindings) * 100 : 0
          }))

          return rankings
        }),

      fileHotspots: (limit = 10, ruleId) =>
        Effect.gen(function* () {
          yield* Console.log(`Finding top ${limit} file hotspots${ruleId ? ` (rule: ${ruleId})` : ""}`)

          // 1. Query file-level aggregations
          const ruleFilter = ruleId
            ? `AND r.id = '${ruleId}'`
            : ""

          const query = `
            SELECT 
              f.path as filePath,
              COUNT(*) as findingCount,
              r.id as ruleId,
              COUNT(*) as ruleCount
            FROM results res
            JOIN files f ON res.file_id = f.file_id
            JOIN rules r ON res.rule_id = r.rule_id
            WHERE 1=1 ${ruleFilter}
            GROUP BY f.path, r.id
          `

          const rows = yield* sql.unsafe(query).pipe(
            Effect.mapError(
              (e) =>
                new AnalyticsError({
                  message: `Failed to load file hotspots: ${e.message}`,
                  cause: e
                })
            )
          )

          // 2. Use Polars to aggregate and rank
          const df = pl.DataFrame({
            filePath: rows.map((r) => r.filePath),
            ruleId: rows.map((r) => r.ruleId),
            count: rows.map((r) => r.ruleCount)
          })

          // 3. Group by file, aggregate rule counts
          const fileAgg = df
            .groupBy("filePath")
            .agg([
              pl.col("count").sum().alias("findingCount"),
              pl.struct(["ruleId", "count"]).alias("ruleBreakdown")
            ])
            .sort("findingCount", { descending: true })
            .limit(limit)

          // 4. Convert to FileHotspot objects
          const hotspots: FileHotspot[] = fileAgg.toRecords().map((row) => ({
            filePath: row.filePath as string,
            findingCount: row.findingCount as number,
            ruleBreakdown: (row.ruleBreakdown as Array<{ ruleId: string; count: number }>).map(
              (rb) => ({
                ruleId: rb.ruleId,
                count: rb.count
              })
            )
          }))

          return hotspots
        }),

      deltaBreakdown: (fromId: string, toId: string) =>
        Effect.gen(function* () {
          yield* Console.log(`Computing delta breakdown: ${fromId} → ${toId}`)

          // 1. Load results for both checkpoints
          const fromResults = yield* sql.unsafe(`
            SELECT 
              r.id as ruleId,
              r.message as ruleName,
              COUNT(*) as count
            FROM results res
            JOIN rules r ON res.rule_id = r.rule_id
            WHERE res.checkpoint_id = '${fromId}'
            GROUP BY r.id, r.message
          `)

          const toResults = yield* sql.unsafe(`
            SELECT 
              r.id as ruleId,
              r.message as ruleName,
              COUNT(*) as count
            FROM results res
            JOIN rules r ON res.rule_id = r.rule_id
            WHERE res.checkpoint_id = '${toId}'
            GROUP BY r.id, r.message
          `)

          // 2. Create DataFrames
          const fromDf = pl.DataFrame({
            ruleId: fromResults.map((r) => r.ruleId),
            ruleName: fromResults.map((r) => r.ruleName),
            fromCount: fromResults.map((r) => r.count)
          })

          const toDf = pl.DataFrame({
            ruleId: toResults.map((r) => r.ruleId),
            ruleName: toResults.map((r) => r.ruleName),
            toCount: toResults.map((r) => r.count)
          })

          // 3. Outer join to capture added/removed rules
          const joined = fromDf
            .join(toDf, { on: "ruleId", how: "outer" })
            .withColumn(pl.col("fromCount").fillNull(0).alias("removed"))
            .withColumn(pl.col("toCount").fillNull(0).alias("added"))
            .withColumn(pl.col("added").minus(pl.col("removed")).alias("net"))
            .sort("net", { descending: false })

          // 4. Convert to DeltaByRule objects
          const deltas: DeltaByRule[] = joined.toRecords().map((row) => ({
            ruleId: row.ruleId as string,
            ruleName: row.ruleName as string,
            added: row.added as number,
            removed: row.removed as number,
            net: row.net as number
          }))

          return deltas
        })
    })
  })
)
```

**Dependencies Layer:**

```typescript
import { NodeContext } from "@effect/platform-node"
import { SqliteClientLive } from "./SqliteCheckpointStore.js"

export const PolarsAnalyticsEngineLayer = PolarsAnalyticsEngineLive.pipe(
  Layer.provide(SqliteClientLive),
  Layer.provide(NodeContext.layer)
)
```

---

### Phase 3: Export Module and Update Barrel (0.5 hours)

#### Task 3.1: Export from Adapters

**File:** `packages/core/src/adapters/index.ts`

**Add:**

```typescript
export * from "./PolarsAnalyticsEngine.js"
```

#### Task 3.2: Export from Core Package

**File:** `packages/core/src/index.ts`

**Update services export:**

```typescript
export * from "./services/AnalyticsEngine.js"
```

**Update adapters export:**

```typescript
// Already exports all adapters
export * from "./adapters/index.js"
```

---

### Phase 4: CLI Analytics Commands (2.5 hours)

#### Task 4.1: Create Analytics Command Group

**File:** `packages/cli/src/commands/analytics.ts` (new)

**Purpose:** CLI commands for analytics queries.

**Code:**

```typescript
/**
 * Analytics CLI Commands.
 *
 * Provides trend analysis, rule rankings, and hotspot identification.
 *
 * @since 1.0.0
 */
import { Command, Options, Args } from "@effect/cli"
import { Effect, Console } from "effect"
import { AnalyticsEngine, type MetricType } from "@effect-migrate/core"

/**
 * Analytics trend command.
 *
 * Shows time-series trend for a metric with rolling averages.
 *
 * @example
 * effect-migrate analytics trend errors --window 7
 */
export const trend = Command.make(
  "trend",
  {
    metric: Args.choice(["errors", "warnings", "totalFindings", "totalFiles"]),
    window: Options.integer("window").pipe(Options.withDefault(7))
  },
  ({ metric, window }) =>
    Effect.gen(function* () {
      const analytics = yield* AnalyticsEngine

      yield* Console.log(`\n📊 Trend Analysis: ${metric} (${window}-checkpoint rolling window)\n`)

      const series = yield* analytics.trendSeries(metric as MetricType, window)

      // Print as table
      yield* Console.log("Timestamp               | Value | Rolling Avg | Std Dev")
      yield* Console.log("------------------------|-------|-------------|--------")

      for (const point of series.dataPoints) {
        const mean = point.rollingMean?.toFixed(1) ?? "N/A"
        const std = point.rollingStd?.toFixed(2) ?? "N/A"
        yield* Console.log(
          `${point.timestamp} | ${point.value.toString().padStart(5)} | ${mean.padStart(11)} | ${std.padStart(7)}`
        )
      }

      yield* Console.log(`\nTotal data points: ${series.dataPoints.length}`)
    })
)

/**
 * Top rules command.
 *
 * Ranks rules by finding count.
 *
 * @example
 * effect-migrate analytics top-rules --limit 15 --severity error
 */
export const topRules = Command.make(
  "top-rules",
  {
    limit: Options.integer("limit").pipe(Options.withDefault(10)),
    severity: Options.choice("severity", ["error", "warning"]).pipe(Options.optional)
  },
  ({ limit, severity }) =>
    Effect.gen(function* () {
      const analytics = yield* AnalyticsEngine

      yield* Console.log(
        `\n🏆 Top ${limit} Rules${severity ? ` (severity: ${severity})` : ""}\n`
      )

      const rankings = yield* analytics.topRules(limit, severity)

      // Print as table
      yield* Console.log("Rank | Rule ID            | Severity | Findings | Files | %")
      yield* Console.log("-----|--------------------| ---------|----------|-------|------")

      rankings.forEach((rank, idx) => {
        yield* Console.log(
          `${(idx + 1).toString().padStart(4)} | ${rank.ruleId.padEnd(18)} | ${rank.severity.padEnd(8)} | ${rank.findingCount.toString().padStart(8)} | ${rank.fileCount.toString().padStart(5)} | ${rank.percentage.toFixed(1)}%`
        )
      })

      yield* Console.log()
    })
)

/**
 * File hotspots command.
 *
 * Identifies files with most findings.
 *
 * @example
 * effect-migrate analytics hotspots --limit 20 --rule no-async-await
 */
export const hotspots = Command.make(
  "hotspots",
  {
    limit: Options.integer("limit").pipe(Options.withDefault(10)),
    rule: Options.text("rule").pipe(Options.optional)
  },
  ({ limit, rule }) =>
    Effect.gen(function* () {
      const analytics = yield* AnalyticsEngine

      yield* Console.log(
        `\n🔥 Top ${limit} File Hotspots${rule ? ` (rule: ${rule})` : ""}\n`
      )

      const files = yield* analytics.fileHotspots(limit, rule)

      // Print as table
      yield* Console.log("Rank | File Path                                  | Findings")
      yield* Console.log("-----|--------------------------------------------|----------")

      files.forEach((file, idx) => {
        yield* Console.log(
          `${(idx + 1).toString().padStart(4)} | ${file.filePath.padEnd(42)} | ${file.findingCount.toString().padStart(8)}`
        )

        // Show top 3 rule contributors
        const topRules = file.ruleBreakdown
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)

        topRules.forEach((rb) => {
          yield* Console.log(`     |   └─ ${rb.ruleId}: ${rb.count}`)
        })
      })

      yield* Console.log()
    })
)

/**
 * Delta breakdown command.
 *
 * Shows per-rule delta between two checkpoints.
 *
 * @example
 * effect-migrate analytics delta 2025-11-06T10-00-00Z 2025-11-06T12-00-00Z
 */
export const delta = Command.make(
  "delta",
  {
    fromId: Args.text({ name: "from-checkpoint-id" }),
    toId: Args.text({ name: "to-checkpoint-id" })
  },
  ({ fromId, toId }) =>
    Effect.gen(function* () {
      const analytics = yield* AnalyticsEngine

      yield* Console.log(`\n📈 Delta Breakdown: ${fromId} → ${toId}\n`)

      const deltas = yield* analytics.deltaBreakdown(fromId, toId)

      // Print as table
      yield* Console.log("Rule ID                | Added | Removed | Net Change")
      yield* Console.log("-----------------------|-------|---------|------------")

      for (const delta of deltas) {
        const netSign = delta.net > 0 ? "+" : ""
        yield* Console.log(
          `${delta.ruleId.padEnd(22)} | ${delta.added.toString().padStart(5)} | ${delta.removed.toString().padStart(7)} | ${netSign}${delta.net.toString().padStart(10)}`
        )
      }

      yield* Console.log()
    })
)

/**
 * Analytics command group.
 */
export const analytics = Command.make("analytics", {}, () =>
  Effect.gen(function* () {
    yield* Console.log("Analytics commands:")
    yield* Console.log("  trend        - Show time-series trends")
    yield* Console.log("  top-rules    - Rank rules by findings")
    yield* Console.log("  hotspots     - Identify file hotspots")
    yield* Console.log("  delta        - Breakdown delta by rule")
  })
).pipe(
  Command.withSubcommands([trend, topRules, hotspots, delta])
)
```

#### Task 4.2: Register Analytics Command in Main CLI

**File:** `packages/cli/src/index.ts`

**Import:**

```typescript
import { analytics } from "./commands/analytics.js"
```

**Add to main command:**

```typescript
const main = Command.make("effect-migrate", {}, () =>
  Effect.gen(function* () {
    yield* Console.log("effect-migrate - Migration tooling for Effect-TS")
    // ... existing help
    yield* Console.log("  analytics    - Analytics and trend analysis")
  })
).pipe(
  Command.withSubcommands([
    audit,
    checkpoints,
    analytics, // <-- Add here
    // ... other commands
  ])
)
```

---

### Phase 5: Testing with Mock Data (2 hours)

#### Task 5.1: Create Analytics Engine Tests

**File:** `packages/core/src/__tests__/adapters/PolarsAnalyticsEngine.test.ts` (new)

**Purpose:** Test analytics queries with mock SQLite data.

**Code:**

```typescript
import { describe, it, expect, layer } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as SqlClient from "@effect/sql-sqlite-node"
import { PolarsAnalyticsEngineLive, AnalyticsEngine } from "@effect-migrate/core"

// Mock SQLite layer (in-memory)
const TestSqliteLive = SqlClient.SqliteClient.layer({
  filename: ":memory:",
  transformQueryNames: SqlClient.SqliteClient.TransformQueryNames.camelToSnake
})

// Test layer combining SQL + Analytics
const TestAnalyticsLayer = PolarsAnalyticsEngineLive.pipe(
  Layer.provide(TestSqliteLive)
)

describe("PolarsAnalyticsEngine", () => {
  layer(TestAnalyticsLayer)("Analytics Engine", (it) => {
    it.effect("should compute trend series with rolling averages", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const analytics = yield* AnalyticsEngine

        // Setup: Create tables and insert test data
        yield* sql`CREATE TABLE checkpoints (
          id TEXT PRIMARY KEY,
          ts INTEGER NOT NULL,
          total_errors INTEGER NOT NULL,
          total_warnings INTEGER NOT NULL,
          total_findings INTEGER NOT NULL,
          total_files INTEGER NOT NULL
        )`

        const testData = [
          { id: "2025-11-01T10-00-00Z", ts: 1730455200, errors: 10, warnings: 5, findings: 15, files: 3 },
          { id: "2025-11-02T10-00-00Z", ts: 1730541600, errors: 12, warnings: 6, findings: 18, files: 3 },
          { id: "2025-11-03T10-00-00Z", ts: 1730628000, errors: 8, warnings: 4, findings: 12, files: 3 },
          { id: "2025-11-04T10-00-00Z", ts: 1730714400, errors: 6, warnings: 3, findings: 9, files: 2 }
        ]

        for (const row of testData) {
          yield* sql`INSERT INTO checkpoints VALUES (
            ${row.id}, ${row.ts}, ${row.errors}, ${row.warnings}, ${row.findings}, ${row.files}
          )`
        }

        // Test: Compute trend
        const trend = yield* analytics.trendSeries("errors", 2)

        expect(trend.metric).toBe("errors")
        expect(trend.window).toBe(2)
        expect(trend.dataPoints.length).toBe(4)
        expect(trend.dataPoints[0].value).toBe(10)
        expect(trend.dataPoints[3].value).toBe(6)

        // Rolling mean should exist for points after window
        expect(trend.dataPoints[1].rollingMean).toBeDefined()
      })
    )

    it.effect("should rank top rules by finding count", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const analytics = yield* AnalyticsEngine

        // Setup: Create tables
        yield* sql`CREATE TABLE rules (
          rule_id INTEGER PRIMARY KEY,
          id TEXT UNIQUE NOT NULL,
          message TEXT NOT NULL,
          severity TEXT NOT NULL
        )`

        yield* sql`CREATE TABLE results (
          checkpoint_id TEXT NOT NULL,
          rule_id INTEGER NOT NULL,
          file_id INTEGER
        )`

        yield* sql`INSERT INTO rules VALUES (1, 'no-async-await', 'No async/await', 'error')`
        yield* sql`INSERT INTO rules VALUES (2, 'effect-gen-only', 'Use Effect.gen', 'warning')`

        // Insert findings: 5 for rule 1, 3 for rule 2
        for (let i = 0; i < 5; i++) {
          yield* sql`INSERT INTO results VALUES ('checkpoint1', 1, ${i})`
        }
        for (let i = 0; i < 3; i++) {
          yield* sql`INSERT INTO results VALUES ('checkpoint1', 2, ${i})`
        }

        // Test: Get top rules
        const rankings = yield* analytics.topRules(10)

        expect(rankings.length).toBe(2)
        expect(rankings[0].ruleId).toBe("no-async-await")
        expect(rankings[0].findingCount).toBe(5)
        expect(rankings[1].ruleId).toBe("effect-gen-only")
        expect(rankings[1].findingCount).toBe(3)
      })
    )

    it.effect("should identify file hotspots", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const analytics = yield* AnalyticsEngine

        // Setup: Create tables
        yield* sql`CREATE TABLE files (file_id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL)`
        yield* sql`CREATE TABLE rules (rule_id INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, message TEXT, severity TEXT)`
        yield* sql`CREATE TABLE results (checkpoint_id TEXT, rule_id INTEGER, file_id INTEGER)`

        yield* sql`INSERT INTO files VALUES (1, 'src/index.ts')`
        yield* sql`INSERT INTO files VALUES (2, 'src/utils.ts')`
        yield* sql`INSERT INTO rules VALUES (1, 'rule1', 'Rule 1', 'error')`

        // 10 findings in index.ts, 2 in utils.ts
        for (let i = 0; i < 10; i++) {
          yield* sql`INSERT INTO results VALUES ('checkpoint1', 1, 1)`
        }
        for (let i = 0; i < 2; i++) {
          yield* sql`INSERT INTO results VALUES ('checkpoint1', 1, 2)`
        }

        // Test: Get hotspots
        const hotspots = yield* analytics.fileHotspots(2)

        expect(hotspots.length).toBe(2)
        expect(hotspots[0].filePath).toBe("src/index.ts")
        expect(hotspots[0].findingCount).toBe(10)
      })
    )

    it.effect("should compute delta breakdown by rule", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const analytics = yield* AnalyticsEngine

        // Setup: Create tables
        yield* sql`CREATE TABLE rules (rule_id INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, message TEXT, severity TEXT)`
        yield* sql`CREATE TABLE results (checkpoint_id TEXT, rule_id INTEGER, file_id INTEGER)`

        yield* sql`INSERT INTO rules VALUES (1, 'rule1', 'Rule 1', 'error')`

        // Checkpoint1: 5 findings, Checkpoint2: 3 findings (removed 2)
        for (let i = 0; i < 5; i++) {
          yield* sql`INSERT INTO results VALUES ('checkpoint1', 1, 1)`
        }
        for (let i = 0; i < 3; i++) {
          yield* sql`INSERT INTO results VALUES ('checkpoint2', 1, 1)`
        }

        // Test: Compute delta
        const deltas = yield* analytics.deltaBreakdown("checkpoint1", "checkpoint2")

        expect(deltas.length).toBe(1)
        expect(deltas[0].ruleId).toBe("rule1")
        expect(deltas[0].removed).toBe(5)
        expect(deltas[0].added).toBe(3)
        expect(deltas[0].net).toBe(-2) // Net reduction
      })
    )
  })
})
```

#### Task 5.2: CLI Integration Test

**File:** `packages/cli/src/__tests__/commands/analytics.test.ts` (new)

**Code:**

```typescript
import { describe, it, expect } from "@effect/vitest"
import { Effect } from "effect"
import { analytics } from "../../commands/analytics.js"
import { AnalyticsEngine } from "@effect-migrate/core"

// Mock analytics engine
const MockAnalyticsEngine = Layer.succeed(AnalyticsEngine, {
  trendSeries: (metric, window) =>
    Effect.succeed({
      metric,
      window: window ?? 7,
      dataPoints: [
        { timestamp: "2025-11-06T10:00:00Z", value: 10, rollingMean: 9.5, rollingStd: 1.2 }
      ]
    }),
  topRules: (limit, severity) =>
    Effect.succeed([
      {
        ruleId: "no-async-await",
        ruleName: "No async/await",
        severity: "error",
        findingCount: 42,
        fileCount: 8,
        percentage: 35.2
      }
    ]),
  fileHotspots: (limit, ruleId) =>
    Effect.succeed([
      {
        filePath: "src/index.ts",
        findingCount: 15,
        ruleBreakdown: [{ ruleId: "rule1", count: 15 }]
      }
    ]),
  deltaBreakdown: (fromId, toId) =>
    Effect.succeed([
      {
        ruleId: "rule1",
        ruleName: "Rule 1",
        added: 3,
        removed: 5,
        net: -2
      }
    ])
})

describe("Analytics CLI Commands", () => {
  it.effect("should execute trend command", () =>
    Effect.gen(function* () {
      // Simulate: effect-migrate analytics trend errors --window 7
      const cmd = analytics.subcommands.find((c) => c.name === "trend")
      expect(cmd).toBeDefined()

      // Test will provide mock analytics layer
      // (Actual CLI execution tested in integration tests)
    })
  )
})
```

---

### Phase 6: Documentation and Examples (1 hour)

#### Task 6.1: Update CLI README

**File:** `packages/cli/README.md`

**Add section:**

```markdown
### Analytics Commands

**Trend Analysis:**

```bash
# Show error trend with 7-checkpoint rolling average
effect-migrate analytics trend errors --window 7

# Show warnings trend
effect-migrate analytics trend warnings --window 14
```

**Top Rules:**

```bash
# Top 10 rules by finding count
effect-migrate analytics top-rules --limit 10

# Top error rules only
effect-migrate analytics top-rules --severity error
```

**File Hotspots:**

```bash
# Top 20 files with most findings
effect-migrate analytics hotspots --limit 20

# Files with most findings for specific rule
effect-migrate analytics hotspots --rule no-async-await
```

**Delta Breakdown:**

```bash
# Per-rule delta between two checkpoints
effect-migrate analytics delta 2025-11-06T10-00-00Z 2025-11-06T12-00-00Z
```

**Requirements:**

Analytics commands require SQLite backend (`--checkpoint-db`):

```bash
# Enable SQLite for checkpoints
effect-migrate audit --checkpoint-db .amp/effect-migrate/checkpoints.db

# Then run analytics
effect-migrate analytics trend errors
```
```

#### Task 6.2: Update Core Package AGENTS.md

**File:** `packages/core/AGENTS.md`

**Add section:**

```markdown
### AnalyticsEngine Service

**Purpose:** Advanced analytics and trend analysis over checkpoint data using nodejs-polars.

**Interface:**

- `trendSeries(metric, window)` - Time-series trends with rolling averages
- `topRules(limit, severity?)` - Rank rules by finding count
- `fileHotspots(limit, ruleId?)` - Identify files with most findings
- `deltaBreakdown(fromId, toId)` - Per-rule delta analysis

**Implementation:**

- `PolarsAnalyticsEngineLive` - Uses nodejs-polars DataFrames for efficient aggregations
- Reads data from SQLite via `SqlClient`
- Lazy evaluation prevents OOM on large datasets

**Usage:**

```typescript
import { AnalyticsEngine, PolarsAnalyticsEngineLayer } from "@effect-migrate/core"

const program = Effect.gen(function* () {
  const analytics = yield* AnalyticsEngine
  
  const trend = yield* analytics.trendSeries("errors", 7)
  const topRules = yield* analytics.topRules(10, "error")
  const hotspots = yield* analytics.fileHotspots(20)
  
  return { trend, topRules, hotspots }
}).pipe(Effect.provide(PolarsAnalyticsEngineLayer))
```

**Dependencies:**

- Requires SQLite backend (reads from `checkpoints.db`)
- Requires `nodejs-polars` package

**Testing:**

See `packages/core/src/__tests__/adapters/PolarsAnalyticsEngine.test.ts` for examples.
```

---

## Integration

### Layer Composition

**Full analytics layer with all dependencies:**

```typescript
import { PolarsAnalyticsEngineLive } from "@effect-migrate/core/adapters"
import { SqliteClientLive } from "@effect-migrate/core/adapters"
import { NodeContext } from "@effect/platform-node"
import { Layer } from "effect"

export const AnalyticsLayer = PolarsAnalyticsEngineLive.pipe(
  Layer.provide(SqliteClientLive),
  Layer.provide(NodeContext.layer)
)
```

### CLI Runner Layer

**File:** `packages/cli/src/run.ts`

**Update to include analytics:**

```typescript
import { AnalyticsLayer } from "@effect-migrate/core"

const CliLayer = Layer.mergeAll(
  CheckpointStoreLayer,
  AnalyticsLayer, // <-- Add
  // ... other layers
)

export const runCli = (args: string[]) =>
  CliApp.run(args).pipe(
    Effect.provide(CliLayer),
    NodeRuntime.runMain
  )
```

---

## Testing Strategy

### Unit Tests

- **Service Interface:** Validate schema types (TrendDataPoint, RuleRank, etc.)
- **Polars Engine:** Test each method with mock SQLite data

### Integration Tests

- **CLI Commands:** Execute analytics commands with test data
- **Layer Composition:** Verify AnalyticsEngine resolves with all dependencies

### Performance Tests

**Target Benchmarks:**

| Operation               | Dataset Size        | Target Time | Target Memory |
| ----------------------- | ------------------- | ----------- | ------------- |
| Trend series (30 days)  | 30 checkpoints      | <2s         | <100MB        |
| Top rules               | 10k findings        | <1s         | <80MB         |
| File hotspots           | 500 files, 10k findings | <1.5s   | <90MB         |
| Delta breakdown         | 5k findings per checkpoint | <800ms | <70MB    |

**Test file:** `packages/core/src/__tests__/performance/analytics-benchmarks.test.ts`

```typescript
import { describe, it } from "@effect/vitest"
import { Effect, Console } from "effect"
import { AnalyticsEngine } from "@effect-migrate/core"

describe("Analytics Performance Benchmarks", () => {
  it.effect("should compute trend series in <2s", () =>
    Effect.gen(function* () {
      const analytics = yield* AnalyticsEngine
      
      const start = Date.now()
      const trend = yield* analytics.trendSeries("errors", 7)
      const duration = Date.now() - start
      
      yield* Console.log(`Trend computation: ${duration}ms`)
      expect(duration).toBeLessThan(2000)
    })
  )
})
```

---

## Success Criteria

- [ ] `AnalyticsEngine` service interface defined with type-safe schemas
- [ ] `PolarsAnalyticsEngineLive` implementation using nodejs-polars
- [ ] `trendSeries()` computes rolling averages and standard deviation
- [ ] `topRules()` ranks rules by finding count with percentages
- [ ] `fileHotspots()` identifies files with most findings and rule breakdown
- [ ] `deltaBreakdown()` shows per-rule changes between checkpoints
- [ ] CLI `analytics` command with `trend`, `top-rules`, `hotspots`, `delta` subcommands
- [ ] All unit tests pass with mock SQLite data
- [ ] Integration tests verify CLI commands execute successfully
- [ ] Performance benchmarks meet targets (<2s for 30-checkpoint trends)
- [ ] Memory usage stays <200MB for complex queries
- [ ] Documentation updated in README and AGENTS.md
- [ ] Graceful error handling for missing SQLite backend

---

## Files Summary

### New Files

**Core:**

- `packages/core/src/services/AnalyticsEngine.ts` (~200 LOC) - Service interface and schemas
- `packages/core/src/adapters/PolarsAnalyticsEngine.ts` (~350 LOC) - Polars implementation
- `packages/core/src/__tests__/services/AnalyticsEngine.test.ts` (~80 LOC) - Schema tests
- `packages/core/src/__tests__/adapters/PolarsAnalyticsEngine.test.ts` (~180 LOC) - Engine tests
- `packages/core/src/__tests__/performance/analytics-benchmarks.test.ts` (~60 LOC) - Benchmarks

**CLI:**

- `packages/cli/src/commands/analytics.ts` (~220 LOC) - Analytics CLI commands
- `packages/cli/src/__tests__/commands/analytics.test.ts` (~50 LOC) - CLI tests

**Total New LOC:** ~1,140

### Modified Files

- `packages/core/src/adapters/index.ts` (+1 line) - Export PolarsAnalyticsEngine
- `packages/core/src/index.ts` (+1 line) - Export AnalyticsEngine service
- `packages/cli/src/index.ts` (+2 lines) - Register analytics command
- `packages/cli/src/run.ts` (+3 lines) - Provide AnalyticsLayer
- `packages/cli/README.md` (+40 lines) - Analytics documentation
- `packages/core/AGENTS.md` (+30 lines) - AnalyticsEngine guide
- `package.json` (+1 line) - Add nodejs-polars dependency

---

## Dependencies

**New:**

```json
{
  "dependencies": {
    "nodejs-polars": "^0.14.0"
  },
  "devDependencies": {
    "@types/nodejs-polars": "^0.14.0"
  }
}
```

**Existing (from PR6):**

- `@effect/sql-sqlite-node` (SQLite client)
- `@effect/platform` (platform abstractions)
- `effect` (core library)

---

## Risks and Mitigation

### Risk 1: Polars Native Bindings Fail to Install

**Scenario:** Rust native binaries don't compile on some platforms.

**Mitigation:**

- nodejs-polars includes WASM fallback (slower but portable)
- Make analytics commands gracefully degrade if Polars unavailable
- Document platform requirements in README

### Risk 2: Memory Spikes on Large Datasets

**Scenario:** Loading 100+ checkpoints into DataFrame causes OOM.

**Mitigation:**

- Use Polars lazy evaluation (`.lazy()` API)
- Limit initial query results with SQL `WHERE` clauses
- Implement pagination for large result sets
- Monitor memory usage with OpenTelemetry (PR8)

### Risk 3: Polars API Instability

**Scenario:** nodejs-polars API changes between versions.

**Mitigation:**

- Pin exact version in package.json
- Comprehensive test coverage for Polars operations
- Isolate Polars usage to PolarsAnalyticsEngine adapter (easy to replace)

---

## Future Enhancements

### Visualization Export

**After PR7:**

- Export trend data to JSON for charting libraries
- Generate ASCII charts in terminal (using `asciichart` package)
- Export to CSV for spreadsheet analysis

### Advanced Statistics

**With more data:**

- Forecast completion date using regression
- Anomaly detection (sudden spikes in findings)
- Seasonal pattern analysis (time-of-day, day-of-week trends)

### Integration with MCP Server (Phase 5)

**Amp agent queries:**

```typescript
// Via MCP server
const trend = await ampAgent.query("Show me error trends for the last 2 weeks")
const hotspots = await ampAgent.query("Which files need attention?")
```

---

## References

**Phase 3 (Polars Analytics) from comprehensive-data-architecture.md:**

- Lines 522-581: Polars integration patterns
- Lines 655-677: Performance benchmarks
- Lines 819-821: Success criteria

**nodejs-polars Documentation:**

- https://pola-rs.github.io/nodejs-polars/
- DataFrame API: https://pola-rs.github.io/nodejs-polars/classes/DataFrame.html
- SQL integration: https://pola-rs.github.io/nodejs-polars/functions/readDatabase.html

**Effect Patterns:**

- Service definition: AGENTS.md#effect-ts-best-practices
- Layer composition: comprehensive-data-architecture.md#layer-composition

---

**Last Updated:** 2025-11-06  
**Maintainer:** @aridyckovsky  
**Status:** Ready for implementation  
**Thread:** https://ampcode.com/threads/T-96089cb6-c4c1-4aea-8878-21670c44ea6d
