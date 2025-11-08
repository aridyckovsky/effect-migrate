---
created: 2025-11-08
lastUpdated: 2025-11-08
author: Generated via Amp (Oracle + Librarian comprehensive research)
status: ready
thread: https://ampcode.com/threads/T-c3ede67c-37ec-4cf8-a360-659beed5b6d1
audience: Development team, AI coding agents, and technical decision makers
tags: [agents-md, documentation, checkpoint-analysis, ai-generation, amp-integration]
related:
  - ./comprehensive-data-architecture.md
  - ./checkpoint-based-audit-persistence.md
  - ./schema-versioning-and-normalization.md
  - ../concepts/amp-integration.md
  - ../../AGENTS.md
---

# Directory-Specific AGENTS.md Generation from Checkpoint History

## Executive Summary

Generate directory-specific AGENTS.md files that document migration norms, conventions, and patterns discovered through checkpoint analysis. As teams migrate to Effect using effect-migrate, the checkpoint history reveals which rules became enforced, which patterns were adopted, and which boundaries stabilized—this feature automatically captures that knowledge as AGENTS.md files for migrated directories.

**Key Innovation:** Transform migration audit history into actionable documentation that helps Amp coding agents understand local norms in each directory without re-learning them.

**Effort:** 12-20 hours across 3 phases (independently deliverable)

**Dependencies:**

- Phase 2 (Checkpoints) of comprehensive-data-architecture.md
- SQLite storage (Phase 3) recommended but not required
- @effect/ai for optional LLM enhancement

---

> **💡 SIMPLIFICATION NOTE:**
> 
> **Alternative Approach (Much Simpler):** Instead of building all the infrastructure below, we could:
> 
> 1. Add a simple CLI command that prepares checkpoint summary context
> 2. Use Amp CLI programmatically to generate the AGENTS.md
> 3. Let Amp do the analysis, summarization, and writing
> 
> ```bash
> # Simple version - leverage Amp directly
> effect-migrate agents prepare src/services/  # Creates context summary
> amp --execute "Read checkpoint summary and generate AGENTS.md for src/services/"
> ```
> 
> **Pros:**
> - Much less code to maintain (maybe 2-4 hours instead of 12-20)
> - Leverages Amp's existing strengths (analysis, summarization)
> - More flexible (Amp can adapt to context better than templates)
> - Uses same AI token user already has
> 
> **Cons:**
> - Requires Amp API access (not standalone)
> - Less deterministic (AI can vary)
> - Slower (Amp execution vs direct generation)
> 
> **Question for team:** Do we need the full deterministic infrastructure, or should we start with "prepare context + invoke Amp"?

---

## Problem Context

### Current State

**What we have:**

- Checkpoint-based audit persistence tracking migration over time
- Normalized schema reducing duplication and memory overhead
- Thread associations linking audits to Amp sessions
- Analytics capabilities for trend analysis

**What's missing:**

- No automatic documentation of "what norms were established"
- Amp agents must re-learn directory conventions in each session
- Migration decisions captured in threads but not codified
- No way to say "this directory is fully migrated, follow these patterns"

### User Story

```bash
# Team migrates src/services/ over 2 weeks, 15 checkpoints
$ effect-migrate audit --amp-out .amp/effect-migrate --checkpoint-db checkpoints.db
# ... fix issues, run audit again ...
# ... repeat until src/services/ is clean ...

# After src/services/ stabilizes (clean for 5+ checkpoints):
$ effect-migrate agents generate --target migrated --llm threads

✓ Generated AGENTS.md for 3 directories:
  - src/services/AGENTS.md (18 files, 100% clean since 2025-11-05)
  - src/models/AGENTS.md (12 files, 100% clean since 2025-11-03)
  - src/utils/AGENTS.md (8 files, 100% clean since 2025-11-06)

# Now new Amp sessions automatically load these norms
$ amp
> Amp reads src/services/AGENTS.md automatically
> Knows: no async/await, use @effect/platform, Effect.gen patterns enforced
```

### Value Proposition

**For teams:**

- ✅ Automated documentation of migration decisions
- ✅ Reduced onboarding time for new developers/agents
- ✅ Consistent patterns enforced across team
- ✅ Historical provenance of why norms exist

**For Amp agents:**

- ✅ Directory-specific context without manual explanation
- ✅ Clear boundaries and enforced patterns
- ✅ Thread references for deeper understanding
- ✅ Verification commands to re-check compliance

---

## Architecture Overview

> **💭 QUESTION:** Do we really need all these services and abstractions? 
> 
> Most of this complexity exists to avoid calling Amp. But if we're already using Amp for migrations, why not use it for generation too?
>
> **Simpler alternative architecture:**
> ```text
> CLI Command → Prepare Context Summary → Amp CLI (--execute) → Write AGENTS.md
> ```
> 
> The complex architecture below makes sense if:
> - We want standalone operation (no Amp dependency)
> - We need reproducible/deterministic output
> - We're processing hundreds of directories (perf matters)
> 
> Otherwise, "context prep + Amp" is much simpler.

### Three-Tier Generation Strategy

```text
┌─────────────────────────────────────────────────────────────┐
│                 CLI Command Layer                            │
│  effect-migrate agents generate [options]                   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              AgentsInsights Engine                           │
│  (Analyzes checkpoint history, classifies directories)      │
│                                                              │
│  • classifyDirectories() → DirectoryStatus[]                │
│  • directoryNorms() → NormEvidence[]                        │
│  • directoryThreads() → ThreadImpact[]                      │
└─────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────────┐    ┌──────────────────────┐
│ AgentsDocGenerator   │    │ Optional AI Layer    │
│ (Templates + Render) │    │ (@effect/ai)         │
│                      │    │                      │
│ • generateForDir()   │◄───┤ • Thread summaries  │
│ • renderTemplate()   │    │ • Pattern extraction│
└──────────────────────┘    └──────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Sources                                │
│                                                              │
│  CheckpointStore ──► JSON/SQLite                            │
│  AnalyticsEngine ──► Polars (optional)                      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Checkpoint History (50+ audits)
       │
       ├─► Directory Grouping (src/services/, src/models/, etc.)
       │
       ├─► Stability Analysis
       │   └─ Which directories stayed clean for N checkpoints?
       │
       ├─► Norm Extraction
       │   └─ Which rules went to zero and stayed zero?
       │
       ├─► Thread Association
       │   └─ Which threads contributed to cleaning this directory?
       │
       ├─► Optional AI Enhancement
       │   └─ Summarize thread decisions and patterns
       │
       └─► Template Rendering
           └─ Generate src/services/AGENTS.md
```

---

## Phase 1: Deterministic AGENTS.md Generation (Core)

> **🤔 SIMPLER OPTION:** Before building all this, consider:
>
> **"Context Prep" Approach (2-3 hours):**
> ```typescript
> // Just prepare a simple JSON summary
> const summary = {
>   directory: "src/services/",
>   status: "migrated",
>   cleanSince: "2025-11-05",
>   normsEstablished: [
>     { rule: "no-async-await", fixedCount: 24, docsUrl: "..." },
>     { rule: "no-node-imports", fixedCount: 12, docsUrl: "..." }
>   ],
>   threads: ["T-abc...", "T-def..."]
> }
> // Write to .amp/effect-migrate/directory-summary.json
> ```
>
> Then:
> ```bash
> amp --execute "Read @.amp/effect-migrate/directory-summary.json and generate src/services/AGENTS.md documenting these norms"
> ```
>
> **Why this might be better:**
> - Amp already knows how to write good documentation
> - Can reference thread content directly via read-thread
> - Adapts to context better than rigid templates
> - Much less code to maintain
>
> **When to use full deterministic approach:**
> - Need to work offline/without Amp
> - Processing 100+ directories (perf critical)
> - Want bit-for-bit reproducible output

**Goal:** Generate AGENTS.md files from checkpoint data using deterministic heuristics (no LLM required).

**Effort:** 6-10 hours

