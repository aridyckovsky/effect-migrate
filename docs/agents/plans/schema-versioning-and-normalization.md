---
created: 2025-11-06
lastUpdated: 2025-11-06
author: Generated via Amp (Oracle + Librarian analysis)
status: ready
thread: https://ampcode.com/threads/T-b45a5ac4-b859-4f11-95f4-c872c6e7eae0
audience: Development team and AI coding agents
tags: [schema, versioning, architecture, refactor, performance]
related:
  - ../concepts/amp-integration.md
  - ../../AGENTS.md
---

# Schema Versioning and Normalization Refactor

## Goal

Implement a comprehensive versioning strategy and optimize schema architecture to:

1. **Separate schema version from package version** with clear semver semantics
2. **Normalize audit output** to eliminate duplication (byFile/byRule currently duplicate all RuleResult objects)
3. **Reduce memory footprint** by 50-70% for large projects (5k+ findings)
4. **Maintain backwards compatibility** during transition
5. **Improve developer experience** with clear version contracts

**Estimated Effort:** 8-12 hours (1-2 dev days)

---

## Problem Analysis

### Current Issues

#### 1. Versioning Confusion

**Package versions vs schema versions:**
```json
// packages/core/package.json
{ "version": "0.2.1" }

// packages/cli/package.json
{
  "version": "0.2.1",
  "effectMigrate": {
    "schemaVersion": "1.0.0"  // Hardcoded, out of sync
  }
}

// Root package.json (monorepo)
{ "version": "0.0.0", "private": true }  // Stuck at 0.0.0
```

**Problems:**
- `schemaVersion: "1.0.0"` implies stability but packages are pre-1.0 (0.2.1)
- Schema version hardcoded in one place (CLI package.json)
- No relationship between schema changes and package changes
- Root monorepo version confusing (0.0.0 is meaningless)

**Current output (index.json):**
```json
{
  "version": 1,
  "schemaVersion": "1.0.0",  // Single version for all artifacts
  "toolVersion": "0.2.1",
  "files": { "audit": "./audit.json", "metrics": "./metrics.json" }
}
```

#### 2. Schema Memory Duplication

**Current structure (audit.json):**
```typescript
// context-writer.ts lines 418-436
const byFile: Record<string, RuleResult[]> = {}
const byRule: Record<string, RuleResult[]> = {}

for (const result of results) {
  // Add to byFile
  byFile[file].push(result)  // Full RuleResult object
  
  // Add to byRule
  byRule[ruleId].push(result)  // Same object duplicated
}
```

**Example output size:**
```json
{
  "findings": {
    "byFile": {
      "src/api/user.ts": [
        {
          "id": "no-async-await",
          "ruleKind": "pattern",
          "severity": "warning",
          "message": "Replace async/await with Effect.gen",
          "file": "src/api/user.ts",
          "range": { "start": { "line": 23, "column": 5 }, "end": { "line": 23, "column": 19 } },
          "docsUrl": "https://effect.website/docs/guides/essentials/async",
          "tags": ["async", "migration"]
        }
      ]
    },
    "byRule": {
      "no-async-await": [
        {
          // SAME EXACT OBJECT REPEATED
          "id": "no-async-await",
          "ruleKind": "pattern",
          "severity": "warning",
          "message": "Replace async/await with Effect.gen",
          "file": "src/api/user.ts",
          "range": { "start": { "line": 23, "column": 5 }, "end": { "line": 23, "column": 19 } },
          "docsUrl": "https://effect.website/docs/guides/essentials/async",
          "tags": ["async", "migration"]
        }
      ]
    }
  }
}
```

**Waste calculation (1000 findings, 50 files, 10 rules):**
- Each finding: ~250 bytes average
- Stored twice (byFile + byRule): 500 bytes per finding
- Total: 1000 × 500 = 500 KB
- **50% of data is pure duplication**

**Additional verbosity:**
- Range as nested objects: `{"start": {"line": N, "column": M}, "end": {...}}`
- Could be tuple: `[startLine, startCol, endLine, endCol]` (saves ~40 bytes/finding)
- Rule metadata repeated in every finding instead of shared

#### 3. Missing Artifact-Specific Versioning

**Current:**
- Only `index.json` has `schemaVersion`
- `audit.json` has `version` (revision counter) but no schema version
- No way to evolve `audit.json` independently from `metrics.json`

**Example confusion:**
```json
// audit.json
{
  "version": 5,  // What does this mean? Revision? Format?
  "findings": { ... }
}
```

---

## Solution Design

### Core Principles

Following best practices from:
- **OpenAPI:** Schema version embedded in document (`openapi: "3.1.0"`)
- **JSON Schema:** `$schema` URI for version identification
- **TypeScript:** `buildInfo.version` separate from compiler version
- **Effect-TS patterns:** Schema.Class, nominal typing, transformation pipelines

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Version Registry (Single Source of Truth)                   │
│                                                              │
│ packages/core/src/schema/versions.ts                         │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ export const SCHEMA_VERSIONS = {                         ││
│ │   index: "1.1.0",    // index.json format               ││
│ │   audit: "2.0.0",    // audit.json format (BREAKING)    ││
│ │   metrics: "0.1.0",  // metrics.json format             ││
│ │   threads: "1.0.0",  // threads.json format             ││
│ │   config: 1          // Config file version (integer)   ││
│ │ }                                                         ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
           ▼                                    ▼
┌──────────────────────┐          ┌──────────────────────────┐
│ Config Input         │          │ Artifact Output          │
│ (User-Authored)      │          │ (CLI-Generated)          │
├──────────────────────┤          ├──────────────────────────┤
│ {                    │          │ index.json               │
│   version: 1,        │          │ ├─ schemaVersion: "1.1.0"│
│   paths: {...},      │          │ ├─ versions: {           │
│   patterns: [...]    │          │ │   audit: "2.0.0",      │
│ }                    │          │ │   metrics: "0.1.0"     │
│                      │          │ │  }                     │
│ Validated by:        │          │ └─ files: {...}          │
│ ConfigSchema         │          │                          │
│ (core/schema)        │          │ audit.json               │
│                      │          │ ├─ schemaVersion: "2.0.0"│
│                      │          │ ├─ revision: 1           │
│                      │          │ ├─ files: string[]       │
│                      │          │ ├─ rules: RuleDef[]      │
│                      │          │ ├─ results: Result[]     │
│                      │          │ └─ groups: {...}         │
└──────────────────────┘          └──────────────────────────┘
```

### Versioning Strategy

#### 1. Version Registry

**File:** `packages/core/src/schema/versions.ts`

```typescript
/**
 * Schema Version Registry - Single source of truth for all artifact versions.
 * 
 * ## Version Policy
 * 
 * **Artifact schemas use semver (string):**
 * - MAJOR: Breaking changes to structure (consumers must update parsers)
 * - MINOR: Additive changes (new optional fields, backwards compatible)
 * - PATCH: Clarifications, typos, no structural changes
 * 
 * **Config schema uses integer (major only):**
 * - Simple integer increments for breaking changes
 * - User-authored files need simpler versioning
 * 
 * **Package versions (managed by changesets):**
 * - Independent of schema versions
 * - CLI/core can evolve without forcing schema changes
 * 
 * @module @effect-migrate/core/schema/versions
 * @since 0.3.0
 */

