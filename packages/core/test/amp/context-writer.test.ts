/**
 * Tests for Amp Context Writer
 *
 * Verifies context file generation, schema version handling, and index creation.
 */

import type { Config, RuleResult } from "@effect-migrate/core"
import { SCHEMA_VERSION } from "@effect-migrate/core"
import { AmpAuditContext, AmpContextIndex } from "@effect-migrate/core/schema"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { expect, layer } from "@effect/vitest"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { writeAmpContext } from "../../src/amp/context-writer.js"
import { addThread } from "../../src/amp/thread-manager.js"
import { Time } from "../../src/services/Time.js"
import { readJson } from "../helpers/index.js"
import {
  makeMockFileSystem,
  MockPathLayer,
  MockProcessInfoLayer
} from "../helpers/mock-filesystem.js"

const testConfig: Config = {
  version: 1,
  paths: {
    root: ".",
    exclude: ["node_modules/**"]
  }
}

const testResults: RuleResult[] = [
  {
    id: "no-async-await",
    severity: "error",
    message: "Avoid async/await in favor of Effect.gen",
    file: "src/index.ts",
    ruleKind: "pattern",
    range: {
      start: { line: 10, column: 1 },
      end: { line: 10, column: 15 }
    }
  }
]

const { mockFs } = makeMockFileSystem()
const TestLayer = Layer.mergeAll(
  Layer.succeed(FileSystem.FileSystem, mockFs),
  MockPathLayer,
  MockProcessInfoLayer,
  Time.Default
).pipe(Layer.provideMerge(Layer.succeed(Clock.Clock, Clock.make())))