### Core Services

#### 1. AgentsInsights Interface

```typescript
import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import type { PlatformError } from "@effect/platform/Error"

/**
 * Directory migration status classification.
 */
export interface DirectoryStatus {
  /** Directory path relative to project root */
  readonly path: string

  /** Migration status based on checkpoint stability */
  readonly status: "migrated" | "in-progress" | "not-started"

  /** When directory first became clean (all findings resolved) */
  readonly cleanSince?: Date

  /** Number of consecutive checkpoints with zero findings */
  readonly stabilityCheckpoints: number

  /** File statistics */
  readonly fileCounts: {
    readonly total: number
    readonly clean: number
    readonly cleanPercentage: number
  }

  /** Last checkpoint with changes in this directory */
  readonly lastActivity: Date
}

/**
 * Evidence of an established norm (rule that became enforced).
 */
export interface NormEvidence {
  /** Rule ID that became enforced */
  readonly ruleId: string

  /** Rule kind (pattern, boundary, etc.) */
  readonly ruleKind: string

  /** Rule tags for categorization */
  readonly tags: readonly string[]

  /** Documentation URL for the rule */
  readonly docsUrl?: string

  /** When this rule last had findings in the directory */
  readonly lastSeenAt: Date

  /** When rule findings went to zero (and stayed there) */
  readonly extinctSince: Date

  /** Stability metrics */
  readonly zeroSpan: {
    readonly checkpoints: number
    readonly days: number
  }

  /** Total findings fixed for this rule */
  readonly totalFixed: number
}

/**
 * Thread impact on a directory's migration.
 */
export interface ThreadImpact {
  /** Thread ID (T-uuid format) */
  readonly threadId: string

  /** Thread URL if available */
  readonly threadUrl?: string

  /** First checkpoint in this thread */
  readonly first: Date

  /** Last checkpoint in this thread */
  readonly last: Date

  /** Delta in findings attributed to this thread */
  readonly fixesDelta: {
    readonly errors: number
    readonly warnings: number
  }

  /** Top rules addressed in this thread */
  readonly topRules: readonly string[]
}

/**
 * Insights engine for extracting migration patterns from checkpoint history.
 */
export interface AgentsInsightsService {
  /**
   * Classify directories by migration status.
   */
  readonly classifyDirectories: (options?: {
    readonly depth?: number
    readonly minFiles?: number
  }) => Effect.Effect<readonly DirectoryStatus[], PlatformError>

  /**
   * Extract established norms for a directory.
   */
  readonly directoryNorms: (
    directory: string,
    options?: {
      readonly stabilityCheckpoints?: number
      readonly stabilityDays?: number
      readonly minHistoricalCount?: number
    }
  ) => Effect.Effect<readonly NormEvidence[], PlatformError>

  /**
   * Identify threads that impacted a directory.
   */
  readonly directoryThreads: (
    directory: string,
    options?: {
      readonly limit?: number
    }
  ) => Effect.Effect<readonly ThreadImpact[], PlatformError>
}

export class AgentsInsights extends Context.Tag("AgentsInsights")<
  AgentsInsights,
  AgentsInsightsService
>() {}
```

#### 2. AgentsDocGenerator Interface

```typescript
/**
 * Generated AGENTS.md document.
 */
export interface GeneratedAgentsDoc {
  /** Directory path where AGENTS.md was written */
  readonly path: string

  /** Directory status summary */
  readonly status: DirectoryStatus

  /** Number of norms documented */
  readonly normsCount: number

  /** Number of threads referenced */
  readonly threadsCount: number
}

/**
 * Generator for directory-specific AGENTS.md files.
 */
export interface AgentsDocGeneratorService {
  /**
   * Generate AGENTS.md for a single directory.
   */
  readonly generateForDirectory: (
    directory: string,
    options?: {
      readonly overwrite?: boolean
      readonly includeThreads?: boolean
    }
  ) => Effect.Effect<GeneratedAgentsDoc, PlatformError>

  /**
   * Generate AGENTS.md for all qualifying directories.
   */
  readonly generateAll: (options?: {
    readonly target?: "migrated" | "in-progress" | "all"
    readonly depth?: number
    readonly minFiles?: number
    readonly stabilityCheckpoints?: number
    readonly stabilityDays?: number
    readonly overwrite?: boolean
  }) => Effect.Effect<readonly GeneratedAgentsDoc[], PlatformError>
}

export class AgentsDocGenerator extends Context.Tag("AgentsDocGenerator")<
  AgentsDocGenerator,
  AgentsDocGeneratorService
>() {}
```

### Implementation: SqliteAgentsInsights