/**
 * Current schema versions for all artifacts.
 * 
 * **IMPORTANT:** When updating versions here, also update:
 * - packages/cli/package.json effectMigrate.schemaVersions
 * - tests will fail if out of sync
 */
export const SCHEMA_VERSIONS = {
  /** index.json format version */
  index: "1.1.0",
  
  /** audit.json format version */
  audit: "2.0.0",
  
  /** metrics.json format version */
  metrics: "0.1.0",
  
  /** threads.json format version */
  threads: "1.0.0"
} as const

/**
 * Current config file major version.
 * 
 * Config files use simple integer versioning:
 * - version: 1 (current)
 * - version: 2 (future breaking change)
 */
export const CURRENT_CONFIG_VERSION = 1

/**
 * Type-safe schema version keys.
 */
export type SchemaVersionKey = keyof typeof SCHEMA_VERSIONS

/**
 * Get schema version for a specific artifact.
 */
export const getSchemaVersion = (key: SchemaVersionKey): string => SCHEMA_VERSIONS[key]
```

**Mirror in package.json:** `packages/cli/package.json`

```json
{
  "name": "@effect-migrate/cli",
  "version": "0.2.1",
  "effectMigrate": {
    "schemaVersions": {
      "index": "1.1.0",
      "audit": "2.0.0",
      "metrics": "0.1.0",
      "threads": "1.0.0"
    },
    "configVersion": 1
  }
}
```

**Validation test:** `packages/core/test/schema/versions.test.ts`

```typescript
import { expect, it } from "@effect/vitest"
import { SCHEMA_VERSIONS, CURRENT_CONFIG_VERSION } from "../../src/schema/versions.js"
import pkg from "../../../cli/package.json" assert { type: "json" }

it("schema versions in code match CLI package.json", () => {
  const pkgVersions = pkg.effectMigrate?.schemaVersions
  
  expect(pkgVersions).toBeDefined()
  expect(pkgVersions.index).toBe(SCHEMA_VERSIONS.index)
  expect(pkgVersions.audit).toBe(SCHEMA_VERSIONS.audit)
  expect(pkgVersions.metrics).toBe(SCHEMA_VERSIONS.metrics)
  expect(pkgVersions.threads).toBe(SCHEMA_VERSIONS.threads)
  expect(pkg.effectMigrate?.configVersion).toBe(CURRENT_CONFIG_VERSION)
})
```

#### 2. Per-Artifact Schema Versions

**Updated index.json:**

```typescript
export const AmpContextIndex = Schema.Struct({
  /** Index format version */
  schemaVersion: Schema.String,
  
  /** Individual artifact versions */
  versions: Schema.Struct({
    audit: Schema.String,
    metrics: Schema.optional(Schema.String),
    threads: Schema.optional(Schema.String)
  }),
  
  /** effect-migrate package version */
  toolVersion: Schema.String,
  
  /** Project root directory */
  projectRoot: Schema.String,
  
  /** ISO timestamp */
  timestamp: Schema.DateTimeUtc,
  
  /** Relative paths to artifacts */
  files: Schema.Struct({
    audit: Schema.String,
    metrics: Schema.optional(Schema.String),
    badges: Schema.optional(Schema.String),
    threads: Schema.optional(Schema.String)
  })
})
```

**Example output:**

```json
{
  "schemaVersion": "1.1.0",
  "versions": {
    "audit": "2.0.0",
    "metrics": "0.1.0",
    "threads": "1.0.0"
  },
  "toolVersion": "0.3.0",
  "projectRoot": ".",
  "timestamp": "2025-11-06T10:00:00.000Z",
  "files": {
    "audit": "./audit.json",
    "metrics": "./metrics.json",
    "threads": "./threads.json",
    "badges": "./badges.md"
  }
}
```

**Updated audit.json:**

```typescript
export const AmpAuditContext = Schema.Struct({
  /** Audit format version (NEW) */
  schemaVersion: Schema.String,
  
  /** Revision counter (increments per run) */
  revision: Schema.Number,
  
  /** effect-migrate package version */
  toolVersion: Schema.String,
  
  /** Project root directory */
  projectRoot: Schema.String,
  
  /** ISO timestamp */
  timestamp: Schema.DateTimeUtc,
  
  /** Normalized findings */
  findings: NormalizedFindings,
  
  /** Config snapshot */
  config: ConfigSnapshot,
  
  /** Thread references */
  threads: Schema.optional(Schema.Array(ThreadReference))
})
```

### Normalized Audit Schema

#### Current vs. Normalized Comparison

**Current (v1.0.0):** 500 KB for 1000 findings

```json
{
  "version": 5,
  "findings": {
    "byFile": {
      "src/api/user.ts": [
        { "id": "no-async", "ruleKind": "pattern", "severity": "warning", "message": "...", "file": "src/api/user.ts", "range": {...}, "docsUrl": "...", "tags": [...] }
      ]
    },
    "byRule": {
      "no-async": [
        { "id": "no-async", "ruleKind": "pattern", "severity": "warning", "message": "...", "file": "src/api/user.ts", "range": {...}, "docsUrl": "...", "tags": [...] }
      ]
    }
  }
}
```

**Normalized (v2.0.0):** ~150-200 KB for 1000 findings (60-70% reduction)

```json
{
  "schemaVersion": "2.0.0",
  "revision": 5,
  "files": [
    "src/api/user.ts",
    "src/api/posts.ts"
  ],
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
      "0": [0, 5, 12],
      "1": [2, 8]
    },
    "byRule": {
      "0": [0, 2, 5, 8, 12]
    }
  }
}
```

**Savings breakdown:**
- **Rule metadata shared:** Rule id, kind, message, docsUrl, tags stored once (not per finding)
- **File paths shared:** File stored once, referenced by index
- **Range as tuple:** `[23, 5, 23, 19]` vs `{"start": {"line": 23, "column": 5}, ...}`
- **Groups use indices:** Arrays of numbers instead of full objects

#### Schema Definition

**File:** `packages/cli/src/amp/schema.ts` (new file)

```typescript
/**
 * Normalized Audit Schema - Compact, deduplicated structure.
 * 
 * @module @effect-migrate/cli/amp/schema
 * @since 0.3.0
 */

