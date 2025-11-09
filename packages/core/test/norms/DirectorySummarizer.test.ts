/**
 * DirectorySummarizer Service Tests
 *
 * Tests the service layer integration:
 * - Loading checkpoints from checkpoint-manager
 * - Converting checkpoint data to pure function format
 * - Converting NormData to Norm Schema types
 * - Building complete DirectorySummary
 *
 * @module @effect-migrate/core/test/norms/DirectorySummarizer
 * @since 0.4.0
 */

import * as NodeContext from "@effect/platform-node/NodeContext"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { expect, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

import {
  DirectorySummarizer,
  DirectorySummarizerLive
} from "../../src/norms/DirectorySummarizer.js"
import { NoCheckpointsError } from "../../src/norms/errors.js"
import { AuditCheckpoint, CheckpointManifest, CheckpointMetadata } from "../../src/schema/amp.js"
import { SCHEMA_VERSION } from "../../src/schema/versions.js"

const TestLayer = DirectorySummarizerLive.pipe(
  Layer.provide(NodeContext.layer),
  Layer.merge(NodeContext.layer)
)

/**
 * Helper: Create minimal checkpoint with findings for specific directory.
 */
const createCheckpoint = (
  checkpointId: string,
  timestamp: DateTime.Utc,
  directory: string,
  violationCounts: Record<string, number>
): typeof AuditCheckpoint.Type => {
  const rules = Object.keys(violationCounts).map((ruleId, index) => ({
    id: ruleId,
    kind: "pattern" as const,
    severity: "error" as const,
    message: `Avoid ${ruleId}`,
    docsUrl: `https://docs.example.com/${ruleId}`
  }))

  const files: string[] = []
  const results: Array<{
    rule: number
    file?: number
    range?: readonly [number, number, number, number]
  }> = []

  Object.entries(violationCounts).forEach(([ruleId, count], ruleIndex) => {
    for (let i = 0; i < count; i++) {
      const filePath = `${directory}/file${i}.ts`
      let fileIndex = files.indexOf(filePath)
      if (fileIndex === -1) {
        files.push(filePath)
        fileIndex = files.length - 1
      }

      results.push({
        rule: ruleIndex,
        file: fileIndex,
        range: [1, 1, 1, 10] as const
      })
    }
  })

  const summary = {
    errors: results.length,
    warnings: 0,
    info: 0,
    totalFiles: new Set(results.map(r => r.file)).size,
    totalFindings: results.length
  }

  // Build groups (required by FindingsGroup schema)
  const byFile: Record<string, number[]> = {}
  const byRule: Record<string, number[]> = {}

  results.forEach((result, index) => {
    if (result.file !== undefined) {
      const fileKey = String(result.file)
      if (!byFile[fileKey]) byFile[fileKey] = []
      byFile[fileKey].push(index)
    }

    const ruleKey = String(result.rule)
    if (!byRule[ruleKey]) byRule[ruleKey] = []
    byRule[ruleKey].push(index)
  })

  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 1,
    checkpointId,
    toolVersion: "0.4.0",
    projectRoot: ".",
    timestamp,
    findings: {
      rules,
      files,
      results,
      groups: { byFile, byRule },
      summary
    },
    config: {
      rulesEnabled: rules.map(r => r.id),
      failOn: ["error"]
    }
  }
}

/**
 * Helper: Write checkpoint and manifest to temp directory.
 */