```typescript
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { SqlClient } from "@effect/sql"
import * as Path from "@effect/platform/Path"

/**
 * SQLite-backed insights engine.
 *
 * Leverages checkpoint database for efficient directory-level aggregations.
 */
export const SqliteAgentsInsightsLive = Layer.effect(
  AgentsInsights,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const path = yield* Path.Path

    return AgentsInsights.of({
      classifyDirectories: (options = {}) =>
        Effect.gen(function* () {
          const { depth = 2, minFiles = 3 } = options

          // Get latest checkpoint
          const latest = yield* sql<{ id: string; ts: number }>`
            SELECT id, ts
            FROM checkpoints
            ORDER BY ts DESC
            LIMIT 1
          `.pipe(Effect.map((rows) => rows[0]))

          if (!latest) {
            return []
          }

          // Aggregate findings by directory at specified depth
          const dirStats = yield* sql<{
            dir: string
            totalFiles: number
            filesWithFindings: number
            totalFindings: number
            errors: number
            warnings: number
          }>`
            SELECT
              -- Extract directory at specified depth
              SUBSTR(
                f.path,
                1,
                CASE 
                  WHEN INSTR(SUBSTR(f.path, INSTR(f.path, '/') + 1), '/') > 0
                  THEN INSTR(f.path, '/') + INSTR(SUBSTR(f.path, INSTR(f.path, '/') + 1), '/')
                  ELSE LENGTH(f.path)
                END
              ) as dir,
              COUNT(DISTINCT f.id) as totalFiles,
              COUNT(DISTINCT CASE WHEN res.id IS NOT NULL THEN f.id END) as filesWithFindings,
              COALESCE(COUNT(res.id), 0) as totalFindings,
              COALESCE(SUM(CASE WHEN r.severity = 'error' THEN 1 ELSE 0 END), 0) as errors,
              COALESCE(SUM(CASE WHEN r.severity = 'warning' THEN 1 ELSE 0 END), 0) as warnings
            FROM files f
            LEFT JOIN results res ON res.file_id = f.id AND res.checkpoint_id = ${latest.id}
            LEFT JOIN rules r ON res.rule_id = r.id
            GROUP BY dir
            HAVING totalFiles >= ${minFiles}
          `

          // Check stability (consecutive zero findings)
          const classified = yield* Effect.forEach(
            dirStats,
            (stat) =>
              Effect.gen(function* () {
                // Count consecutive zero checkpoints
                const stabilityData = yield* sql<{
                  checkpoint_id: string
                  ts: number
                  findings: number
                }>`
                  SELECT
                    c.id as checkpoint_id,
                    c.ts,
                    COUNT(res.id) as findings
                  FROM checkpoints c
                  LEFT JOIN results res ON res.checkpoint_id = c.id
                  LEFT JOIN files f ON res.file_id = f.id
                  WHERE f.path LIKE ${stat.dir + "%"}
                  GROUP BY c.id, c.ts
                  ORDER BY c.ts DESC
                  LIMIT 20
                `

                // Calculate stability metrics
                let stabilityCheckpoints = 0
                let cleanSince: Date | undefined = undefined
                let lastActivity: Date = new Date(latest.ts * 1000)

                for (const checkpoint of stabilityData) {
                  if (checkpoint.findings === 0) {
                    stabilityCheckpoints++
                    cleanSince = new Date(checkpoint.ts * 1000)
                  } else {
                    lastActivity = new Date(checkpoint.ts * 1000)
                    break
                  }
                }

                // Classify status
                let status: "migrated" | "in-progress" | "not-started"
                if (stat.totalFindings === 0 && stabilityCheckpoints >= 3) {
                  status = "migrated"
                } else if (stat.totalFindings > 0 || stabilityCheckpoints > 0) {
                  status = "in-progress"
                } else {
                  status = "not-started"
                }

                return {
                  path: stat.dir,
                  status,
                  cleanSince,
                  stabilityCheckpoints,
                  fileCounts: {
                    total: stat.totalFiles,
                    clean: stat.totalFiles - stat.filesWithFindings,
                    cleanPercentage: Math.round(
                      ((stat.totalFiles - stat.filesWithFindings) / stat.totalFiles) * 100
                    )
                  },
                  lastActivity
                } satisfies DirectoryStatus
              }),
            { concurrency: 4 }
          )

          return classified.sort((a, b) => {
            // Sort: migrated first, then by clean percentage
            if (a.status === "migrated" && b.status !== "migrated") return -1
            if (a.status !== "migrated" && b.status === "migrated") return 1
            return b.fileCounts.cleanPercentage - a.fileCounts.cleanPercentage
          })
        }),

      directoryNorms: (directory, options = {}) =>
        Effect.gen(function* () {
          const { stabilityCheckpoints = 3, stabilityDays = 7, minHistoricalCount = 3 } = options

          // Get rule history for this directory
          const ruleHistory = yield* sql<{
            rule_id: string
            kind: string
            tags: string
            docs_url: string | null
            checkpoint_id: string
            ts: number
            findings: number
          }>`
            SELECT
              r.id as rule_id,
              r.kind,
              r.tags,
              r.docs_url,
              c.id as checkpoint_id,
              c.ts,
              COUNT(res.id) as findings
            FROM checkpoints c
            CROSS JOIN rules r
            LEFT JOIN results res ON res.checkpoint_id = c.id AND res.rule_id = r.id
            LEFT JOIN files f ON res.file_id = f.id
            WHERE f.path LIKE ${directory + "%"} OR res.id IS NULL
            GROUP BY r.id, r.kind, r.tags, r.docs_url, c.id, c.ts
            ORDER BY r.id, c.ts DESC
          `

          // Group by rule and analyze stability
          const ruleGroups = new Map<string, typeof ruleHistory>()
          for (const row of ruleHistory) {
            const existing = ruleGroups.get(row.rule_id) ?? []
            existing.push(row)
            ruleGroups.set(row.rule_id, existing)
          }

          const norms: NormEvidence[] = []

          for (const [ruleId, checkpoints] of ruleGroups.entries()) {
            // Check if rule went to zero and stayed there
            let consecutiveZeros = 0
            let extinctSince: Date | undefined = undefined
            let lastSeenAt: Date | undefined = undefined
            let totalFixed = 0

            for (let i = 0; i < checkpoints.length; i++) {
              const checkpoint = checkpoints[i]

              if (checkpoint.findings === 0) {
                consecutiveZeros++
                if (!extinctSince) {
                  extinctSince = new Date(checkpoint.ts * 1000)
                }
              } else {
                // Found a non-zero checkpoint
                lastSeenAt = new Date(checkpoint.ts * 1000)
                totalFixed += checkpoint.findings

                // If we haven't found enough zeros, reset
                if (consecutiveZeros < stabilityCheckpoints) {
                  consecutiveZeros = 0
                  extinctSince = undefined
                }
                break
              }
            }

            // Only include if:
            // 1. Rule went to zero and stayed there
            // 2. Had meaningful historical count
            // 3. Met stability requirements
            if (
              extinctSince &&
              lastSeenAt &&
              totalFixed >= minHistoricalCount &&
              consecutiveZeros >= stabilityCheckpoints
            ) {
              const firstCheckpoint = checkpoints[0]
              const daysSinceExtinct = Math.floor(
                (Date.now() - extinctSince.getTime()) / (1000 * 60 * 60 * 24)
              )

              if (daysSinceExtinct >= stabilityDays) {
                norms.push({
                  ruleId,
                  ruleKind: firstCheckpoint.kind,
                  tags: firstCheckpoint.tags ? JSON.parse(firstCheckpoint.tags) : [],
                  docsUrl: firstCheckpoint.docs_url ?? undefined,
                  lastSeenAt,
                  extinctSince,
                  zeroSpan: {
                    checkpoints: consecutiveZeros,
                    days: daysSinceExtinct
                  },
                  totalFixed
                })
              }
            }
          }

          // Sort: boundaries first, then by total fixed
          return norms.sort((a, b) => {
            const aIsBoundary = a.tags.includes("boundary") || a.ruleKind === "boundary"
            const bIsBoundary = b.tags.includes("boundary") || b.ruleKind === "boundary"

            if (aIsBoundary && !bIsBoundary) return -1
            if (!aIsBoundary && bIsBoundary) return 1
            return b.totalFixed - a.totalFixed
          })
        }),

      directoryThreads: (directory, options = {}) =>
        Effect.gen(function* () {
          const { limit = 10 } = options

          // Get checkpoints with thread associations and deltas
          const threadData = yield* sql<{
            thread_id: string
            thread_url: string | null
            first_ts: number
            last_ts: number
            errors_fixed: number
            warnings_fixed: number
            top_rules: string
          }>`
            WITH dir_checkpoints AS (
              SELECT DISTINCT
                c.id,
                c.thread_id,
                c.thread_url,
                c.ts,
                COUNT(CASE WHEN r.severity = 'error' THEN 1 END) as errors,
                COUNT(CASE WHEN r.severity = 'warning' THEN 1 END) as warnings
              FROM checkpoints c
              LEFT JOIN results res ON res.checkpoint_id = c.id
              LEFT JOIN files f ON res.file_id = f.id
              LEFT JOIN rules r ON res.rule_id = r.id
              WHERE f.path LIKE ${directory + "%"} AND c.thread_id IS NOT NULL
              GROUP BY c.id, c.thread_id, c.thread_url, c.ts
            ),
            thread_deltas AS (
              SELECT
                thread_id,
                thread_url,
                MIN(ts) as first_ts,
                MAX(ts) as last_ts,
                -- Calculate reduction in findings
                (
                  SELECT dc1.errors FROM dir_checkpoints dc1
                  WHERE dc1.thread_id = dir_checkpoints.thread_id
                  ORDER BY dc1.ts ASC LIMIT 1
                ) - (
                  SELECT dc2.errors FROM dir_checkpoints dc2
                  WHERE dc2.thread_id = dir_checkpoints.thread_id
                  ORDER BY dc2.ts DESC LIMIT 1
                ) as errors_fixed,
                (
                  SELECT dc1.warnings FROM dir_checkpoints dc1
                  WHERE dc1.thread_id = dir_checkpoints.thread_id
                  ORDER BY dc1.ts ASC LIMIT 1
                ) - (
                  SELECT dc2.warnings FROM dir_checkpoints dc2
                  WHERE dc2.thread_id = dir_checkpoints.thread_id
                  ORDER BY dc2.ts DESC LIMIT 1
                ) as warnings_fixed
              FROM dir_checkpoints
              GROUP BY thread_id, thread_url
            )
            SELECT
              td.*,
              GROUP_CONCAT(DISTINCT r.id) as top_rules
            FROM thread_deltas td
            JOIN dir_checkpoints dc ON dc.thread_id = td.thread_id
            JOIN results res ON res.checkpoint_id = dc.id
            JOIN rules r ON res.rule_id = r.id
            GROUP BY td.thread_id, td.thread_url, td.first_ts, td.last_ts, td.errors_fixed, td.warnings_fixed
            ORDER BY (td.errors_fixed + td.warnings_fixed) DESC
            LIMIT ${limit}
          `

          return threadData.map(
            (row) =>
              ({
                threadId: row.thread_id,
                threadUrl: row.thread_url ?? undefined,
                first: new Date(row.first_ts * 1000),
                last: new Date(row.last_ts * 1000),
                fixesDelta: {
                  errors: row.errors_fixed,
                  warnings: row.warnings_fixed
                },
                topRules: row.top_rules.split(",").slice(0, 5)
              }) satisfies ThreadImpact
          )
        })
    })
  })
)
```