import * as Schema from "effect/Schema"
import type { RuleResult, Severity } from "@effect-migrate/core"

/**
 * Rule definition with shared metadata.
 * 
 * All findings referencing this rule share the same metadata.
 * Individual findings can override severity/message if needed.
 */
export const RuleDef = Schema.Struct({
  /** Unique rule identifier */
  id: Schema.String,
  
  /** Rule type */
  ruleKind: Schema.Literal("pattern", "boundary", "docs", "metrics"),
  
  /** Default severity */
  severity: Schema.Literal("error", "warning", "info"),
  
  /** Default message template */
  message: Schema.String,
  
  /** Documentation URL */
  docsUrl: Schema.optional(Schema.String),
  
  /** Rule tags */
  tags: Schema.optional(Schema.Array(Schema.String))
})

/**
 * Compact finding result with references.
 * 
 * Uses numeric indices to reference files[] and rules[] arrays.
 * Range stored as 4-element tuple: [startLine, startCol, endLine, endCol].
 * Optional overrides for severity/message when different from rule default.
 */
export const CompactResult = Schema.Struct({
  /** Index into rules[] array */
  rule: Schema.Number,
  
  /** Index into files[] array (optional if rule applies globally) */
  file: Schema.optional(Schema.Number),
  
  /** Location as tuple: [startLine, startCol, endLine, endCol] */
  range: Schema.optional(Schema.Tuple(
    Schema.Number,  // startLine
    Schema.Number,  // startCol
    Schema.Number,  // endLine
    Schema.Number   // endCol
  )),
  
  /** Override message (if different from rule default) */
  message: Schema.optional(Schema.String),
  
  /** Override severity (if different from rule default) */
  severity: Schema.optional(Schema.Literal("error", "warning", "info"))
})

/**
 * Legacy range format for backwards compatibility.
 */
export const LegacyRange = Schema.Struct({
  start: Schema.Struct({
    line: Schema.Number,
    column: Schema.Number
  }),
  end: Schema.Struct({
    line: Schema.Number,
    column: Schema.Number
  })
})

/**
 * Union decoder: accepts tuple OR legacy object range.
 */
export const RangeUnion = Schema.Union(
  Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
  LegacyRange
).pipe(
  Schema.transform(
    Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
    {
      decode: input => 
        Array.isArray(input)
          ? input
          : [input.start.line, input.start.column, input.end.line, input.end.column] as const,
      encode: tuple => tuple
    }
  )
)

/**
 * Normalized findings structure.
 */
export const NormalizedFindings = Schema.Struct({
  /** Unique file paths (referenced by index) */
  files: Schema.Array(Schema.String),
  
  /** Rule definitions (referenced by index) */
  rules: Schema.Array(RuleDef),
  
  /** Compact finding results */
  results: Schema.Array(CompactResult),
  
  /** Groupings by file and rule (indices only) */
  groups: Schema.Struct({
    /** File index -> array of result indices */
    byFile: Schema.Record({
      key: Schema.String,  // File index as string
      value: Schema.Array(Schema.Number)  // Result indices
    }),
    
    /** Rule index -> array of result indices */
    byRule: Schema.Record({
      key: Schema.String,  // Rule index as string
      value: Schema.Array(Schema.Number)  // Result indices
    })
  }),
  
  /** Summary statistics */
  summary: Schema.Struct({
    errors: Schema.Number,
    warnings: Schema.Number,
    totalFiles: Schema.Number,
    totalFindings: Schema.Number
  })
})

/**
 * Helper: Expand a compact result back to full RuleResult.
 * 
 * Used when reading normalized audit for backwards compatibility
 * or when consumers need the full shape.
 */
export const expandResult = (
  result: typeof CompactResult.Type,
  rules: readonly typeof RuleDef.Type[],
  files: readonly string[]
): RuleResult => {
  const rule = rules[result.rule]
  
  return {
    id: rule.id,
    ruleKind: rule.ruleKind,
    severity: result.severity ?? rule.severity,
    message: result.message ?? rule.message,
    ...(result.file !== undefined && { file: files[result.file] }),
    ...(result.range && {
      range: {
        start: { line: result.range[0], column: result.range[1] },
        end: { line: result.range[2], column: result.range[3] }
      }
    }),
    ...(rule.docsUrl && { docsUrl: rule.docsUrl }),
    ...(rule.tags && { tags: rule.tags })
  }
}

/**
 * Helper: Normalize RuleResults into compact structure.
 */
export const normalizeResults = (
  results: readonly RuleResult[]
): typeof NormalizedFindings.Type => {
  const filesSet = new Set<string>()
  const rulesMap = new Map<string, typeof RuleDef.Type>()
  const compactResults: typeof CompactResult.Type[] = []
  
  // Build files and rules indices
  for (const result of results) {
    if (result.file) filesSet.add(result.file)
    
    if (!rulesMap.has(result.id)) {
      rulesMap.set(result.id, {
        id: result.id,
        ruleKind: result.ruleKind,
        severity: result.severity,
        message: result.message,
        ...(result.docsUrl && { docsUrl: result.docsUrl }),
        ...(result.tags && { tags: result.tags })
      })
    }
  }
  
  const files = Array.from(filesSet).sort()
  const rules = Array.from(rulesMap.values())
  const fileIndex = new Map(files.map((f, i) => [f, i]))
  const ruleIndex = new Map(rules.map((r, i) => [r.id, i]))
  
  // Build compact results
  const byFile: Record<string, number[]> = {}
  const byRule: Record<string, number[]> = {}
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const ruleIdx = ruleIndex.get(result.id)!
    const fileIdx = result.file ? fileIndex.get(result.file) : undefined
    
    const compact: typeof CompactResult.Type = {
      rule: ruleIdx,
      ...(fileIdx !== undefined && { file: fileIdx }),
      ...(result.range && {
        range: [
          result.range.start.line,
          result.range.start.column,
          result.range.end.line,
          result.range.end.column
        ] as const
      })
    }
    
    // Only include overrides if different from rule default
    const ruleDefault = rules[ruleIdx]
    if (result.severity !== ruleDefault.severity) {
      compact.severity = result.severity
    }
    if (result.message !== ruleDefault.message) {
      compact.message = result.message
    }
    
    compactResults.push(compact)
    
    // Update groups
    if (fileIdx !== undefined) {
      if (!byFile[fileIdx]) byFile[fileIdx] = []
      byFile[fileIdx].push(i)
    }
    
    if (!byRule[ruleIdx]) byRule[ruleIdx] = []
    byRule[ruleIdx].push(i)
  }
  
  return {
    files,
    rules,
    results: compactResults,
    groups: { byFile, byRule },
    summary: {
      errors: results.filter(r => r.severity === "error").length,
      warnings: results.filter(r => r.severity === "warning").length,
      totalFiles: files.length,
      totalFindings: results.length
    }
  }
}
```

#### Backwards Compatibility

**Reading old format:**

```typescript
// In context-writer.ts or a new migration module
const loadAuditContext = (path: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(path)
    const raw = JSON.parse(content)
    
    // Detect legacy format (missing schemaVersion or v1.0.0)
    if (!raw.schemaVersion || raw.schemaVersion === "1.0.0") {
      yield* Console.warn("⚠ Reading legacy audit format (v1.0.0). Consider regenerating.")
      return yield* migrateLegacyAudit(raw)
    }
    
    // Validate current format
    return yield* Schema.decodeUnknown(AmpAuditContext)(raw)
  })