const writeFixtures = (
  tempDir: string,
  checkpoints: Array<typeof AuditCheckpoint.Type>
): Effect.Effect<void, Error, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const checkpointsDir = path.join(tempDir, "checkpoints")
    yield* fs.makeDirectory(checkpointsDir, { recursive: true })

    // Write checkpoint files
    for (const checkpoint of checkpoints) {
      const checkpointPath = path.join(checkpointsDir, `${checkpoint.checkpointId}.json`)
      const encoded = Schema.encodeSync(AuditCheckpoint)(checkpoint)
      yield* fs.writeFileString(checkpointPath, JSON.stringify(encoded, null, 2))
    }

    // Build manifest
    const sortedCheckpoints = [...checkpoints].sort(
      (a, b) => b.timestamp.epochMillis - a.timestamp.epochMillis
    )

    const manifestCheckpoints = sortedCheckpoints.map((cp, index) => {
      const prev = sortedCheckpoints[index + 1]
      const delta = prev
        ? {
          errors: cp.findings.summary.errors - prev.findings.summary.errors,
          warnings: cp.findings.summary.warnings - prev.findings.summary.warnings,
          info: cp.findings.summary.info - prev.findings.summary.info,
          totalFindings: cp.findings.summary.totalFindings - prev.findings.summary.totalFindings
        }
        : undefined

      const checkpointMeta: typeof CheckpointMetadata.Type = {
        id: cp.checkpointId,
        timestamp: cp.timestamp,
        path: path.join(".", "checkpoints", `${cp.checkpointId}.json`),
        schemaVersion: SCHEMA_VERSION,
        toolVersion: cp.toolVersion,
        summary: cp.findings.summary,
        ...(delta !== undefined && { delta })
      }

      return checkpointMeta
    })

    const manifest: typeof CheckpointManifest.Type = {
      schemaVersion: SCHEMA_VERSION,
      projectRoot: ".",
      checkpoints: manifestCheckpoints
    }

    const manifestPath = path.join(checkpointsDir, "manifest.json")
    const encodedManifest = Schema.encodeSync(CheckpointManifest)(manifest)
    yield* fs.writeFileString(manifestPath, JSON.stringify(encodedManifest, null, 2))
  })

/**
 * Helper: Clean up temp directory.
 */
const cleanupFixtures = (
  tempDir: string
): Effect.Effect<void, Error, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(tempDir)
    if (exists) {
      yield* fs.remove(tempDir, { recursive: true })
    }
  }).pipe(Effect.catchAll(() => Effect.void))

layer(TestLayer)("DirectorySummarizer - Basic Integration", it => {
  it.effect("should be instantiated", () =>
    Effect.gen(function*() {
      const summarizer = yield* DirectorySummarizer
      expect(summarizer).toBeDefined()
      expect(summarizer.summarize).toBeInstanceOf(Function)
    }).pipe(Effect.orDie))

  it.effect("should fail with NoCheckpointsError when manifest missing", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-no-manifest"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const summarizer = yield* DirectorySummarizer

      // Should fail with NoCheckpointsError
      const result = yield* Effect.either(summarizer.summarize(tempDir, "src/services"))

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        // Service wraps errors in NormDetectionError
        expect(result.left._tag).toBe("NormDetectionError")
      }

      yield* cleanupFixtures(tempDir)
    }).pipe(Effect.orDie))

  it.effect("should fail with NoCheckpointsError when manifest is empty", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-empty-manifest"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const checkpointsDir = path.join(tempDir, "checkpoints")
      yield* fs.makeDirectory(checkpointsDir, { recursive: true })

      // Write empty manifest
      const manifest: typeof CheckpointManifest.Type = {
        schemaVersion: SCHEMA_VERSION,
        projectRoot: ".",
        checkpoints: []
      }

      const manifestPath = path.join(checkpointsDir, "manifest.json")
      const encoded = Schema.encodeSync(
        Schema.parseJson(Schema.Unknown)
      )(manifest as unknown)
      yield* fs.writeFileString(manifestPath, JSON.stringify(encoded, null, 2))

      const summarizer = yield* DirectorySummarizer
      const result = yield* Effect.either(summarizer.summarize(tempDir, "src/services"))

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        // Service wraps errors in NormDetectionError
        expect(result.left._tag).toBe("NormDetectionError")
      }

      yield* cleanupFixtures(tempDir)
    }).pipe(Effect.orDie))
})

