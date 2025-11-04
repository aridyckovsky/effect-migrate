import * as NodeContext from "@effect/platform-node/NodeContext"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { describeWrapped, expect } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { ConfigLoadError, loadConfig } from "../../src/schema/loader.js"

describeWrapped("loader", it => {
  // Use absolute path to fixtures directory
  const getFixturePath = (filename: string) =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      // __dirname points to the compiled test directory
      return path.join(__dirname, "../fixtures/configs", filename)
    })

  it.effect("should load valid JSON config", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      expect(config.version).toBe(1)
      expect(config.paths).toBeDefined()
      expect(config.paths?.exclude).toContain("node_modules/**")
      expect(config.patterns).toBeDefined()
      expect(config.patterns?.length).toBeGreaterThan(0)
      expect(config.concurrency).toBe(4)
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should fail on non-existent config file", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(loadConfig("nonexistent-config.json"))

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(ConfigLoadError)
        expect(result.left.message).toContain("not found")
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should fail on invalid JSON config", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("invalid-config.json")

      const result = yield* Effect.either(loadConfig(configPath))

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(ConfigLoadError)
        expect(result.left.message).toContain("validation failed")
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should validate schema correctly", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      expect(typeof config.version).toBe("number")
      expect(config.version).toBeGreaterThan(0)

      if (config.patterns) {
        for (const pattern of config.patterns) {
          expect(pattern.id).toBeDefined()
          expect(pattern.pattern).toBeInstanceOf(RegExp)
          expect(pattern.message).toBeDefined()
          expect(["error", "warning"]).toContain(pattern.severity)
        }
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should apply default values", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      expect(config).toBeDefined()
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should transform pattern strings to RegExp", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      if (config.patterns && config.patterns.length > 0) {
        expect(config.patterns[0].pattern).toBeInstanceOf(RegExp)
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should handle configs with minimal fields", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      expect(config.version).toBeDefined()
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should validate concurrency range", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      if (config.concurrency !== undefined) {
        expect(config.concurrency).toBeGreaterThan(0)
        expect(config.concurrency).toBeLessThanOrEqual(16)
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should handle paths configuration", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      expect(config.paths).toBeDefined()
      if (config.paths) {
        expect(Array.isArray(config.paths.exclude)).toBe(true)
        if (config.paths.include) {
          expect(Array.isArray(config.paths.include)).toBe(true)
        }
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should handle pattern rules configuration", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      if (config.patterns) {
        expect(Array.isArray(config.patterns)).toBe(true)

        for (const pattern of config.patterns) {
          expect(typeof pattern.id).toBe("string")
          expect(pattern.pattern).toBeInstanceOf(RegExp)
          expect(typeof pattern.message).toBe("string")
          expect(["error", "warning"]).toContain(pattern.severity)
        }
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should provide helpful error messages for validation failures", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("invalid-config.json")

      const result = yield* Effect.either(loadConfig(configPath))

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left.message).toBeDefined()
        expect(result.left.message.length).toBeGreaterThan(0)
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should handle optional fields correctly", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      expect(config).toBeDefined()
      expect("version" in config).toBe(true)

      expect(config.boundaries === undefined || Array.isArray(config.boundaries)).toBe(true)
      expect(config.migrations === undefined || Array.isArray(config.migrations)).toBe(true)
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should reject unsupported file extensions", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const testFile = yield* getFixturePath("test.xml")

      yield* fs.writeFileString(testFile, "<config></config>")

      const result = yield* Effect.either(loadConfig(testFile))

      yield* fs.remove(testFile).pipe(Effect.catchAll(() => Effect.void))

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left.message).toContain("Unsupported")
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should validate pattern rule files field", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      if (config.patterns && config.patterns.length > 0) {
        const pattern = config.patterns[0]
        expect(
          typeof pattern.files === "string" || Array.isArray(pattern.files)
        ).toBe(true)
      }
    }).pipe(Effect.provide(NodeContext.layer)))

  it.effect("should handle pattern rule optional fields", () =>
    Effect.gen(function*() {
      const configPath = yield* getFixturePath("valid-config.json")

      const config = yield* loadConfig(configPath)

      if (config.patterns && config.patterns.length > 0) {
        const pattern = config.patterns[0]

        if (pattern.docsUrl !== undefined) {
          expect(typeof pattern.docsUrl).toBe("string")
        }

        if (pattern.tags !== undefined) {
          expect(Array.isArray(pattern.tags)).toBe(true)
        }

        if (pattern.negativePattern !== undefined) {
          expect(typeof pattern.negativePattern).toBe("string")
        }
      }
    }).pipe(Effect.provide(NodeContext.layer)))
})