const migrateLegacyAudit = (raw: unknown) =>
  Effect.gen(function*() {
    // Legacy format has byFile and byRule with full objects
    // Extract unique results and normalize
    const legacyByFile = raw.findings?.byFile ?? {}
    const allResults: RuleResult[] = []
    
    for (const fileResults of Object.values(legacyByFile)) {
      allResults.push(...fileResults)
    }
    
    // Deduplicate (legacy has same result in byFile and byRule)
    const uniqueResults = Array.from(
      new Map(allResults.map(r => [
        `${r.id}:${r.file}:${r.range?.start.line}`,
        r
      ])).values()
    )
    
    const normalized = normalizeResults(uniqueResults)
    
    return {
      schemaVersion: SCHEMA_VERSIONS.audit,
      revision: raw.version ?? 1,
      toolVersion: raw.toolVersion ?? "unknown",
      projectRoot: raw.projectRoot ?? ".",
      timestamp: raw.timestamp,
      findings: normalized,
      config: raw.config,
      threads: raw.threads
    }
  })
```

---

## Implementation Phases

### Phase 0: Version Registry (Priority: P0, Effort: <1h)

**Objective:** Create single source of truth for schema versions.

#### Files Created

**`packages/core/src/schema/versions.ts`:**

```typescript
export const SCHEMA_VERSIONS = {
  index: "1.1.0",
  audit: "2.0.0",
  metrics: "0.1.0",
  threads: "1.0.0"
} as const

export const CURRENT_CONFIG_VERSION = 1

export type SchemaVersionKey = keyof typeof SCHEMA_VERSIONS
export const getSchemaVersion = (key: SchemaVersionKey): string => SCHEMA_VERSIONS[key]
```

**`packages/core/test/schema/versions.test.ts`:**

```typescript
import { expect, it } from "@effect/vitest"
import { SCHEMA_VERSIONS, CURRENT_CONFIG_VERSION } from "../../src/schema/versions.js"
import pkg from "../../../cli/package.json" assert { type: "json" }

it("schema versions match CLI package.json", () => {
  const pkgVersions = pkg.effectMigrate?.schemaVersions
  
  expect(pkgVersions).toBeDefined()
  expect(pkgVersions.index).toBe(SCHEMA_VERSIONS.index)
  expect(pkgVersions.audit).toBe(SCHEMA_VERSIONS.audit)
  expect(pkgVersions.metrics).toBe(SCHEMA_VERSIONS.metrics)
  expect(pkgVersions.threads).toBe(SCHEMA_VERSIONS.threads)
  expect(pkg.effectMigrate?.configVersion).toBe(CURRENT_CONFIG_VERSION)
})
```

#### Files Modified

**`packages/cli/package.json`:**

```diff
  "effectMigrate": {
-   "schemaVersion": "1.0.0"
+   "schemaVersions": {
+     "index": "1.1.0",
+     "audit": "2.0.0",
+     "metrics": "0.1.0",
+     "threads": "1.0.0"
+   },
+   "configVersion": 1
  }
```

**`packages/core/src/index.ts`:**

```diff
+ export { SCHEMA_VERSIONS, CURRENT_CONFIG_VERSION, getSchemaVersion } from "./schema/versions.js"
+ export type { SchemaVersionKey } from "./schema/versions.js"
```

#### Success Criteria

- [ ] Test passes: `pnpm test --filter @effect-migrate/core versions.test.ts`
- [ ] CI passes with version validation
- [ ] Exports accessible: `import { SCHEMA_VERSIONS } from "@effect-migrate/core"`

---

### Phase 1: Embed Schema Versions (Priority: P1, Effort: 1-2h)

**Objective:** Add schemaVersion to all artifacts without changing structure.

#### Files Modified

**`packages/cli/src/amp/context-writer.ts`:**

```diff
+ import { SCHEMA_VERSIONS } from "@effect-migrate/core"

  const getPackageMeta = Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const pkgPath = path.join(import.meta.url, "../../../package.json")
    const pkgContent = yield* fs.readFileString(pkgPath)
    const pkg = yield* Schema.decodeUnknown(PackageJson)(JSON.parse(pkgContent))
    
    return {
      toolVersion: pkg.version,
-     schemaVersion: pkg.effectMigrate?.schemaVersion ?? "1.0.0"
+     schemaVersions: SCHEMA_VERSIONS
    }
  })

  export const AmpContextIndex = Schema.Struct({
-   schemaVersion: Schema.String,
+   schemaVersion: Schema.String,  // Index format version
+   versions: Schema.Struct({
+     audit: Schema.String,
+     metrics: Schema.optional(Schema.String),
+     threads: Schema.optional(Schema.String)
+   }),
    toolVersion: Schema.String,
    // ... rest unchanged
  })

  export const AmpAuditContext = Schema.Struct({
+   schemaVersion: Schema.String,  // Audit format version
-   version: Schema.Number,
+   revision: Schema.Number,  // Rename for clarity
    toolVersion: Schema.String,
    // ... rest unchanged
  })
```

**Writing index.json:**

```diff
  const indexContent: AmpContextIndex = {
-   schemaVersion,
+   schemaVersion: SCHEMA_VERSIONS.index,
+   versions: {
+     audit: SCHEMA_VERSIONS.audit,
+     metrics: SCHEMA_VERSIONS.metrics,
+     threads: SCHEMA_VERSIONS.threads
+   },
    toolVersion,
    projectRoot: ".",
    timestamp,
    files: { ... }
  }
```

**Writing audit.json:**

```diff
  const auditContent: AmpAuditContext = {
-   version: auditVersion,
+   schemaVersion: SCHEMA_VERSIONS.audit,
+   revision: auditVersion,
    toolVersion,
    projectRoot: ".",
    timestamp,
    findings: {
      byFile,
      byRule,
      summary: { ... }
    },
    config: { ... },
    threads: auditThreads
  }