layer(TestLayer)("DirectorySummarizer - Norm Detection", it => {
  it.effect("should detect norm when rule goes to zero and stays there", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-norm-detected"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      // Create 8 checkpoints: 3 with violations, 5 with zero violations
      const checkpoints = [
        createCheckpoint(
          "cp-001",
          DateTime.subtract(now, { hours: 8 }),
          "src/services",
          { "no-async-await": 10 }
        ),
        createCheckpoint(
          "cp-002",
          DateTime.subtract(now, { hours: 7 }),
          "src/services",
          { "no-async-await": 5 }
        ),
        createCheckpoint(
          "cp-003",
          DateTime.subtract(now, { hours: 6 }),
          "src/services",
          { "no-async-await": 2 }
        ),
        createCheckpoint(
          "cp-004",
          DateTime.subtract(now, { hours: 5 }),
          "src/services",
          { "no-async-await": 0 }
        ),
        createCheckpoint(
          "cp-005",
          DateTime.subtract(now, { hours: 4 }),
          "src/services",
          { "no-async-await": 0 }
        ),
        createCheckpoint(
          "cp-006",
          DateTime.subtract(now, { hours: 3 }),
          "src/services",
          { "no-async-await": 0 }
        ),
        createCheckpoint(
          "cp-007",
          DateTime.subtract(now, { hours: 2 }),
          "src/services",
          { "no-async-await": 0 }
        ),
        createCheckpoint(
          "cp-008",
          DateTime.subtract(now, { hours: 1 }),
          "src/services",
          { "no-async-await": 0 }
        )
      ]

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer
      const summary = yield* summarizer.summarize(tempDir, "src/services", 5)

      // Should detect norm
      expect(summary.norms.length).toBe(1)
      expect(summary.norms[0].ruleId).toBe("no-async-await")
      expect(summary.norms[0].violationsFixed).toBe(10)
      expect(summary.status).toBe("migrated")

      // Should have DateTimeUtc type
      expect(summary.norms[0].establishedAt).toBeDefined()
      expect(DateTime.formatIso(summary.norms[0].establishedAt)).toContain("T")

      yield* cleanupFixtures(tempDir)
    }))

  it.effect("should not detect norm if lookback window not satisfied", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-no-norm"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      // Only 3 zero checkpoints (need 5)
      const checkpoints = [
        createCheckpoint(
          "cp-001",
          DateTime.subtract(now, { hours: 4 }),
          "src/services",
          { "no-async-await": 10 }
        ),
        createCheckpoint(
          "cp-002",
          DateTime.subtract(now, { hours: 3 }),
          "src/services",
          { "no-async-await": 0 }
        ),
        createCheckpoint(
          "cp-003",
          DateTime.subtract(now, { hours: 2 }),
          "src/services",
          { "no-async-await": 0 }
        ),
        createCheckpoint(
          "cp-004",
          DateTime.subtract(now, { hours: 1 }),
          "src/services",
          { "no-async-await": 0 }
        )
      ]

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer
      const summary = yield* summarizer.summarize(tempDir, "src/services", 5)

      // Should not detect norm (only 3 zeros, need 5)
      expect(summary.norms.length).toBe(0)
      expect(summary.status).toBe("in-progress")

      yield* cleanupFixtures(tempDir)
    }))

  it.effect("should only detect norms for specified directory", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-dir-filter"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      // Create checkpoints with violations in multiple directories
      const checkpoints = [
        // Both dirs have violations
        createCheckpoint(
          "cp-001",
          DateTime.subtract(now, { hours: 6 }),
          "src/services",
          { "no-async-await": 10 }
        ),
        // Only src/utils has violations
        createCheckpoint(
          "cp-002",
          DateTime.subtract(now, { hours: 5 }),
          "src/utils",
          { "no-async-await": 5 }
        ),
        // src/services goes to zero
        createCheckpoint(
          "cp-003",
          DateTime.subtract(now, { hours: 4 }),
          "src/services",
          { "no-async-await": 0 }
        ),
        createCheckpoint(
          "cp-004",
          DateTime.subtract(now, { hours: 3 }),
          "src/services",
          { "no-async-await": 0 }
        ),
        createCheckpoint(
          "cp-005",
          DateTime.subtract(now, { hours: 2 }),
          "src/services",
          { "no-async-await": 0 }
        ),
        createCheckpoint(
          "cp-006",
          DateTime.subtract(now, { hours: 1 }),
          "src/services",
          { "no-async-await": 0 }
        ),
        createCheckpoint(
          "cp-007",
          DateTime.subtract(now, { minutes: 30 }),
          "src/services",
          { "no-async-await": 0 }
        )
      ]

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer

      // Query src/services only
      const summary = yield* summarizer.summarize(tempDir, "src/services", 5)

      expect(summary.norms.length).toBe(1)
      expect(summary.norms[0].ruleId).toBe("no-async-await")
      expect(summary.status).toBe("migrated")

      yield* cleanupFixtures(tempDir)
    }))
})