### Implementation: AgentsDocGenerator

```typescript
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { FileSystem } from "@effect/platform"
import * as Path from "@effect/platform/Path"

/**
 * Template-based AGENTS.md generator.
 *
 * Renders directory-specific documentation from insights data.
 */
export const AgentsDocGeneratorLive = Layer.effect(
  AgentsDocGenerator,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const insights = yield* AgentsInsights

    const renderTemplate = (
      status: DirectoryStatus,
      norms: readonly NormEvidence[],
      threads: readonly ThreadImpact[]
    ): string => {
      const lines: string[] = []

      // Header
      lines.push(`---`)
      lines.push(`generated: ${new Date().toISOString()}`)
      lines.push(`status: ${status.status}`)
      lines.push(`source: effect-migrate checkpoint analysis`)
      lines.push(`---`)
      lines.push(``)
      lines.push(`# AGENTS for ${status.path}`)
      lines.push(``)

      // Status section
      lines.push(`## Status`)
      lines.push(``)
      const statusBadge =
        status.status === "migrated"
          ? "✅ Migrated"
          : status.status === "in-progress"
            ? "🔄 In Progress"
            : "⏸️ Not Started"
      lines.push(`**${statusBadge}**`)
      lines.push(``)

      if (status.cleanSince) {
        lines.push(`- **Clean since:** ${status.cleanSince.toISOString().split("T")[0]}`)
        lines.push(`- **Stability:** ${status.stabilityCheckpoints} consecutive checkpoints`)
      }

      lines.push(
        `- **Files:** ${status.fileCounts.total} total, ${status.fileCounts.clean} clean (${status.fileCounts.cleanPercentage}%)`
      )
      lines.push(`- **Last activity:** ${status.lastActivity.toISOString().split("T")[0]}`)
      lines.push(``)

      // Enforced norms section
      if (norms.length > 0) {
        lines.push(`## Enforced Norms`)
        lines.push(``)
        lines.push(`The following rules are consistently enforced in this directory:`)
        lines.push(``)

        // Group norms by boundary vs pattern
        const boundaryNorms = norms.filter(
          (n) => n.tags.includes("boundary") || n.ruleKind === "boundary"
        )
        const patternNorms = norms.filter(
          (n) => !n.tags.includes("boundary") && n.ruleKind !== "boundary"
        )

        if (boundaryNorms.length > 0) {
          lines.push(`### Architectural Boundaries`)
          lines.push(``)
          for (const norm of boundaryNorms) {
            lines.push(
              `- **${norm.ruleId}** — Zero violations since ${norm.extinctSince.toISOString().split("T")[0]}`
            )
            lines.push(`  - Fixed ${norm.totalFixed} violations over ${norm.zeroSpan.days} days`)
            if (norm.docsUrl) {
              lines.push(`  - Docs: ${norm.docsUrl}`)
            }
            lines.push(``)
          }
        }

        if (patternNorms.length > 0) {
          lines.push(`### Code Patterns`)
          lines.push(``)
          for (const norm of patternNorms) {
            const tagList = norm.tags.length > 0 ? ` (${norm.tags.join(", ")})` : ""
            lines.push(
              `- **${norm.ruleId}**${tagList} — Zero violations since ${norm.extinctSince.toISOString().split("T")[0]}`
            )
            lines.push(`  - Fixed ${norm.totalFixed} violations over ${norm.zeroSpan.days} days`)
            if (norm.docsUrl) {
              lines.push(`  - Docs: ${norm.docsUrl}`)
            }
            lines.push(``)
          }
        }
      }

      // Migration threads section
      if (threads.length > 0) {
        lines.push(`## Migration History`)
        lines.push(``)
        lines.push(`Key Amp threads that contributed to this directory's migration:`)
        lines.push(``)

        for (const thread of threads) {
          const dateRange = `${thread.first.toISOString().split("T")[0]} → ${thread.last.toISOString().split("T")[0]}`
          const fixes = `${thread.fixesDelta.errors} errors, ${thread.fixesDelta.warnings} warnings`

          lines.push(`- **${thread.threadId}** (${dateRange})`)
          lines.push(`  - Fixed: ${fixes}`)
          lines.push(`  - Rules addressed: ${thread.topRules.join(", ")}`)
          if (thread.threadUrl) {
            lines.push(`  - Thread: ${thread.threadUrl}`)
          }
          lines.push(``)
        }
      }

      // Verification section
      lines.push(`## Verification`)
      lines.push(``)
      lines.push(`Re-run migration audit to verify compliance:`)
      lines.push(``)
      lines.push(`\`\`\`bash`)
      lines.push(`# Audit current state`)
      lines.push(`effect-migrate audit --amp-out .amp/effect-migrate`)
      lines.push(``)
      lines.push(`# Check checkpoint history`)
      lines.push(`effect-migrate checkpoints list`)
      lines.push(`\`\`\``)
      lines.push(``)

      // Footer
      lines.push(`---`)
      lines.push(``)
      lines.push(`*Generated by effect-migrate from checkpoint analysis*`)

      return lines.join("\n")
    }

    return AgentsDocGenerator.of({
      generateForDirectory: (directory, options = {}) =>
        Effect.gen(function* () {
          const { overwrite = false, includeThreads = true } = options

          // Get insights data
          const status = yield* insights
            .classifyDirectories({ minFiles: 1 })
            .pipe(Effect.map((dirs) => dirs.find((d) => d.path === directory)))

          if (!status) {
            return yield* Effect.fail(
              new Error(`Directory not found in checkpoint history: ${directory}`)
            )
          }

          const norms = yield* insights.directoryNorms(directory)
          const threads = includeThreads ? yield* insights.directoryThreads(directory) : []

          // Render template
          const content = renderTemplate(status, norms, threads)

          // Write AGENTS.md
          const agentsPath = path.join(directory, "AGENTS.md")

          // Check if exists
          const exists = yield* fs.exists(agentsPath)
          if (exists && !overwrite) {
            return yield* Effect.fail(
              new Error(`${agentsPath} already exists. Use --overwrite to replace.`)
            )
          }

          yield* fs.writeFileString(agentsPath, content)

          return {
            path: agentsPath,
            status,
            normsCount: norms.length,
            threadsCount: threads.length
          }
        }),

      generateAll: (options = {}) =>
        Effect.gen(function* () {
          const {
            target = "migrated",
            depth = 2,
            minFiles = 3,
            stabilityCheckpoints = 3,
            stabilityDays = 7,
            overwrite = false
          } = options

          // Classify all directories
          const allDirs = yield* insights.classifyDirectories({ depth, minFiles })

          // Filter by target
          const targetDirs = allDirs.filter((dir) => {
            if (target === "all") return true
            if (target === "migrated") return dir.status === "migrated"
            if (target === "in-progress") return dir.status === "in-progress"
            return false
          })

          // Generate for each directory
          return yield* Effect.forEach(
            targetDirs,
            (dir) => this.generateForDirectory(dir.path, { overwrite, includeThreads: true }),
            { concurrency: 2 } // Sequential to avoid filesystem race
          )
        })
    })
  })
)
```

### CLI Integration

```typescript
// packages/cli/src/commands/agents.ts
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import { AgentsInsights, AgentsDocGenerator } from "@effect-migrate/core"