```

#### Tests

**`packages/cli/test/amp/context-writer.test.ts`:**

```diff
  it.effect("writes index.json with schema versions", () =>
    Effect.gen(function*() {
      // ... setup ...
      const index = yield* readIndex(outputDir)
      
-     expect(index.schemaVersion).toBe("1.0.0")
+     expect(index.schemaVersion).toBe(SCHEMA_VERSIONS.index)
+     expect(index.versions.audit).toBe(SCHEMA_VERSIONS.audit)
+     expect(index.versions.metrics).toBe(SCHEMA_VERSIONS.metrics)
+     expect(index.versions.threads).toBe(SCHEMA_VERSIONS.threads)
    })
  )
  
+ it.effect("writes audit.json with schemaVersion", () =>
+   Effect.gen(function*() {
+     // ... setup ...
+     const audit = yield* readAudit(outputDir)
+     
+     expect(audit.schemaVersion).toBe(SCHEMA_VERSIONS.audit)
+     expect(audit.revision).toBeTypeOf("number")
+   })
+ )
```

#### Success Criteria

- [ ] `index.json` includes `schemaVersion` and `versions` object
- [ ] `audit.json` includes `schemaVersion` and `revision` fields
- [ ] All tests pass: `pnpm test --filter @effect-migrate/cli`
- [ ] Manual verification: run `pnpm effect-migrate audit --amp-out .amp` and inspect JSON

---

### Phase 2: Normalize Audit Schema (Priority: P2, Effort: 3-6h)

**Objective:** Implement normalized findings structure with deduplication.

#### Files Created

**`packages/cli/src/amp/schema.ts`:**

```typescript
// See full schema definition in "Normalized Audit Schema" section above
export const RuleDef = Schema.Struct({ ... })
export const CompactResult = Schema.Struct({ ... })
export const NormalizedFindings = Schema.Struct({ ... })

export const normalizeResults = (results: RuleResult[]) => { ... }
export const expandResult = (result, rules, files) => { ... }
```

#### Files Modified

**`packages/cli/src/amp/context-writer.ts`:**

```diff
+ import { normalizeResults } from "./schema.js"
+ import { SCHEMA_VERSIONS } from "@effect-migrate/core"

  const writeAmpContext = (outputDir: string, results: RuleResult[], config: Config) =>
    Effect.gen(function*() {
      // ... setup ...
      
-     // Group findings by file and rule
-     const byFile: Record<string, RuleResult[]> = {}
-     const byRule: Record<string, RuleResult[]> = {}
-     
-     for (const result of results) {
-       if (result.file) {
-         if (!byFile[file]) byFile[file] = []
-         byFile[file].push(result)
-       }
-       if (!byRule[result.id]) byRule[result.id] = []
-       byRule[result.id].push(result)
-     }
      
+     // Normalize findings (deduplicated structure)
+     const normalizedFindings = normalizeResults(results)
      
      const auditContent: AmpAuditContext = {
+       schemaVersion: SCHEMA_VERSIONS.audit,
-       version: auditVersion,
+       revision: auditVersion,
        toolVersion,
        projectRoot: ".",
        timestamp,
-       findings: { byFile, byRule, summary: { ... } },
+       findings: normalizedFindings,
        config: { ... },
        threads: auditThreads
      }
      
      // ... write to file ...
    })
```

#### Tests

**`packages/cli/test/amp/schema.test.ts`:**

```typescript
import { expect, it } from "@effect/vitest"
import { normalizeResults, expandResult } from "../../src/amp/schema.js"
import type { RuleResult } from "@effect-migrate/core"

it("normalizes results with deduplication", () => {
  const results: RuleResult[] = [
    {
      id: "no-async",
      ruleKind: "pattern",
      severity: "warning",
      message: "Replace async/await",
      file: "src/api/user.ts",
      range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } },
      docsUrl: "https://effect.website",
      tags: ["async"]
    },
    {
      id: "no-async",
      ruleKind: "pattern",
      severity: "warning",
      message: "Replace async/await",
      file: "src/api/posts.ts",
      range: { start: { line: 23, column: 1 }, end: { line: 23, column: 15 } },
      docsUrl: "https://effect.website",
      tags: ["async"]
    }
  ]
  
  const normalized = normalizeResults(results)
  
  // Rule stored once
  expect(normalized.rules).toHaveLength(1)
  expect(normalized.rules[0].id).toBe("no-async")
  
  // Files stored once each
  expect(normalized.files).toHaveLength(2)
  expect(normalized.files).toContain("src/api/user.ts")
  expect(normalized.files).toContain("src/api/posts.ts")
  
  // Compact results reference indices
  expect(normalized.results).toHaveLength(2)
  expect(normalized.results[0].rule).toBe(0)
  expect(normalized.results[0].file).toBeDefined()
  expect(normalized.results[0].range).toEqual([10, 5, 10, 20])
  
  // Groups use indices
  expect(normalized.groups.byRule["0"]).toEqual([0, 1])
})

it("expands compact result back to full RuleResult", () => {
  const normalized = normalizeResults([/* ... */])
  const compact = normalized.results[0]
  
  const expanded = expandResult(compact, normalized.rules, normalized.files)
  
  expect(expanded.id).toBe("no-async")
  expect(expanded.file).toBe("src/api/user.ts")
  expect(expanded.range).toEqual({
    start: { line: 10, column: 5 },
    end: { line: 10, column: 20 }
  })
})

it("measures size reduction", () => {
  // Generate 1000 findings across 50 files, 10 rules
  const results: RuleResult[] = []
  for (let i = 0; i < 1000; i++) {
    results.push({
      id: `rule-${i % 10}`,
      ruleKind: "pattern",
      severity: i % 3 === 0 ? "error" : "warning",
      message: `Message for rule ${i % 10}`,
      file: `src/file-${i % 50}.ts`,
      range: { start: { line: i, column: 1 }, end: { line: i, column: 10 } },
      docsUrl: `https://docs/${i % 10}`,
      tags: ["tag1", "tag2"]
    })
  }
  
  const legacySize = JSON.stringify({
    byFile: results.reduce((acc, r) => {
      if (!acc[r.file!]) acc[r.file!] = []
      acc[r.file!].push(r)
      return acc
    }, {}),
    byRule: results.reduce((acc, r) => {
      if (!acc[r.id]) acc[r.id] = []
      acc[r.id].push(r)
      return acc
    }, {})
  }).length
  
  const normalized = normalizeResults(results)
  const normalizedSize = JSON.stringify(normalized).length
  
  const reduction = ((legacySize - normalizedSize) / legacySize) * 100
  
  console.log(`Legacy: ${legacySize} bytes`)
  console.log(`Normalized: ${normalizedSize} bytes`)
  console.log(`Reduction: ${reduction.toFixed(1)}%`)
  
  expect(reduction).toBeGreaterThan(50)  // Expect >50% reduction
})
```

#### Success Criteria

- [ ] `normalizeResults` creates files/rules/results/groups structure
- [ ] `expandResult` reconstructs full RuleResult from compact form
- [ ] Size reduction test shows >50% reduction for 1000 findings
- [ ] All existing tests pass with normalized schema
- [ ] Manual audit: run on real project, verify byFile/byRule groups are correct indices

---

### Phase 3: Backwards Compatibility (Priority: P2, Effort: 2-3h)

**Objective:** Support reading legacy v1.0.0 audit files.

#### Files Created

**`packages/cli/src/amp/migrations.ts`:**

```typescript
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import { SCHEMA_VERSIONS } from "@effect-migrate/core"
import { normalizeResults } from "./schema.js"
import type { RuleResult } from "@effect-migrate/core"