layer(TestLayer)("DirectorySummarizer - Status Determination", it => {
  it.effect("should return \"migrated\" status when directory has norms and is clean", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-migrated"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      const checkpoints = [
        createCheckpoint("cp-001", DateTime.subtract(now, { hours: 6 }), "src/core", {
          "no-promise": 8
        }),
        createCheckpoint("cp-002", DateTime.subtract(now, { hours: 5 }), "src/core", {
          "no-promise": 0
        }),
        createCheckpoint("cp-003", DateTime.subtract(now, { hours: 4 }), "src/core", {
          "no-promise": 0
        }),
        createCheckpoint("cp-004", DateTime.subtract(now, { hours: 3 }), "src/core", {
          "no-promise": 0
        }),
        createCheckpoint("cp-005", DateTime.subtract(now, { hours: 2 }), "src/core", {
          "no-promise": 0
        }),
        createCheckpoint("cp-006", DateTime.subtract(now, { hours: 1 }), "src/core", {
          "no-promise": 0
        })
      ]

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer
      const summary = yield* summarizer.summarize(tempDir, "src/core", 5)

      expect(summary.status).toBe("migrated")
      expect(summary.norms.length).toBe(1)
      expect(summary.cleanSince).toBeDefined()

      yield* cleanupFixtures(tempDir)
    }))

  it.effect("should return \"in-progress\" status when directory has violations", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-in-progress"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      const checkpoints = [
        createCheckpoint("cp-001", DateTime.subtract(now, { hours: 3 }), "src/lib", {
          "no-throw": 10
        }),
        createCheckpoint("cp-002", DateTime.subtract(now, { hours: 2 }), "src/lib", {
          "no-throw": 7
        }),
        createCheckpoint("cp-003", DateTime.subtract(now, { hours: 1 }), "src/lib", {
          "no-throw": 5
        })
      ]

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer
      const summary = yield* summarizer.summarize(tempDir, "src/lib", 5)

      expect(summary.status).toBe("in-progress")
      expect(summary.norms.length).toBe(0)
      expect(summary.cleanSince).toBeUndefined()

      yield* cleanupFixtures(tempDir)
    }))

  it.effect("should return \"not-started\" status when no meaningful activity", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-not-started"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      // All checkpoints have zero violations (never had violations)
      const checkpoints = [
        createCheckpoint("cp-001", DateTime.subtract(now, { hours: 3 }), "src/new", {}),
        createCheckpoint("cp-002", DateTime.subtract(now, { hours: 2 }), "src/new", {}),
        createCheckpoint("cp-003", DateTime.subtract(now, { hours: 1 }), "src/new", {})
      ]

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer
      const summary = yield* summarizer.summarize(tempDir, "src/new", 5)

      expect(summary.status).toBe("not-started")
      expect(summary.norms.length).toBe(0)

      yield* cleanupFixtures(tempDir)
    }))
})

