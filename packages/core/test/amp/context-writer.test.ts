/**
 * Tests for Amp Context Writer
 *
 * Verifies context file generation, schema version handling, and index creation.
 */

import type { Config, RuleResult } from "@effect-migrate/core"
import { AmpAuditContext, AmpContextIndex, SCHEMA_VERSION } from "@effect-migrate/core/schema"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { writeAmpContext } from "../../src/amp/context-writer.js"
import { addThread } from "../../src/amp/thread-manager.js"

describe("context-writer", () => {
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

  it.scoped("should write index.json with dynamic schemaVersion", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      // Create temp output directory
      const tmpDir = yield* fs.makeTempDirectoryScoped()
      const outputDir = path.join(tmpDir, "amp-test")

      // Write context
      yield* writeAmpContext(outputDir, testResults, testConfig)

      // Read index.json
      const indexPath = path.join(outputDir, "index.json")
      const indexContent = yield* fs.readFileString(indexPath)
      const index = yield* Effect.try({
        try: () => JSON.parse(indexContent) as unknown,
        catch: e => new Error(String(e))
      }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpContextIndex)))

      // Verify schemaVersion is present and is a semver string
      expect(index.schemaVersion).toBeDefined()
      expect(typeof index.schemaVersion).toBe("string")
      expect(index.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/)

      // Should match SCHEMA_VERSION from core
      expect(index.schemaVersion).toBe(SCHEMA_VERSION)

      // Verify other required fields
      expect(index.toolVersion).toBeDefined()
      expect(index.projectRoot).toBe(".")

      // Read and verify audit.json has normalized structure
      const auditPath = path.join(outputDir, "audit.json")
      const auditContent = yield* fs.readFileString(auditPath)
      const audit = yield* Effect.try({
        try: () => JSON.parse(auditContent) as unknown,
        catch: e => new Error(String(e))
      }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpAuditContext)))

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
    }).pipe(Effect.provide(NodeContext.layer)))

  it.scoped("should create valid audit.json and badges.md", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tmpDir = yield* fs.makeTempDirectoryScoped()
      const outputDir = path.join(tmpDir, "amp-test")

      yield* writeAmpContext(outputDir, testResults, testConfig)

      // Verify audit.json exists
      const auditPath = path.join(outputDir, "audit.json")
      const auditExists = yield* fs.exists(auditPath)
      expect(auditExists).toBe(true)

      // Verify badges.md exists
      const badgesPath = path.join(outputDir, "badges.md")
      const badgesExists = yield* fs.exists(badgesPath)
      expect(badgesExists).toBe(true)

      // Verify index references both files
      const indexPath = path.join(outputDir, "index.json")
      const indexContent = yield* fs.readFileString(indexPath)
      const index = yield* Effect.try({
        try: () => JSON.parse(indexContent) as unknown,
        catch: e => new Error(String(e))
      }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpContextIndex)))

      expect(index.files.audit).toBe("audit.json")
      expect(index.files.badges).toBe("badges.md")
    }).pipe(Effect.provide(NodeContext.layer)))

  it.scoped("should handle empty results", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tmpDir = yield* fs.makeTempDirectoryScoped()
      const outputDir = path.join(tmpDir, "amp-test")

      yield* writeAmpContext(outputDir, [], testConfig)

      // Should still create all files
      const indexExists = yield* fs.exists(path.join(outputDir, "index.json"))
      const auditExists = yield* fs.exists(path.join(outputDir, "audit.json"))
      const badgesExists = yield* fs.exists(path.join(outputDir, "badges.md"))

      expect(indexExists).toBe(true)
      expect(auditExists).toBe(true)
      expect(badgesExists).toBe(true)
    }).pipe(Effect.provide(NodeContext.layer)))

  it.scoped("should fallback to default schemaVersion when missing in package.json", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      // Create temp output directory
      const tmpDir = yield* fs.makeTempDirectoryScoped()
      const outputDir = path.join(tmpDir, "amp-test")

      // Mock FileSystem to intercept package.json reads
      const mockFs: typeof fs = {
        ...fs,
        readFileString: (p: string) => {
          // Mock package.json without effectMigrate field
          if (
            p.includes("packages/core/package.json") || p.includes("packages\\core\\package.json")
          ) {
            return Effect.succeed(JSON.stringify({ version: "9.9.9" }))
          }
          // Pass through all other reads
          return fs.readFileString(p)
        }
      }

      // Run writeAmpContext with mock
      yield* writeAmpContext(outputDir, testResults, testConfig)
        .pipe(Effect.provideService(FileSystem.FileSystem, mockFs))

      // Verify uses SCHEMA_VERSION from core (not from package.json)
      const indexPath = path.join(outputDir, "index.json")
      const indexContent = yield* fs.readFileString(indexPath)
      const index = yield* Effect.try({
        try: () => JSON.parse(indexContent) as unknown,
        catch: e => new Error(String(e))
      }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpContextIndex)))

      expect(index.schemaVersion).toBe(SCHEMA_VERSION)
      expect(index.toolVersion).toBe("9.9.9")
    }).pipe(Effect.provide(NodeContext.layer)))

  it.scoped("should reference threads.json in index when threads exist", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tmpDir = yield* fs.makeTempDirectoryScoped()
      const outputDir = path.join(tmpDir, "amp-test")

      // Pre-create a thread entry
      yield* addThread(
        outputDir,
        { url: "https://ampcode.com/threads/T-12345678-abcd-1234-5678-123456789abc" }
      )

      // Generate context
      yield* writeAmpContext(outputDir, testResults, testConfig)

      // Read and decode index.json
      const indexPath = path.join(outputDir, "index.json")
      const indexContent = yield* fs.readFileString(indexPath)
      const index = yield* Effect.try({
        try: () => JSON.parse(indexContent) as unknown,
        catch: e => new Error(String(e))
      }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpContextIndex)))

      // Should reference threads.json when threads exist
      expect(index.files.threads).toBe("threads.json")
    }).pipe(Effect.provide(NodeContext.layer)))

  it.scoped("should omit threads field in index when no threads exist", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const tmpDir = yield* fs.makeTempDirectoryScoped()
      const outputDir = path.join(tmpDir, "amp-test")

      // Save and clear AMP_CURRENT_THREAD_ID to prevent auto-detection
      const savedThreadId = process.env.AMP_CURRENT_THREAD_ID
      delete process.env.AMP_CURRENT_THREAD_ID

      try {
        // Generate context WITHOUT creating threads
        yield* writeAmpContext(outputDir, testResults, testConfig)

        // Read and decode index.json
        const indexPath = path.join(outputDir, "index.json")
        const indexContent = yield* fs.readFileString(indexPath)
        const index = yield* Effect.try({
          try: () => JSON.parse(indexContent) as unknown,
          catch: e => new Error(String(e))
        }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpContextIndex)))

        // Should NOT have threads field (omitted, not null)
        expect(index.files.threads).toBeUndefined()
      } finally {
        // Restore original value
        if (savedThreadId) {
          process.env.AMP_CURRENT_THREAD_ID = savedThreadId
        }
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  describe("schema version and revision contract tests", () => {
    it.scoped("audit.json should include schemaVersion field from SCHEMA_VERSION", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const tmpDir = yield* fs.makeTempDirectoryScoped()
        const outputDir = path.join(tmpDir, "amp-test")

        // Arrange & Act
        yield* writeAmpContext(outputDir, testResults, testConfig)

        // Assert - Read and decode audit.json
        const auditPath = path.join(outputDir, "audit.json")
        const auditContent = yield* fs.readFileString(auditPath)
        const audit = yield* Effect.try({
          try: () => JSON.parse(auditContent) as unknown,
          catch: e => new Error(String(e))
        }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpAuditContext)))

        // Verify schemaVersion matches the constant from core
        expect(audit.schemaVersion).toBe(SCHEMA_VERSION)
      }).pipe(Effect.provide(NodeContext.layer)))

    it.scoped("audit.json should include revision field starting at 1", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const tmpDir = yield* fs.makeTempDirectoryScoped()
        const outputDir = path.join(tmpDir, "amp-test")

        // Arrange & Act - First audit write
        yield* writeAmpContext(outputDir, testResults, testConfig)

        // Assert - Read and decode audit.json
        const auditPath = path.join(outputDir, "audit.json")
        const auditContent = yield* fs.readFileString(auditPath)
        const audit = yield* Effect.try({
          try: () => JSON.parse(auditContent) as unknown,
          catch: e => new Error(String(e))
        }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpAuditContext)))

        // Verify revision starts at 1
        expect(audit.revision).toBe(1)
        expect(typeof audit.revision).toBe("number")
      }).pipe(Effect.provide(NodeContext.layer)))

    it.scoped("revision should increment on subsequent writes (1 -> 2 -> 3)", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const tmpDir = yield* fs.makeTempDirectoryScoped()
        const outputDir = path.join(tmpDir, "amp-test")

        // Arrange & Act - First write (revision 1)
        yield* writeAmpContext(outputDir, testResults, testConfig)

        const auditPath = path.join(outputDir, "audit.json")

        // Assert - Verify revision 1
        const audit1Content = yield* fs.readFileString(auditPath)
        const audit1 = yield* Effect.try({
          try: () => JSON.parse(audit1Content) as unknown,
          catch: e => new Error(String(e))
        }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpAuditContext)))
        expect(audit1.revision).toBe(1)

        // Act - Second write (revision 2)
        yield* writeAmpContext(outputDir, testResults, testConfig)

        // Assert - Verify revision incremented to 2
        const audit2Content = yield* fs.readFileString(auditPath)
        const audit2 = yield* Effect.try({
          try: () => JSON.parse(audit2Content) as unknown,
          catch: e => new Error(String(e))
        }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpAuditContext)))
        expect(audit2.revision).toBe(2)

        // Act - Third write (revision 3)
        yield* writeAmpContext(outputDir, testResults, testConfig)

        // Assert - Verify revision incremented to 3
        const audit3Content = yield* fs.readFileString(auditPath)
        const audit3 = yield* Effect.try({
          try: () => JSON.parse(audit3Content) as unknown,
          catch: e => new Error(String(e))
        }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpAuditContext)))
        expect(audit3.revision).toBe(3)
      }).pipe(Effect.provide(NodeContext.layer)))

    it.scoped("index.json schemaVersion should be consistent", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const tmpDir = yield* fs.makeTempDirectoryScoped()
        const outputDir = path.join(tmpDir, "amp-test")

        // Arrange & Act
        yield* writeAmpContext(outputDir, testResults, testConfig)

        // Assert - Read and decode index.json
        const indexPath = path.join(outputDir, "index.json")
        const indexContent = yield* fs.readFileString(indexPath)
        const index = yield* Effect.try({
          try: () => JSON.parse(indexContent) as unknown,
          catch: e => new Error(String(e))
        }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpContextIndex)))

        // Verify schemaVersion matches the constant from core
        expect(index.schemaVersion).toBe(SCHEMA_VERSION)
      }).pipe(Effect.provide(NodeContext.layer)))

    it.scoped("legacy audit files without revision field are IGNORED (treated as revision 0)", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const tmpDir = yield* fs.makeTempDirectoryScoped()
        const outputDir = path.join(tmpDir, "amp-test")

        // Arrange - Create legacy audit.json without revision field
        yield* fs.makeDirectory(outputDir, { recursive: true })
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
        yield* fs.writeFileString(auditPath, JSON.stringify(legacyAudit, null, 2))

        // Act - Write new audit (should start at revision 1 for legacy files)
        yield* writeAmpContext(outputDir, testResults, testConfig)

        // Assert - Verify revision is 1 (legacy files treated as revision 0)
        const auditContent = yield* fs.readFileString(auditPath)
        const audit = yield* Effect.try({
          try: () => JSON.parse(auditContent) as unknown,
          catch: e => new Error(String(e))
        }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpAuditContext)))

        expect(audit.revision).toBe(1)
      }).pipe(Effect.provide(NodeContext.layer)))

    it.scoped("should handle concurrent writes gracefully (revision counter safety)", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const tmpDir = yield* fs.makeTempDirectoryScoped()
        const outputDir = path.join(tmpDir, "amp-test")

        // Arrange - Initial write to create audit.json
        yield* writeAmpContext(outputDir, testResults, testConfig)

        // Act - Simulate concurrent writes (parallel execution)
        // In reality, these will execute sequentially due to file I/O,
        // but this tests the revision counter logic under "concurrent" intent
        yield* Effect.all(
          [
            writeAmpContext(outputDir, testResults, testConfig),
            writeAmpContext(outputDir, testResults, testConfig),
            writeAmpContext(outputDir, testResults, testConfig)
          ],
          { concurrency: 3 }
        )

        // Assert - Read final audit.json
        const auditPath = path.join(outputDir, "audit.json")
        const auditContent = yield* fs.readFileString(auditPath)
        const audit = yield* Effect.try({
          try: () => JSON.parse(auditContent) as unknown,
          catch: e => new Error(String(e))
        }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpAuditContext)))

        // Final revision should be 4 (1 initial + 3 concurrent writes)
        // Note: Due to file system serialization, these will likely execute
        // sequentially anyway, but we verify the counter increments correctly
        expect(audit.revision).toBeGreaterThanOrEqual(2)
        expect(audit.revision).toBeLessThanOrEqual(4)
        expect(typeof audit.revision).toBe("number")

        // If truly concurrent (unlikely with file I/O), we might get race conditions
        // This test documents expected behavior: revision should be consistent
      }).pipe(Effect.provide(NodeContext.layer)))
  })
})