/**
 * Detect schema version from raw JSON.
 */
export const detectSchemaVersion = (raw: unknown): string => {
  if (typeof raw === "object" && raw !== null && "schemaVersion" in raw) {
    return String(raw.schemaVersion)
  }
  return "1.0.0"  // Legacy
}

/**
 * Migrate legacy audit format (v1.0.0) to current.
 */
export const migrateLegacyAudit = (raw: any) =>
  Effect.gen(function*() {
    yield* Console.warn("⚠ Reading legacy audit format (v1.0.0)")
    
    // Extract all results from byFile (legacy has duplicates in byFile and byRule)
    const legacyByFile = raw.findings?.byFile ?? {}
    const allResults: RuleResult[] = []
    
    for (const fileResults of Object.values(legacyByFile)) {
      allResults.push(...(fileResults as RuleResult[]))
    }
    
    // Deduplicate using composite key
    const uniqueResults = Array.from(
      new Map(allResults.map(r => [
        `${r.id}:${r.file}:${r.range?.start.line}:${r.range?.start.column}`,
        r
      ])).values()
    )
    
    // Normalize to v2.0.0 structure
    const normalized = normalizeResults(uniqueResults)
    
    return {
      schemaVersion: SCHEMA_VERSIONS.audit,
      revision: raw.version ?? 1,
      toolVersion: raw.toolVersion ?? "unknown",
      projectRoot: raw.projectRoot ?? ".",
      timestamp: raw.timestamp,
      findings: normalized,
      config: raw.config,
      threads: raw.threads
    }
  })

/**
 * Load audit context with automatic migration.
 */
export const loadAuditContext = (path: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(path)
    const raw = JSON.parse(content)
    
    const version = detectSchemaVersion(raw)
    
    if (version === "1.0.0") {
      return yield* migrateLegacyAudit(raw)
    }
    
    if (version === SCHEMA_VERSIONS.audit) {
      return yield* Schema.decodeUnknown(AmpAuditContext)(raw)
    }
    
    return yield* Effect.fail(
      new Error(`Unsupported audit schema version: ${version}`)
    )
  })
```

#### Tests

**`packages/cli/test/amp/migrations.test.ts`:**

```typescript
import { expect, it } from "@effect/vitest"
import { migrateLegacyAudit, detectSchemaVersion } from "../../src/amp/migrations.js"

it("detects legacy format", () => {
  const legacy = { version: 5, findings: { byFile: {}, byRule: {} } }
  expect(detectSchemaVersion(legacy)).toBe("1.0.0")
  
  const current = { schemaVersion: "2.0.0", revision: 5 }
  expect(detectSchemaVersion(current)).toBe("2.0.0")
})

it.effect("migrates legacy audit to v2.0.0", () =>
  Effect.gen(function*() {
    const legacy = {
      version: 5,
      toolVersion: "0.2.1",
      projectRoot: ".",
      timestamp: "2025-01-01T00:00:00.000Z",
      findings: {
        byFile: {
          "src/api/user.ts": [
            {
              id: "no-async",
              ruleKind: "pattern",
              severity: "warning",
              message: "Replace async/await",
              file: "src/api/user.ts",
              range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } }
            }
          ]
        },
        byRule: {
          "no-async": [
            {
              id: "no-async",
              ruleKind: "pattern",
              severity: "warning",
              message: "Replace async/await",
              file: "src/api/user.ts",
              range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } }
            }
          ]
        }
      }
    }
    
    const migrated = yield* migrateLegacyAudit(legacy)
    
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSIONS.audit)
    expect(migrated.revision).toBe(5)
    expect(migrated.findings.rules).toHaveLength(1)
    expect(migrated.findings.files).toHaveLength(1)
    expect(migrated.findings.results).toHaveLength(1)
  })
)
```

#### Success Criteria

- [ ] `detectSchemaVersion` identifies legacy and current formats
- [ ] `migrateLegacyAudit` deduplicates and normalizes legacy audit
- [ ] Tests pass for migration scenarios
- [ ] CLI can read old audit files without errors

---

### Phase 4: Config Version Enforcement (Priority: P3, Effort: 1-2h)

**Objective:** Validate config version and provide migration scaffold.

#### Files Modified

**`packages/core/src/schema/loader.ts`:**

```diff
+ import { CURRENT_CONFIG_VERSION } from "./versions.js"

  export const loadConfig = (configPath: string) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const content = yield* fs.readFileString(configPath)
      const data = JSON.parse(content)
      
+     // Validate config version
+     if (typeof data.version !== "number") {
+       return yield* Effect.fail(
+         new ConfigValidationError({
+           path: configPath,
+           errors: "Config must include 'version' field (number)"
+         })
+       )
+     }
+     
+     if (data.version > CURRENT_CONFIG_VERSION) {
+       return yield* Effect.fail(
+         new ConfigValidationError({
+           path: configPath,
+           errors: `Config version ${data.version} is newer than supported version ${CURRENT_CONFIG_VERSION}. Please upgrade effect-migrate.`
+         })
+       )
+     }
+     
+     if (data.version < CURRENT_CONFIG_VERSION) {
+       yield* Console.warn(`⚠ Config version ${data.version} is outdated. Migrating to v${CURRENT_CONFIG_VERSION}...`)
+       data = yield* migrateConfig(data.version, data)
+     }
      
      // Decode with schema
      const config = yield* Schema.decodeUnknown(ConfigSchema)(data)
      return config
    })

+ /**
+  * Migrate config from older versions.
+  * 
+  * Currently only v1 exists, so this is a scaffold for future migrations.
+  */
+ const migrateConfig = (fromVersion: number, data: unknown) =>
+   Effect.gen(function*() {
+     // No migrations yet; v1 is current
+     if (fromVersion === 1) {
+       return data
+     }
+     
+     return yield* Effect.fail(
+       new ConfigValidationError({
+         path: "unknown",
+         errors: `Cannot migrate config from version ${fromVersion}`
+       })
+     )
+   })
```

#### Tests

**`packages/core/test/schema/loader.test.ts`:**

```typescript
it.effect("rejects config with version > current", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    yield* fs.writeFileString("future-config.json", JSON.stringify({
      version: 2,  // Future version
      paths: { exclude: [] }
    }))
    
    const result = yield* loadConfig("future-config.json").pipe(
      Effect.either
    )
    
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(ConfigValidationError)
      expect(result.left.errors).toContain("newer than supported")
    }
  })
)