const agentsGenerateCommand = Command.make(
  "generate",
  {
    ampOut: Options.directory("amp-out").pipe(Options.withDefault(".amp/effect-migrate")),
    checkpointDb: Options.file("checkpoint-db").pipe(Options.optional),
    target: Options.choice("target", ["migrated", "in-progress", "all"]).pipe(
      Options.withDefault("migrated")
    ),
    depth: Options.integer("depth").pipe(Options.withDefault(2)),
    minFiles: Options.integer("min-files").pipe(Options.withDefault(3)),
    stabilityCheckpoints: Options.integer("stability-checkpoints").pipe(Options.withDefault(3)),
    stabilityDays: Options.integer("stability-days").pipe(Options.withDefault(7)),
    overwrite: Options.boolean("overwrite").pipe(Options.withDefault(false))
  },
  (opts) =>
    Effect.gen(function* () {
      yield* Console.log("🔍 Analyzing checkpoint history...")

      const generator = yield* AgentsDocGenerator

      const docs = yield* generator.generateAll({
        target: opts.target,
        depth: opts.depth,
        minFiles: opts.minFiles,
        stabilityCheckpoints: opts.stabilityCheckpoints,
        stabilityDays: opts.stabilityDays,
        overwrite: opts.overwrite
      })

      if (docs.length === 0) {
        yield* Console.log(`\n❌ No directories matched criteria for ${opts.target}`)
        return
      }

      yield* Console.log(`\n✅ Generated AGENTS.md for ${docs.length} directories:`)

      for (const doc of docs) {
        const statusEmoji =
          doc.status.status === "migrated"
            ? "✅"
            : doc.status.status === "in-progress"
              ? "🔄"
              : "⏸️"

        yield* Console.log(
          `  ${statusEmoji} ${doc.path} (${doc.normsCount} norms, ${doc.threadsCount} threads)`
        )
      }

      yield* Console.log(
        `\n💡 Tip: Amp will auto-load these AGENTS.md files when working in these directories`
      )
    })
)

export const agentsCommand = Command.make("agents").pipe(
  Command.withSubcommands([agentsGenerateCommand])
)
```

### CLI Usage

```bash
# Generate AGENTS.md for all migrated directories
effect-migrate agents generate --checkpoint-db .amp/effect-migrate/checkpoints.db

# Generate for all directories (including in-progress)
effect-migrate agents generate --target all

# Customize stability thresholds
effect-migrate agents generate --stability-checkpoints 5 --stability-days 14

# Overwrite existing AGENTS.md files
effect-migrate agents generate --overwrite

# Adjust directory depth and minimum file count
effect-migrate agents generate --depth 3 --min-files 5
```

### Output Example

**Generated `src/services/AGENTS.md`:**

````markdown
---
generated: 2025-11-08T14:30:00Z
status: migrated
source: effect-migrate checkpoint analysis
---

# AGENTS for src/services

## Status

**✅ Migrated**

- **Clean since:** 2025-11-05
- **Stability:** 5 consecutive checkpoints
- **Files:** 18 total, 18 clean (100%)
- **Last activity:** 2025-11-05

## Enforced Norms

The following rules are consistently enforced in this directory:

### Architectural Boundaries

- **no-node-imports** — Zero violations since 2025-11-05
  - Fixed 12 violations over 8 days
  - Docs: https://effect.website/docs/guides/platform

- **no-import-from-legacy** — Zero violations since 2025-11-04
  - Fixed 8 violations over 10 days

### Code Patterns

- **no-async-await** (async, migration) — Zero violations since 2025-11-05
  - Fixed 24 violations over 8 days
  - Docs: https://effect.website/docs/essentials/effect-type

- **no-promise-constructor** (async, error-handling) — Zero violations since 2025-11-04
  - Fixed 15 violations over 10 days

- **use-effect-console** (logging, services) — Zero violations since 2025-11-03
  - Fixed 18 violations over 12 days

## Migration History

Key Amp threads that contributed to this directory's migration:

- **T-a96b5e77-ba99-4c03-89e9-d7c9145c9700** (2025-11-03 → 2025-11-05)
  - Fixed: 18 errors, 32 warnings
  - Rules addressed: no-async-await, no-node-imports, use-effect-console
  - Thread: https://ampcode.com/threads/T-a96b5e77-ba99-4c03-89e9-d7c9145c9700

- **T-5d39c44c-3f5e-4112-b0b1-d9b9add1eea7** (2025-11-04 → 2025-11-05)
  - Fixed: 6 errors, 12 warnings
  - Rules addressed: no-promise-constructor, no-import-from-legacy

## Verification

Re-run migration audit to verify compliance:

```bash
# Audit current state
effect-migrate audit --amp-out .amp/effect-migrate

# Check checkpoint history
effect-migrate checkpoints list
```

---

_Generated by effect-migrate from checkpoint analysis_
````

**Effort:** 6-10 hours

---

## Phase 2: LLM-Enhanced Generation with @effect/ai

> **💡 NOTE:** If using "context prep + Amp" approach from Phase 1 notes, this phase becomes unnecessary.
> Amp itself provides the LLM capabilities, so we'd just invoke Amp differently.
>
> This phase only makes sense if we're doing the full deterministic implementation.

**Goal:** Add optional AI-powered summaries for thread impacts and pattern descriptions.

**Effort:** 4-6 hours

### Dependencies

```bash
pnpm add @effect/ai @effect/ai-openai
```

### Enhanced AgentsDocGenerator with AI

```typescript
import { LanguageModel } from "@effect/ai"
import { OpenAiLanguageModel, OpenAiClient } from "@effect/ai-openai"
import * as Config from "effect/Config"
import * as Option from "effect/Option"

/**
 * Optional AI layer for enhanced documentation generation.
 */
export const OptionalAiLayer = Effect.gen(function* () {
  const apiKey = yield* Config.redacted("OPENAI_API_KEY").pipe(Config.option)

  if (Option.isNone(apiKey)) {
    yield* Console.log("ℹ️  No OPENAI_API_KEY - using deterministic templates only")
    return Layer.empty
  }

  return Layer.mergeAll(
    OpenAiLanguageModel.layer({ model: "gpt-4o-mini" }),
    OpenAiClient.layerConfig({ apiKey: apiKey.value })
  )
})

/**
 * Generate AI summary of thread impact.
 */
const generateThreadSummary = (thread: ThreadImpact) =>
  Effect.gen(function* () {
    const prompt = `
Summarize the migration work done in this Amp coding agent thread in 2-3 sentences:

Thread ID: ${thread.threadId}
Date Range: ${thread.first.toISOString().split("T")[0]} to ${thread.last.toISOString().split("T")[0]}
Fixes: ${thread.fixesDelta.errors} errors, ${thread.fixesDelta.warnings} warnings
Rules Addressed: ${thread.topRules.join(", ")}

Focus on what patterns were established and architectural changes made.
Be concise and technical.
    `.trim()

    const response = yield* LanguageModel.generateText({ prompt }).pipe(
      Effect.timeout(Duration.seconds(15)),
      Effect.catchAll(() =>
        Effect.succeed({
          text: `Fixed ${thread.fixesDelta.errors + thread.fixesDelta.warnings} findings across ${thread.topRules.length} rules.`
        })
      )
    )

    return response.text
  })

/**
 * Generate AI summary of directory migration journey.
 */
const generateMigrationSummary = (status: DirectoryStatus, norms: readonly NormEvidence[]) =>
  Effect.gen(function* () {
    const prompt = `
Summarize the migration journey for this directory in 3-5 sentences:

Directory: ${status.path}
Status: ${status.status}
Files: ${status.fileCounts.total} total, ${status.fileCounts.clean} clean (${status.fileCounts.cleanPercentage}%)
Clean since: ${status.cleanSince?.toISOString().split("T")[0] ?? "N/A"}

Key norms established:
${norms.map((n) => `- ${n.ruleId}: Fixed ${n.totalFixed} violations over ${n.zeroSpan.days} days`).join("\n")}

Focus on the architectural improvements and pattern adoption.
Write for technical audience (developers and AI coding agents).
    `.trim()

    const response = yield* LanguageModel.generateText({ prompt }).pipe(
      Effect.timeout(Duration.seconds(20)),
      Effect.catchAll(() =>
        Effect.succeed({
          text: `Migrated ${status.fileCounts.total} files by enforcing ${norms.length} rules.`
        })
      )
    )

    return response.text
  })