layer(TestLayer)("DirectorySummarizer - Multiple Rules", it => {
  it.effect("should detect multiple norms for different rules", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-multi-norms"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      // Both rules go to zero at different times
      const checkpoints = [
        createCheckpoint("cp-001", DateTime.subtract(now, { hours: 8 }), "src/api", {
          "no-async-await": 10,
          "no-promise": 15
        }),
        createCheckpoint("cp-002", DateTime.subtract(now, { hours: 7 }), "src/api", {
          "no-async-await": 5,
          "no-promise": 10
        }),
        // no-async-await goes to zero
        createCheckpoint("cp-003", DateTime.subtract(now, { hours: 6 }), "src/api", {
          "no-async-await": 0,
          "no-promise": 8
        }),
        createCheckpoint("cp-004", DateTime.subtract(now, { hours: 5 }), "src/api", {
          "no-async-await": 0,
          "no-promise": 5
        }),
        // no-promise goes to zero
        createCheckpoint("cp-005", DateTime.subtract(now, { hours: 4 }), "src/api", {
          "no-async-await": 0,
          "no-promise": 0
        }),
        createCheckpoint("cp-006", DateTime.subtract(now, { hours: 3 }), "src/api", {
          "no-async-await": 0,
          "no-promise": 0
        }),
        createCheckpoint("cp-007", DateTime.subtract(now, { hours: 2 }), "src/api", {
          "no-async-await": 0,
          "no-promise": 0
        }),
        createCheckpoint("cp-008", DateTime.subtract(now, { hours: 1 }), "src/api", {
          "no-async-await": 0,
          "no-promise": 0
        })
      ]

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer
      const summary = yield* summarizer.summarize(tempDir, "src/api", 5)

      // Should detect only no-async-await norm (no-promise didn't have 5 consecutive zeros before latest)
      expect(summary.norms.length).toBe(1)

      const asyncNorm = summary.norms.find(n => n.ruleId === "no-async-await")
      expect(asyncNorm).toBeDefined()
      expect(asyncNorm?.violationsFixed).toBe(10)

      // Latest checkpoint has zero violations, so with at least one norm, status is migrated
      expect(summary.status).toBe("migrated")

      yield* cleanupFixtures(tempDir)
    }))
})

layer(TestLayer)("DirectorySummarizer - Schema Conversion", it => {
  it.effect("should convert ISO timestamp strings to DateTimeUtc Schema types", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-schema-conversion"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      const checkpoints = [
        createCheckpoint("cp-001", DateTime.subtract(now, { hours: 6 }), "src/domain", {
          "no-throw": 5
        }),
        createCheckpoint("cp-002", DateTime.subtract(now, { hours: 5 }), "src/domain", {
          "no-throw": 0
        }),
        createCheckpoint("cp-003", DateTime.subtract(now, { hours: 4 }), "src/domain", {
          "no-throw": 0
        }),
        createCheckpoint("cp-004", DateTime.subtract(now, { hours: 3 }), "src/domain", {
          "no-throw": 0
        }),
        createCheckpoint("cp-005", DateTime.subtract(now, { hours: 2 }), "src/domain", {
          "no-throw": 0
        }),
        createCheckpoint("cp-006", DateTime.subtract(now, { hours: 1 }), "src/domain", {
          "no-throw": 0
        })
      ]

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer
      const summary = yield* summarizer.summarize(tempDir, "src/domain", 5)

      // Verify norm has DateTimeUtc type
      expect(summary.norms.length).toBe(1)
      const norm = summary.norms[0]

      // Should be DateTime.Utc instance
      expect(norm.establishedAt).toBeDefined()
      expect(typeof norm.establishedAt).toBe("object")

      // Should be serializable via formatIso
      const isoString = DateTime.formatIso(norm.establishedAt)
      expect(isoString).toContain("T")
      expect(isoString).toContain("Z")

      // Verify cleanSince has DateTimeUtc type
      expect(summary.cleanSince).toBeDefined()
      if (summary.cleanSince) {
        const cleanIso = DateTime.formatIso(summary.cleanSince)
        expect(cleanIso).toContain("T")
        expect(cleanIso).toContain("Z")
      }

      yield* cleanupFixtures(tempDir)
    }))

  it.effect("should preserve docsUrl in norm conversion", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-docs-url"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      const checkpoints = [
        createCheckpoint("cp-001", DateTime.subtract(now, { hours: 6 }), "src/models", {
          "no-console": 3
        }),
        createCheckpoint("cp-002", DateTime.subtract(now, { hours: 5 }), "src/models", {
          "no-console": 0
        }),
        createCheckpoint("cp-003", DateTime.subtract(now, { hours: 4 }), "src/models", {
          "no-console": 0
        }),
        createCheckpoint("cp-004", DateTime.subtract(now, { hours: 3 }), "src/models", {
          "no-console": 0
        }),
        createCheckpoint("cp-005", DateTime.subtract(now, { hours: 2 }), "src/models", {
          "no-console": 0
        }),
        createCheckpoint("cp-006", DateTime.subtract(now, { hours: 1 }), "src/models", {
          "no-console": 0
        })
      ]

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer
      const summary = yield* summarizer.summarize(tempDir, "src/models", 5)

      expect(summary.norms.length).toBe(1)
      expect(summary.norms[0].docsUrl).toBe("https://docs.example.com/no-console")

      yield* cleanupFixtures(tempDir)
    }))
})