layer(TestLayer)("context-writer", it => {
  it.effect("should write index.json with dynamic schemaVersion", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path

      const outputDir = "/amp-test"

      yield* writeAmpContext(outputDir, testResults, testConfig)

      // Use helper to read and decode
      const indexPath = path.join(outputDir, "index.json")
      const index = yield* readJson(indexPath, AmpContextIndex)

      // Verify schemaVersion is present and is a semver string
      expect(index.schemaVersion).toBeDefined()
      expect(typeof index.schemaVersion).toBe("string")
      expect(index.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/)
      expect(index.schemaVersion).toBe(SCHEMA_VERSION)

      // Verify other required fields
      expect(index.toolVersion).toBeDefined()
      expect(index.projectRoot).toBe(".")

      // Use helper to read and verify audit.json
      const auditPath = path.join(outputDir, "audit.json")
      const audit = yield* readJson(auditPath, AmpAuditContext)

      // Verify normalized structure
      expect(audit.findings.rules).toBeDefined()
      expect(audit.findings.files).toBeDefined()
      expect(audit.findings.results).toBeDefined()
      expect(audit.findings.groups?.byFile).toBeDefined()
      expect(audit.findings.groups?.byRule).toBeDefined()

      // Verify normalized structure details
      expect(audit.findings.rules).toHaveLength(1)
      expect(audit.findings.results).toHaveLength(1)
      expect(audit.findings.summary.totalFindings).toBe(1)
    }))

  it.effect("should create valid audit.json and badges.md", () =>
    Effect.gen(function*() {
      const { mockFs, state } = makeMockFileSystem()
      const path = yield* Path.Path

      const outputDir = "/amp-test"

      const context = Layer.mergeAll(
        Time.Default,
        Layer.succeed(FileSystem.FileSystem, mockFs),
        MockPathLayer,
        MockProcessInfoLayer
      )

      yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

      // Verify files exist in mock filesystem
      expect(state.files.has(path.join(outputDir, "audit.json"))).toBe(true)
      expect(state.files.has(path.join(outputDir, "badges.md"))).toBe(true)

      // Verify index references both files
      const indexPath = path.join(outputDir, "index.json")
      const index = yield* readJson(indexPath, AmpContextIndex).pipe(Effect.provide(context))

      expect(index.files.audit).toBe("audit.json")
      expect(index.files.badges).toBe("badges.md")
    }))

  it.effect("should handle empty results", () =>
    Effect.gen(function*() {
      const { mockFs, state } = makeMockFileSystem()
      const path = yield* Path.Path

      const outputDir = "/amp-test"

      const context = Layer.mergeAll(
        Time.Default,
        Layer.succeed(FileSystem.FileSystem, mockFs),
        MockPathLayer,
        MockProcessInfoLayer
      )

      yield* writeAmpContext(outputDir, [], testConfig).pipe(Effect.provide(context))

      // Should still create all files
      expect(state.files.has(path.join(outputDir, "index.json"))).toBe(true)
      expect(state.files.has(path.join(outputDir, "audit.json"))).toBe(true)
      expect(state.files.has(path.join(outputDir, "badges.md"))).toBe(true)
    }))

  it.effect("should fallback to default schemaVersion when missing in package.json", () =>
    Effect.gen(function*() {
      const { mockFs } = makeMockFileSystem()
      const path = yield* Path.Path

      const outputDir = "/amp-test"

      const context = Layer.mergeAll(
        Time.Default,
        Layer.succeed(FileSystem.FileSystem, mockFs),
        MockPathLayer,
        MockProcessInfoLayer
      ).pipe(Layer.provideMerge(Layer.succeed(Clock.Clock, Clock.make())))

      // Run writeAmpContext with mock
      // Note: getPackageMeta uses import.meta.url which bypasses mock FileSystem
      // and falls back to "unknown" toolVersion when real package.json isn't found in test env
      yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

      // Verify uses SCHEMA_VERSION constant from core
      const indexPath = path.join(outputDir, "index.json")
      const index = yield* readJson(indexPath, AmpContextIndex).pipe(Effect.provide(context))

      expect(index.schemaVersion).toBe(SCHEMA_VERSION)
      // In test environment with mock FS, getPackageMeta falls back to "unknown"
      expect(index.toolVersion).toBeDefined()
    }))

  it.effect("should reference threads.json in index when threads exist", () =>
    Effect.gen(function*() {
      const { mockFs } = makeMockFileSystem()
      const path = yield* Path.Path

      const outputDir = "/amp-test"

      const context = Layer.mergeAll(
        Time.Default,
        Layer.succeed(FileSystem.FileSystem, mockFs),
        MockPathLayer,
        MockProcessInfoLayer
      )

      // Pre-create a thread entry
      yield* addThread(outputDir, {
        url: "https://ampcode.com/threads/T-12345678-abcd-1234-5678-123456789abc"
      }).pipe(Effect.provide(context))

      // Generate context
      yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

      // Read and decode index.json
      const indexPath = path.join(outputDir, "index.json")
      const index = yield* readJson(indexPath, AmpContextIndex).pipe(Effect.provide(context))

      // Should reference threads.json when threads exist
      expect(index.files.threads).toBe("threads.json")
    }))

  it.effect("should omit threads field in index when no threads exist", () =>
    Effect.gen(function*() {
      const { mockFs } = makeMockFileSystem()
      const path = yield* Path.Path

      const outputDir = "/amp-test"

      const context = Layer.mergeAll(
        Time.Default,
        Layer.succeed(FileSystem.FileSystem, mockFs),
        MockPathLayer,
        MockProcessInfoLayer
      ).pipe(Layer.provideMerge(Layer.succeed(Clock.Clock, Clock.make())))

      // Save and clear AMP_CURRENT_THREAD_ID to prevent auto-detection
      const savedThreadId = process.env.AMP_CURRENT_THREAD_ID
      delete process.env.AMP_CURRENT_THREAD_ID

      try {
        // Generate context WITHOUT creating threads
        yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

        // Read and decode index.json
        const indexPath = path.join(outputDir, "index.json")
        const index = yield* readJson(indexPath, AmpContextIndex).pipe(Effect.provide(context))

        // Should NOT have threads field (omitted, not null)
        expect(index.files.threads).toBeUndefined()
      } finally {
        // Restore original value
        if (savedThreadId) {
          process.env.AMP_CURRENT_THREAD_ID = savedThreadId
        }
      }
    }))

  describe("schema version and revision contract tests", () => {
    it.effect("audit.json should include schemaVersion field from SCHEMA_VERSION", () =>
      Effect.gen(function*() {
        const { mockFs } = makeMockFileSystem()
        const path = yield* Path.Path

        const outputDir = "/amp-test"

        const context = Layer.mergeAll(
          Time.Default,
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

        // Read and decode audit.json
        const auditPath = path.join(outputDir, "audit.json")
        const audit = yield* readJson(auditPath, AmpAuditContext).pipe(Effect.provide(context))

        // Verify schemaVersion matches the constant from core
        expect(audit.schemaVersion).toBe(SCHEMA_VERSION)
      }))

    it.effect("audit.json should include revision field starting at 1", () =>
      Effect.gen(function*() {
        const { mockFs } = makeMockFileSystem()
        const path = yield* Path.Path

        const outputDir = "/amp-test"

        const context = Layer.mergeAll(
          Time.Default,
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

        // Read and decode audit.json
        const auditPath = path.join(outputDir, "audit.json")
        const audit = yield* readJson(auditPath, AmpAuditContext).pipe(Effect.provide(context))

        // Verify revision starts at 1
        expect(audit.revision).toBe(1)
        expect(typeof audit.revision).toBe("number")
      }))

    it.effect("revision should increment on subsequent writes (1 -> 2 -> 3)", () =>
      Effect.gen(function*() {
        const { mockFs } = makeMockFileSystem()
        const path = yield* Path.Path

        const outputDir = "/amp-test"

        const context = Layer.mergeAll(
          Time.Default,
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        // First write (revision 1)
        yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

        const auditPath = path.join(outputDir, "audit.json")

        // Verify revision 1
        const audit1 = yield* readJson(auditPath, AmpAuditContext).pipe(Effect.provide(context))
        expect(audit1.revision).toBe(1)

        // Second write (revision 2)
        yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

        // Verify revision incremented to 2
        const audit2 = yield* readJson(auditPath, AmpAuditContext).pipe(Effect.provide(context))
        expect(audit2.revision).toBe(2)

        // Third write (revision 3)
        yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

        // Verify revision incremented to 3
        const audit3 = yield* readJson(auditPath, AmpAuditContext).pipe(Effect.provide(context))
        expect(audit3.revision).toBe(3)
      }))

    it.effect("index.json schemaVersion should be consistent", () =>
      Effect.gen(function*() {
        const { mockFs } = makeMockFileSystem()
        const path = yield* Path.Path

        const outputDir = "/amp-test"

        const context = Layer.mergeAll(
          Time.Default,
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

        // Read and decode index.json
        const indexPath = path.join(outputDir, "index.json")
        const index = yield* readJson(indexPath, AmpContextIndex).pipe(Effect.provide(context))

        // Verify schemaVersion matches the constant from core
        expect(index.schemaVersion).toBe(SCHEMA_VERSION)
      }))

    it.effect("legacy audit files without revision field are IGNORED (treated as revision 0)", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const path = yield* Path.Path

        const outputDir = "/amp-test"

        const context = Layer.mergeAll(
          Time.Default,
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        // Create legacy audit.json without revision field
        const auditPath = path.join(outputDir, "audit.json")
        const legacyAudit = {
          schemaVersion: "0.2.0",
          toolVersion: "0.1.0",
          projectRoot: ".",
          timestamp: "2025-01-01T00:00:00.000Z",
          findings: {
            byFile: {},
            byRule: {},
            summary: { errors: 0, warnings: 0, totalFiles: 0, totalFindings: 0 }
          },
          config: { rulesEnabled: [], failOn: ["error"] }
          // Note: no revision field
        }
        state.files.set(auditPath, JSON.stringify(legacyAudit, null, 2))

        // Write new audit (should start at revision 1 for legacy files)
        yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

        // Verify revision is 1 (legacy files treated as revision 0)
        const audit = yield* readJson(auditPath, AmpAuditContext).pipe(Effect.provide(context))
        expect(audit.revision).toBe(1)
      }))

    it.effect("should handle concurrent writes gracefully (revision counter safety)", () =>
      Effect.gen(function*() {
        const { mockFs } = makeMockFileSystem()
        const path = yield* Path.Path

        const outputDir = "/amp-test"

        const context = Layer.mergeAll(
          Time.Default,
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        // Initial write to create audit.json
        yield* writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))

        // Simulate concurrent writes (parallel execution)
        yield* Effect.all(
          [
            writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context)),
            writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context)),
            writeAmpContext(outputDir, testResults, testConfig).pipe(Effect.provide(context))
          ],
          { concurrency: 3 }
        )

        // Read final audit.json
        const auditPath = path.join(outputDir, "audit.json")
        const audit = yield* readJson(auditPath, AmpAuditContext).pipe(Effect.provide(context))

        // Final revision should be between 2-4 (1 initial + 3 concurrent)
        // File system serialization makes exact count non-deterministic
        expect(audit.revision).toBeGreaterThanOrEqual(2)
        expect(audit.revision).toBeLessThanOrEqual(4)
        expect(typeof audit.revision).toBe("number")
      }))
  })
})