/**
 * Enhanced template renderer with AI summaries.
 */
const renderTemplateWithAi = (
  status: DirectoryStatus,
  norms: readonly NormEvidence[],
  threads: readonly ThreadImpact[],
  options: {
    readonly migrationSummary?: string
    readonly threadSummaries?: Map<string, string>
  }
) => {
  const lines: string[] = []

  // ... (same header and status as before) ...

  // AI-generated migration overview (if available)
  if (options.migrationSummary) {
    lines.push(`## Migration Overview`)
    lines.push(``)
    lines.push(options.migrationSummary)
    lines.push(``)
  }

  // ... (same enforced norms as before) ...

  // Enhanced migration threads with AI summaries
  if (threads.length > 0) {
    lines.push(`## Migration History`)
    lines.push(``)
    lines.push(`Key Amp threads that contributed to this directory's migration:`)
    lines.push(``)

    for (const thread of threads) {
      const dateRange = `${thread.first.toISOString().split("T")[0]} → ${thread.last.toISOString().split("T")[0]}`
      const summary = options.threadSummaries?.get(thread.threadId)

      lines.push(`### ${thread.threadId}`)
      lines.push(``)
      lines.push(`**Period:** ${dateRange}`)

      if (summary) {
        lines.push(``)
        lines.push(summary)
      }

      lines.push(``)
      lines.push(`**Impact:**`)
      lines.push(
        `- Fixed ${thread.fixesDelta.errors} errors, ${thread.fixesDelta.warnings} warnings`
      )
      lines.push(`- Rules: ${thread.topRules.join(", ")}`)

      if (thread.threadUrl) {
        lines.push(`- [View thread](${thread.threadUrl})`)
      }
      lines.push(``)
    }
  }

  // ... (same verification and footer) ...

  return lines.join("\n")
}
```

### Enhanced CLI with AI Options

```typescript
const agentsGenerateCommand = Command.make(
  "generate",
  {
    // ... (existing options) ...
    llm: Options.choice("llm", ["off", "threads", "full"]).pipe(Options.withDefault("off"))
  },
  (opts) =>
    Effect.gen(function* () {
      yield* Console.log("🔍 Analyzing checkpoint history...")

      // Load optional AI layer
      const aiLayer = opts.llm !== "off" ? yield* OptionalAiLayer : Layer.empty

      const generator = yield* AgentsDocGenerator

      // Generate with AI enhancement based on --llm flag
      const docs = yield* generator
        .generateAll({
          target: opts.target,
          depth: opts.depth,
          minFiles: opts.minFiles,
          stabilityCheckpoints: opts.stabilityCheckpoints,
          stabilityDays: opts.stabilityDays,
          overwrite: opts.overwrite,
          aiEnhancement: opts.llm // Pass to generator
        })
        .pipe(Effect.provide(aiLayer))

      // ... (same output as before) ...
    })
)
```

### CLI Usage with AI

```bash
# Generate with AI thread summaries only
effect-migrate agents generate --llm threads

# Generate with full AI enhancement (migration overview + thread summaries)
effect-migrate agents generate --llm full

# Requires OPENAI_API_KEY environment variable
export OPENAI_API_KEY=sk-...
effect-migrate agents generate --llm full
```

**Effort:** 4-6 hours

---

## Phase 3: Amp SDK Integration for Programmatic Workflows

> **✨ INSIGHT:** This phase is actually the SIMPLEST approach!
>
> If we start here instead of Phases 1-2, we get:
> - Minimal code (just context prep + Amp invocation)
> - Better quality (Amp writes better docs than templates)
> - Thread awareness (Amp can read-thread automatically)
> - Flexibility (users can tweak prompts)
>
> **Recommendation:** Consider implementing Phase 3 FIRST as MVP, then add deterministic fallback later if needed.

**Goal:** Enable programmatic invocation of Amp for advanced documentation generation tasks.

**Effort:** 2-4 hours

### Use Cases

1. **Thread Content Analysis**: Read thread content programmatically to extract migration decisions
2. **Automated Documentation**: Generate comprehensive docs by combining checkpoint data with Amp's analysis
3. **Cross-Thread Pattern Detection**: Identify common patterns across multiple migration threads

### Dependencies

```bash
pnpm add @sourcegraph/amp
```

> **💡 EVEN SIMPLER:** Instead of using CLI with `--execute`, we could:
>
> 1. Import `@sourcegraph/amp` SDK directly
> 2. Wrap SDK methods in Effect services
> 3. Use Effect's resource management for Amp sessions
>
> **Benefits:**
> - Type-safe API instead of CLI string parsing
> - Better error handling (structured errors vs exit codes)
> - Can reuse Amp sessions across multiple operations
> - Composable with other Effect services
> - No subprocess overhead
>
> **Example:**
> ```typescript
> import { AmpClient } from "@sourcegraph/amp"
> 
> export const AmpServiceLive = Layer.effect(
>   AmpService,
>   Effect.gen(function* () {
>     const client = yield* Effect.acquireRelease(
>       Effect.sync(() => new AmpClient({ apiKey: process.env.AMP_API_KEY })),
>       (client) => Effect.sync(() => client.close())
>     )
>     
>     return AmpService.of({
>       executePrompt: (prompt) => Effect.promise(() => client.execute(prompt)),
>       readThread: (threadId) => Effect.promise(() => client.getThread(threadId))
>     })
>   })
> )
> ```

### Amp Service Interface

```typescript
import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Schema from "effect/Schema"

/**
 * Amp thread analysis result.
 */
export const AmpThreadAnalysis = Schema.Struct({
  threadId: Schema.String,
  summary: Schema.String,
  keyDecisions: Schema.Array(Schema.String),
  patternsAdopted: Schema.Array(Schema.String)
})

export type AmpThreadAnalysis = Schema.Schema.Type<typeof AmpThreadAnalysis>

/**
 * Amp SDK integration service.
 */
export interface AmpServiceInterface {
  /**
   * Analyze thread content to extract migration decisions.
   */
  readonly analyzeThread: (
    threadId: string,
    prompt: string
  ) => Effect.Effect<AmpThreadAnalysis, PlatformError>

  /**
   * Execute Amp task and return result.
   */
  readonly executeTask: (
    prompt: string,
    context?: readonly string[]
  ) => Effect.Effect<string, PlatformError>
}

export class AmpService extends Context.Tag("AmpService")<AmpService, AmpServiceInterface>() {}
```

### Implementation

```typescript
import { Command as NodeCommand } from "@effect/platform-node"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Console from "effect/Console"

/**
 * Amp SDK service implementation.
 *
 * Uses Amp CLI with --execute and --stream-json for programmatic access.
 */
export const AmpServiceLive = Layer.effect(
  AmpService,
  Effect.gen(function* () {
    const command = yield* NodeCommand.Command

    return AmpService.of({
      analyzeThread: (threadId, prompt) =>
        Effect.gen(function* () {
          yield* Console.log(`📖 Reading thread ${threadId} via Amp...`)

          // Build prompt for thread analysis
          const fullPrompt = `
Read thread ${threadId} using read-thread tool.

${prompt}

Return JSON with this exact structure:
{
  "threadId": "${threadId}",
  "summary": "2-3 sentence summary",
  "keyDecisions": ["decision 1", "decision 2"],
  "patternsAdopted": ["pattern 1", "pattern 2"]
}
          `.trim()

          // Execute via Amp CLI
          const result = yield* command.make("amp", "--execute", fullPrompt, "--stream-json").pipe(
            command.exitCode,
            Effect.flatMap((code) =>
              code === 0
                ? Effect.succeed({
                    threadId,
                    summary: "Thread analysis completed",
                    keyDecisions: [],
                    patternsAdopted: []
                  })
                : Effect.fail(new Error(`Amp execution failed with code ${code}`))
            )
          )

          return result
        }),

      executeTask: (prompt, context = []) =>
        Effect.gen(function* () {
          yield* Console.log(`🤖 Executing Amp task...`)

          // Build context string
          const contextStr =
            context.length > 0
              ? `\n\nContext files:\n${context.map((f) => `@${f}`).join("\n")}`
              : ""

          const fullPrompt = `${prompt}${contextStr}`

          // Execute via Amp CLI
          const result = yield* command.make("amp", "--execute", fullPrompt).pipe(
            command.lines,
            Stream.runCollect,
            Effect.map((lines) => Chunk.toArray(lines).join("\n"))
          )

          return result
        })
    })
  })
)
```

### Enhanced Generator with Amp Integration

```typescript
/**
 * Enhanced AGENTS.md generation with Amp thread analysis.
 */