it.effect("accepts config with version = current", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    yield* fs.writeFileString("valid-config.json", JSON.stringify({
      version: 1,
      paths: { exclude: [] }
    }))
    
    const config = yield* loadConfig("valid-config.json")
    expect(config.version).toBe(1)
  })
)
```

#### Success Criteria

- [ ] Config loading validates version field
- [ ] Rejects config with version > CURRENT_CONFIG_VERSION
- [ ] Migration scaffold in place for future config changes
- [ ] Tests pass for version validation

---

### Phase 5: Documentation and Cleanup (Priority: P4, Effort: 2-3h)

**Objective:** Update docs, add deprecation warnings, plan removal.

#### Files Modified

**`README.md`:**

```diff
  ### 3. Generate Amp Context
  
  ```bash
  pnpm effect-migrate audit --amp-out .amp/effect-migrate
  ```
  
- This creates `.amp/effect-migrate/context.json`:
+ This creates `.amp/effect-migrate/audit.json`:
  
  ```json
  {
-   "version": 1,
+   "schemaVersion": "2.0.0",
+   "revision": 1,
    "timestamp": "2025-01-03T10:00:00Z",
-   "projectPath": "/Users/you/project",
-   "migrationState": { ... },
    "findings": {
-     "byFile": { "src/api/user.ts": [...] },
-     "byRule": { "no-async": [...] }
+     "files": ["src/api/user.ts"],
+     "rules": [{"id": "no-async", ...}],
+     "results": [{"rule": 0, "file": 0, "range": [23, 5, 23, 19]}],
+     "groups": {
+       "byFile": {"0": [0]},
+       "byRule": {"0": [0]}
+     }
    }
  }
  ```

+ **Schema Versioning**
+ 
+ effect-migrate uses semantic versioning for artifact schemas:
+ 
+ - `schemaVersion`: Format version (e.g., "2.0.0")
+ - `revision`: Increments per audit run (instance version)
+ - `toolVersion`: Package version (independent of schema)
+ 
+ **Breaking change (v2.0.0):** audit.json now uses normalized structure with deduplicated findings. If you're reading audit.json programmatically, update your parser or use the CLI's read utilities.
```

**`packages/cli/CHANGELOG.md`:**

```diff
+ ## [0.3.0] - 2025-11-XX
+ 
+ ### Added
+ 
+ - Schema version registry in `@effect-migrate/core`
+ - Per-artifact schema versioning (index, audit, metrics, threads)
+ - Normalized audit schema (v2.0.0) with 50-70% size reduction
+ - Backwards compatibility for legacy audit format (v1.0.0)
+ - Config version validation and migration scaffold
+ 
+ ### Changed
+ 
+ - **BREAKING:** audit.json structure changed to normalized format
+   - `findings.byFile` and `findings.byRule` now use indices instead of full objects
+   - `findings.files` and `findings.rules` store deduplicated data
+   - `findings.results` use compact representation with range tuples
+ - Renamed `audit.version` to `audit.revision` for clarity
+ - Added `schemaVersion` field to all artifacts
+ - index.json now includes `versions` object with per-artifact versions
+ 
+ ### Migration Guide
+ 
+ **If you're consuming audit.json programmatically:**
+ 
+ 1. Update to read `schemaVersion` field
+ 2. Use `normalizeResults` and `expandResult` helpers from `@effect-migrate/cli/amp/schema`
+ 3. Or regenerate audit files with v0.3.0+
+ 
+ **Old format (v1.0.0) still supported via automatic migration.**
```

**`packages/core/AGENTS.md`:**

```diff
  ## Schema Validation
  
+ ### Versioning
+ 
+ All schemas use explicit versioning:
+ 
+ **Version Registry (`schema/versions.ts`):**
+ ```typescript
+ export const SCHEMA_VERSIONS = {
+   index: "1.1.0",
+   audit: "2.0.0",
+   metrics: "0.1.0",
+   threads: "1.0.0"
+ }
+ export const CURRENT_CONFIG_VERSION = 1
+ ```
+ 
+ **Output artifacts include `schemaVersion`:**
+ ```json
+ {
+   "schemaVersion": "2.0.0",
+   "revision": 5,
+   "findings": { ... }
+ }
+ ```
+ 
+ **Config uses integer version:**
+ ```json
+ {
+   "version": 1,
+   "paths": { ... }
+ }
+ ```
+ 
  ```typescript
  import { Schema } from "effect"
  
  // Define schemas with Schema.Struct
  const ConfigSchema = Schema.Struct({
    version: Schema.Number,
```

**`docs/agents/concepts/amp-integration.md`:**

```diff
  ### Recommended file layout
  
  Written by effect-migrate CLI:
  
  ```
  .amp/effect-migrate/
  ├── index.json     # Entry point and resource index (MCP-compatible)
- ├── context.json   # High-level migration state summary
  ├── audit.json     # Findings by file (rules, locations)
  ├── metrics.json   # Progress and completion aggregates
  ├── threads.json   # Known thread references (IDs, URLs, tags)
  └── badges.md      # Progress badges for docs/readme
  ```

+ **Schema versions (as of 0.3.0):**
+ 
+ - `index.json`: v1.1.0
+ - `audit.json`: v2.0.0 (normalized, deduplicated)
+ - `metrics.json`: v0.1.0
+ - `threads.json`: v1.0.0
+ 
+ Each artifact includes `schemaVersion` field for compatibility tracking.
```

#### Console Output

**`packages/cli/src/commands/audit.ts`:**

```diff
  const auditCommand = Command.make("audit", options, (opts) =>
    Effect.gen(function*() {
      // ... run audit ...
      
      if (opts.ampOut) {
        yield* writeAmpContext(opts.ampOut, results, config)
+       yield* Console.log(`✓ Wrote Amp context to ${opts.ampOut}`)
+       yield* Console.log(`  Schema versions: audit=${SCHEMA_VERSIONS.audit}, index=${SCHEMA_VERSIONS.index}`)
      }
      
      // ... format output ...
    })
  )
```

#### Success Criteria

- [ ] README updated with new schema examples
- [ ] CHANGELOG documents breaking changes and migration path
- [ ] AGENTS.md explains versioning strategy
- [ ] CLI prints schema versions on context write
- [ ] All docs reference correct artifact structure