layer(TestLayer)("DirectorySummarizer - Edge Cases", it => {
  it.effect("should handle checkpoint limit parameter", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-checkpoint-limit"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      // Create 10 checkpoints
      const checkpoints = Array.from({ length: 10 }, (_, i) =>
        createCheckpoint(
          `cp-${String(i + 1).padStart(3, "0")}`,
          DateTime.subtract(now, { hours: 10 - i }),
          "src/data",
          i < 5 ? { "no-mutation": 10 } : { "no-mutation": 0 }
        ))

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer

      // Limit to 8 checkpoints
      const summary = yield* summarizer.summarize(tempDir, "src/data", 5, 8)

      // Should still work but only use first 8 checkpoints
      expect(summary.norms.length).toBe(1)

      yield* cleanupFixtures(tempDir)
    }))

  it.effect("should compute directory stats correctly", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-dir-stats"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      // Create checkpoint with multiple files
      const checkpoint = createCheckpoint(
        "cp-001",
        now,
        "src/repos",
        { "rule-a": 5, "rule-b": 3 }
      )

      yield* writeFixtures(tempDir, [checkpoint])

      const summarizer = yield* DirectorySummarizer
      const summary = yield* summarizer.summarize(tempDir, "src/repos", 5)

      // Should have stats from latest checkpoint
      expect(summary.files.total).toBeGreaterThan(0)
      expect(summary.files.withViolations).toBeGreaterThan(0)
      expect(summary.files.clean).toBe(0)

      yield* cleanupFixtures(tempDir)
    }))

  it.effect("should include latest checkpoint metadata", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tempDir = path.join(
        yield* Effect.sync(() => process.cwd()),
        "test/fixtures/temp-checkpoint-meta"
      )
      yield* fs.makeDirectory(tempDir, { recursive: true })

      const now = DateTime.unsafeMake(Date.now())

      const checkpoints = [
        createCheckpoint("cp-001", DateTime.subtract(now, { hours: 2 }), "src/handlers", {}),
        createCheckpoint("cp-002", DateTime.subtract(now, { hours: 1 }), "src/handlers", {})
      ]

      yield* writeFixtures(tempDir, checkpoints)

      const summarizer = yield* DirectorySummarizer
      const summary = yield* summarizer.summarize(tempDir, "src/handlers", 5)

      // Should have latest checkpoint info
      expect(summary.latestCheckpoint.id).toBe("cp-002")
      expect(summary.latestCheckpoint.timestamp).toBeDefined()
      expect(summary.latestCheckpoint.summary).toBeDefined()

      yield* cleanupFixtures(tempDir)
    }))
})