const generateWithAmpAnalysis = (
  status: DirectoryStatus,
  norms: readonly NormEvidence[],
  threads: readonly ThreadImpact[]
) =>
  Effect.gen(function* () {
    const amp = yield* AmpService

    // Analyze each thread with Amp
    const threadAnalyses = yield* Effect.forEach(
      threads,
      (thread) =>
        amp.analyzeThread(
          thread.threadId,
          `
Extract the key migration decisions and patterns adopted in this thread.
Focus on:
- Architectural changes (boundary enforcement, layering)
- Pattern adoption (Effect.gen, services, error handling)
- Rationale for specific approaches

This thread worked on directory: ${status.path}
Rules addressed: ${thread.topRules.join(", ")}
          `.trim()
        ),
      { concurrency: 2 } // Limit concurrent Amp calls
    )

    // Generate enhanced documentation
    const threadSummaries = new Map(
      threadAnalyses.map((analysis) => [
        analysis.threadId,
        `${analysis.summary}\n\n**Key decisions:** ${analysis.keyDecisions.join(", ")}\n**Patterns:** ${analysis.patternsAdopted.join(", ")}`
      ])
    )

    return renderTemplateWithAi(status, norms, threads, { threadSummaries })
  })
```

### CLI Usage with Amp Integration

```bash
# Generate with Amp thread analysis
effect-migrate agents generate --llm threads --use-amp

# Requires AMP_API_KEY environment variable (same as used for Amp sessions)
export AMP_API_KEY=your-api-key
effect-migrate agents generate --llm full --use-amp
```

> **🔧 SDK INTEGRATION BENEFITS:**
>
> If we wrap Amp SDK in Effect services, we get:
>
> **Better composability:**
> ```typescript
> // Compose Amp calls with other Effect operations
> const generateDocs = Effect.gen(function* () {
>   const summary = yield* prepareSummary()  // Effect operation
>   const ampResult = yield* AmpService.executePrompt(...)  // Amp SDK wrapped
>   const written = yield* writeFile(...)  // Effect operation
>   return written
> })
> ```
>
> **Retry/timeout built-in:**
> ```typescript
> const robustGeneration = ampService.executePrompt(prompt).pipe(
>   Effect.retry(Schedule.exponential(1000)),
>   Effect.timeout(Duration.seconds(30))
> )
> ```
>
> **Testable:**
> ```typescript
> // Mock Amp service for tests
> const AmpServiceMock = Layer.succeed(AmpService, {
>   executePrompt: () => Effect.succeed("Generated AGENTS.md content..."),
>   readThread: () => Effect.succeed({ decisions: [...] })
> })
> ```
>
> This follows the same pattern we use for FileSystem, SqlClient, etc.

**Effort:** 2-4 hours

---

## Success Criteria

### Phase 1 (Deterministic Generation)

- [ ] AgentsInsights service classifies directories correctly
- [ ] Stability heuristics (K checkpoints, D days) work reliably
- [ ] Norm extraction identifies rules that went to zero
- [ ] Thread impact calculation attributes fixes correctly
- [ ] Template rendering produces valid Markdown
- [ ] CLI command generates AGENTS.md for migrated directories
- [ ] Generated docs include all required sections
- [ ] Performance: <2s to analyze 50 checkpoints, 20 directories

### Phase 2 (LLM Enhancement)

- [ ] Optional AI layer loads when OPENAI_API_KEY is set
- [ ] Thread summaries are concise and technical
- [ ] Migration overview captures key improvements
- [ ] Fallback to deterministic templates when AI unavailable
- [ ] Concurrent processing with rate limiting works
- [ ] AI-generated text is contextually relevant

### Phase 3 (Amp Integration)

- [ ] Amp CLI execution via --execute works programmatically
- [ ] Thread analysis extracts decisions and patterns
- [ ] Stream JSON parsing handles Amp output
- [ ] Rate limiting prevents excessive Amp API usage
- [ ] Error handling for Amp failures is graceful

---

## Integration Points

### With Existing Features

**Checkpoint Persistence (comprehensive-data-architecture Phase 2):**

- Reads checkpoint history from SQLite or JSON
- Uses manifest.json for efficient traversal
- Leverages normalized schema for memory efficiency

**Analytics Engine (comprehensive-data-architecture Phase 3):**

- Extends AnalyticsEngine with directory-scoped queries
- Reuses SQLite aggregations and Polars optimizations
- Shares CheckpointStore abstraction

**Thread Management (existing):**

- Reads threads.json for thread associations
- Links checkpoint thread_id to actual thread URLs
- Provides context for AI summarization

### Data Flow

```
Checkpoints (JSON/SQLite)
       │
       ▼
AgentsInsights
  ├─► Directory classification
  ├─► Norm extraction
  └─► Thread impact analysis
       │
       ▼
AgentsDocGenerator
  ├─► Template rendering (deterministic)
  ├─► Optional: @effect/ai summaries
  └─► Optional: Amp SDK analysis
       │
       ▼
Directory-specific AGENTS.md files
```

---

## File Locations

### New Files

```
packages/core/src/
├── agents/
│   ├── AgentsInsights.ts          # Service interface + types
│   ├── JsonAgentsInsights.ts      # JSON-based implementation
│   ├── SqliteAgentsInsights.ts    # SQLite-based implementation
│   ├── AgentsDocGenerator.ts      # Template rendering
│   ├── AmpService.ts              # Amp SDK integration (Phase 3)
│   └── templates/
│       └── agents-md.ts           # AGENTS.md template

packages/cli/src/
├── commands/
│   └── agents.ts                  # CLI command implementation
└── formatters/
    └── agents-output.ts           # Console output formatting
```

> **📦 MINIMAL MVP FILE STRUCTURE:**
>
> If using SDK wrapper approach, you'd only need:
>
> ```
> packages/core/src/
> ├── amp/
> │   └── AmpService.ts           # Effect wrapper for @sourcegraph/amp SDK
> └── agents/
>     └── summarizer.ts           # Checkpoint → JSON summary (simple)
> 
> packages/cli/src/
> └── commands/
>     └── agents.ts               # agents generate command (~100 LOC)
> ```
>
> **That's it!** Everything else handled by Amp SDK + Effect composition.

### Modified Files

```
packages/core/src/
└── index.ts                       # Export new services

packages/cli/src/
└── index.ts                       # Add agents command to CLI
```

---

## Configuration Options

### CLI Flags

```bash
effect-migrate agents generate [options]

Options:
  --amp-out <path>                Output directory (default: .amp/effect-migrate)
  --checkpoint-db <path>          SQLite database path (optional)
  --target <type>                 migrated|in-progress|all (default: migrated)
  --depth <number>                Directory depth for grouping (default: 2)
  --min-files <number>            Minimum files per directory (default: 3)
  --stability-checkpoints <n>     Consecutive zeros required (default: 3)
  --stability-days <n>            Days clean required (default: 7)
  --min-historical-count <n>      Min historical violations (default: 3)
  --overwrite                     Overwrite existing AGENTS.md (default: false)
  --llm <mode>                    off|threads|full (default: off, requires OPENAI_API_KEY)
  --use-amp                       Use Amp SDK for thread analysis (requires AMP_API_KEY)