---

## Testing Strategy

### Unit Tests

**Schema validation:**
```bash
pnpm test --filter @effect-migrate/core schema/versions.test.ts
```

**Normalization logic:**
```bash
pnpm test --filter @effect-migrate/cli amp/schema.test.ts
```

**Migration compatibility:**
```bash
pnpm test --filter @effect-migrate/cli amp/migrations.test.ts
```

### Integration Tests

**Full audit workflow:**
```bash
pnpm test --filter @effect-migrate/cli commands/audit.test.ts
```

**Size reduction verification:**
```typescript
it.effect("audit reduces output size by >50% on large projects", () =>
  Effect.gen(function*() {
    // Generate 5000 findings
    const results = generateMockResults(5000, 100, 20)
    
    // Write normalized
    yield* writeAmpContext(outputDir, results, config)
    const auditPath = path.join(outputDir, "audit.json")
    const content = yield* fs.readFileString(auditPath)
    const normalizedSize = content.length
    
    // Compare to legacy size estimate
    const legacySize = estimateLegacySize(results)
    const reduction = ((legacySize - normalizedSize) / legacySize) * 100
    
    expect(reduction).toBeGreaterThan(50)
  })
)
```

### Manual Testing

**Real project audit:**
```bash
# In a TypeScript project with 100+ files
pnpm effect-migrate audit --amp-out .amp/effect-migrate

# Verify outputs
cat .amp/effect-migrate/index.json | jq '.schemaVersion, .versions'
cat .amp/effect-migrate/audit.json | jq '.schemaVersion, .revision, .findings.files | length'
```

**Backwards compatibility:**
```bash
# Save legacy audit
mv .amp/effect-migrate/audit.json .amp/effect-migrate/audit-legacy.json

# Regenerate with new version
pnpm effect-migrate audit --amp-out .amp/effect-migrate

# Restore legacy and verify migration
mv .amp/effect-migrate/audit-legacy.json .amp/effect-migrate/audit.json
pnpm effect-migrate metrics --amp-out .amp/effect-migrate
# Should auto-migrate and warn
```

---

## Migration Path for Users

### For CLI Users

**No action required:**
- Old audit files auto-migrate when read
- New audit runs generate v2.0.0 format
- Warning printed on legacy format detection

**Optional:**
- Regenerate context to get size benefits: `pnpm effect-migrate audit --amp-out .amp`

### For Programmatic Consumers

**If reading audit.json directly:**

**Before (v1.0.0):**
```typescript
const audit = JSON.parse(fs.readFileSync("audit.json", "utf-8"))
const fileResults = audit.findings.byFile["src/api/user.ts"]
for (const result of fileResults) {
  console.log(result.id, result.message, result.range.start.line)
}
```

**After (v2.0.0):**
```typescript
import { expandResult } from "@effect-migrate/cli/amp/schema"

const audit = JSON.parse(fs.readFileSync("audit.json", "utf-8"))

// Get file index
const fileIdx = audit.findings.files.indexOf("src/api/user.ts")
const resultIndices = audit.findings.groups.byFile[fileIdx]

// Expand results
for (const idx of resultIndices) {
  const compact = audit.findings.results[idx]
  const full = expandResult(compact, audit.findings.rules, audit.findings.files)
  console.log(full.id, full.message, full.range.start.line)
}
```

**Or use helper SDK (future):**
```typescript
import { AuditReader } from "@effect-migrate/sdk"

const reader = new AuditReader("audit.json")
const fileResults = reader.getResultsForFile("src/api/user.ts")
// Returns full RuleResult objects
```

---

## Success Metrics

### Performance

- [ ] Audit.json size reduced by 50-70% for projects with 1000+ findings
- [ ] No measurable performance regression in audit runtime
- [ ] Schema validation adds <10ms overhead

### Compatibility

- [ ] All existing tests pass with new schema
- [ ] Legacy audit files load without errors
- [ ] Manual testing on 3+ real projects succeeds

### Developer Experience

- [ ] Clear error messages for version mismatches
- [ ] Documentation updated with examples
- [ ] Migration path documented in CHANGELOG
- [ ] CI validates schema version consistency

---

## Rollback Plan

If issues arise:

1. **Revert to v0.2.1:**
   ```bash
   git revert <commit-hash>
   pnpm install
   pnpm build
   ```

2. **Regenerate context with old version:**
   ```bash
   pnpm effect-migrate@0.2.1 audit --amp-out .amp
   ```

3. **Keep migration code:** Don't delete migrations.ts; useful for future attempts

---

## Future Enhancements (Optional)

### Phase 6: JSON Schema Publication

**Objective:** Publish canonical JSON Schemas for external validation.

```bash
packages/cli/schemas/
├── audit-2.0.0.json       # JSON Schema for audit v2.0.0
├── index-1.1.0.json       # JSON Schema for index v1.1.0
└── config-1.json          # JSON Schema for config v1
```

**Add $schema field:**
```json
{
  "$schema": "https://effect-migrate.dev/schemas/audit-2.0.0.json",
  "schemaVersion": "2.0.0",
  "revision": 5
}
```

### Phase 7: Consumer SDK

**Objective:** Provide helper library for reading normalized audit.

```typescript
// @effect-migrate/sdk
export class AuditReader {
  constructor(private audit: AmpAuditContext) {}
  
  getResultsForFile(file: string): RuleResult[] {
    const fileIdx = this.audit.findings.files.indexOf(file)
    const indices = this.audit.findings.groups.byFile[fileIdx] ?? []
    return indices.map(i => expandResult(
      this.audit.findings.results[i],
      this.audit.findings.rules,
      this.audit.findings.files
    ))
  }
  
  getResultsForRule(ruleId: string): RuleResult[] { ... }
  getAllFiles(): string[] { ... }
  getAllRules(): RuleDef[] { ... }
}
```

### Phase 8: Streaming/Compression

**For very large repos (10k+ files, 100k+ findings):**

- Gzip compression: `audit.json.gz`
- JSON Lines format: `audit.jsonl` (one result per line)
- Split artifacts: `audit-files.json`, `audit-rules.json`, `audit-results-*.json`

---

## Related Work

- [OpenAPI Specification Versioning](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md)
- [JSON Schema Versioning](https://json-schema.org/understanding-json-schema/reference/schema.html)
- [TypeScript BuildInfo](https://github.com/microsoft/TypeScript/blob/main/src/compiler/tsbuildPublic.ts)
- [Effect-TS Schema](https://effect.website/docs/schema/introduction)

---

**Last Updated:** 2025-11-06  
**Maintainer:** @aridyckovsky  
**Status:** Ready for implementation  
**Thread:** https://ampcode.com/threads/T-b45a5ac4-b859-4f11-95f4-c872c6e7eae0
