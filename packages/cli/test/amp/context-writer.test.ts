/**
 * Tests for Amp Context Writer
 *
 * Verifies context file generation, schema version handling, and index creation.
 */

import type { Config, RuleResult } from "@effect-migrate/core"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { AmpContextIndex, writeAmpContext } from "../../src/amp/context-writer.js"

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

      // Should be "1.0.0" from package.json effectMigrate.schemaVersion
      expect(index.schemaVersion).toBe("1.0.0")

      // Verify other required fields
      expect(index.version).toBe(1)
      expect(index.toolVersion).toBeDefined()
      expect(index.projectRoot).toBe(".")
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
            p.includes("packages/cli/package.json") || p.includes("packages\\cli\\package.json")
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

      // Verify fallback to "1.0.0"
      const indexPath = path.join(outputDir, "index.json")
      const indexContent = yield* fs.readFileString(indexPath)
      const index = yield* Effect.try({
        try: () => JSON.parse(indexContent) as unknown,
        catch: e => new Error(String(e))
      }).pipe(Effect.flatMap(Schema.decodeUnknown(AmpContextIndex)))

      expect(index.schemaVersion).toBe("1.0.0")
      expect(index.toolVersion).toBe("9.9.9")
    }).pipe(Effect.provide(NodeContext.layer)))
})