```

### Environment Variables

```bash
# For @effect/ai integration
OPENAI_API_KEY=sk-...

# For Amp SDK integration
AMP_API_KEY=your-api-key
```

---

## Performance Targets

| Metric                    | Target (50 checkpoints, 20 dirs) | Notes                          |
| ------------------------- | -------------------------------- | ------------------------------ |
| Directory classification  | <500ms                           | SQLite aggregations            |
| Norm extraction (per dir) | <200ms                           | Rule history queries           |
| Thread impact (per dir)   | <150ms                           | Checkpoint delta calculations  |
| Template rendering        | <50ms                            | Pure string operations         |
| Total (deterministic)     | <2s                              | For all qualifying directories |
| AI thread summary         | <5s per thread                   | OpenAI API latency             |
| Amp thread analysis       | <10s per thread                  | Amp execution overhead         |
| Memory usage              | <200MB                           | Streaming where possible       |

---

## Migration Path

### For Existing Users

1. **Phase 1 available immediately** after checkpoint persistence is implemented
2. **No breaking changes** to existing checkpoint format
3. **Opt-in feature** - doesn't affect existing workflows
4. **Progressive enhancement** - can start with deterministic, add AI later

### Adoption Strategy

```bash
# Step 1: Build checkpoint history (run audit several times over days/weeks)
effect-migrate audit --amp-out .amp/effect-migrate --checkpoint-db checkpoints.db

# Step 2: Once directories stabilize, generate AGENTS.md
effect-migrate agents generate

# Step 3: Review generated docs, adjust thresholds if needed
effect-migrate agents generate --stability-checkpoints 5 --overwrite

# Step 4 (optional): Add AI enhancement
export OPENAI_API_KEY=sk-...
effect-migrate agents generate --llm full --overwrite

# Step 5: Commit generated AGENTS.md files to repo
git add src/**/AGENTS.md
git commit -m "docs: add auto-generated directory AGENTS.md files"
```

---

## Risks and Mitigations

### Risk: False Positives (Temporary Zeros)

**Problem:** Directory temporarily clean, then regresses.

**Mitigation:**

- Require K consecutive checkpoints AND D days clean
- Set reasonable defaults (3 checkpoints, 7 days)
- Allow users to adjust thresholds
- Include "last activity" date in generated docs

### Risk: Sparse/Irregular Checkpoints

**Problem:** Users run audits infrequently, not enough data.

**Mitigation:**

- Document minimum checkpoint requirements
- Surface warnings when history is insufficient
- Fall back to "provisionally migrated" status
- Suggest running audits more frequently

### Risk: Directory Renames/Refactors

**Problem:** Paths change, norms fragment across old/new paths.

**Mitigation:**

- Treat paths textually (simple, predictable)
- Future: Add path remap config for major refactors
- Document limitation in generated AGENTS.md header

### Risk: Performance on Large Histories

**Problem:** 200+ checkpoints across 50+ directories.

**Mitigation:**

- Use SQLite aggregations (efficient)
- Limit analysis to last N checkpoints (default 50)
- Enable Polars for complex trailing-zero calculations
- Process directories with concurrency control

### Risk: LLM Cost and Privacy

**Problem:** AI summaries cost money, may leak sensitive info.

**Mitigation:**

- Make AI **opt-in** via --llm flag
- Default to deterministic templates (free, private)
- Use gpt-4o-mini (cheap, fast) by default
- Document costs and privacy considerations
- Support self-hosted models via OpenRouter

---

## Future Enhancements

### Beyond Initial Implementation

**Rule Taxonomy Registry:**

- Central mapping of rule IDs to categories
- Better norm grouping and descriptions
- Shared across presets

**Boundary Verification Graphs:**

- Visualize import boundaries over time
- ASCII diagrams in AGENTS.md
- Detect circular dependencies

**Cross-Directory Analysis:**

- Identify shared patterns across directories
- Suggest preset creation from norms
- Team-wide migration insights

**VS Code Extension:**

- Inline AGENTS.md hints
- Quick actions to re-generate docs
- Checkpoint history viewer

**MCP Server Integration:**

- Expose insights via MCP protocol
- Enable Amp to query migration status
- Real-time norm verification

---

## Effort Summary

| Phase                    | Effort | Deliverable                                |
| ------------------------ | ------ | ------------------------------------------ |
| Phase 1: Core Generation | 6-10h  | Deterministic AGENTS.md from checkpoints   |
| Phase 2: AI Enhancement  | 4-6h   | Optional LLM summaries with @effect/ai     |
| Phase 3: Amp Integration | 2-4h   | Programmatic thread analysis via Amp SDK   |
| **Total**                | 12-20h | Production-ready directory docs generation |

> **⚡ ALTERNATIVE PATH (RECOMMENDED FOR MVP):**
>
> | Approach                        | Effort | Deliverable                              |
> | ------------------------------- | ------ | ---------------------------------------- |
> | Context Prep + Amp Invocation   | 2-4h   | JSON summaries + Amp CLI integration     |
>
> **Implementation:**
>
> 1. Build simple checkpoint summarizer (query latest checkpoint, group by directory, extract norms)
> 2. Write directory summaries as JSON
> 3. Invoke `amp --execute` with prompt to generate AGENTS.md
> 4. Done!
>
> **Upgrade path:** If users need standalone operation or deterministic output, add Phases 1-2 later.

---

## References

### Internal Documentation

- [Comprehensive Data Architecture](./comprehensive-data-architecture.md)
- [Checkpoint-Based Audit Persistence](./checkpoint-based-audit-persistence.md)
- [Schema Versioning and Normalization](./schema-versioning-and-normalization.md)
- [Amp Integration Concepts](../concepts/amp-integration.md)
- [Root AGENTS.md](../../AGENTS.md)

### External Resources

- [@effect/ai Documentation](https://effect.website/docs/packages/ai)
- [Amp Manual](https://ampcode.com/manual)
- [Effect Services Pattern](https://effect.website/docs/guides/context-management/services)
- [SQLite Window Functions](https://www.sqlite.org/windowfunctions.html)
- [nodejs-polars](https://pola-rs.github.io/nodejs-polars/)

---

> **🎯 FINAL RECOMMENDATION:**
>
> **Start simple, iterate based on real usage:**
>
> 1. **MVP (Week 1):** Implement "context prep + Amp invocation" approach
>    - Minimal code (~200 LOC)
>    - Leverages Amp's strengths
>    - Gets feedback on what docs users actually want
>
> 2. **Iteration (Week 2+):** Based on user feedback:
>    - If users need offline/deterministic: Add Phase 1 templates
>    - If Amp summaries aren't good enough: Add custom prompts or Phase 2 @effect/ai
>    - If performance becomes issue: Add caching/optimization
>
> 3. **Future:** Only build the complex infrastructure if truly needed
>
> **Why this makes sense:**
> - effect-migrate already assumes Amp usage (it's built FOR Amp)
> - Users already have AMP_API_KEY configured
> - Amp is BETTER at writing documentation than we'd be with templates
> - We can always add deterministic fallback later
> - **Amp SDK in Effect = perfect dogfooding:** We'd be using Effect patterns to wrap Amp SDK, just like we wrap FileSystem, SqlClient, etc.
>
> **Additional benefits of SDK wrapper:**
> - Can reuse Amp's `read-thread` capability (already implemented in SDK)
> - Amp SDK handles authentication, retries, rate limiting
> - Type-safe API surface (no CLI string parsing)
> - Testable with Effect's Layer mocking
> - Composable with our existing Effect services
>
> **Alternative view:** If you want effect-migrate to work standalone (without Amp), then the full Phase 1-3 architecture makes sense.

---

**Last Updated:** 2025-11-08  
**Maintainer:** Ari Dyckovsky  
**Status:** Ready for implementation (recommend MVP approach first)  
**Next Steps:** Decide on MVP vs full implementation, validate approach with team, prototype context summarizer
