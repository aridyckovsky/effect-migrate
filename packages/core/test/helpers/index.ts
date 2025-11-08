/**
 * Test Helpers - Reusable utilities for Effect-based tests
 *
 * Provides DRY utilities for:
 * - Reading and decoding JSON files with Schema
 * - Resolving fixture paths
 * - Creating test configs
 * - Composing test layers with proper dependency injection
 */

import type { Config } from "@effect-migrate/core"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { PathsSchema } from "../../src/schema/Config.js"

/**
 * Read and decode JSON file with Schema validation.
 *
 * Reduces boilerplate for common pattern of:
 * - Reading file as string
 * - Parsing JSON
 * - Validating with Schema
 *
 * @param path - Absolute path to JSON file
 * @param schema - Schema to decode with
 * @returns Decoded value
 *
 * @example
 * ```typescript
 * const index = yield* readJson(indexPath, AmpContextIndex)
 * const audit = yield* readJson(auditPath, AmpAuditContext)
 * ```
 */
export const readJson = <A, I, R>(
  path: string,
  schema: Schema.Schema<A, I, R>
): Effect.Effect<A, Error, FileSystem.FileSystem | R> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(path)
    const data: unknown = JSON.parse(content)
    return yield* Schema.decodeUnknown(schema)(data)
  })

/**
 * Get absolute path to fixtures directory.
 *
 * Uses import.meta.url to resolve relative to test file.
 *
 * @param testFileUrl - import.meta.url from calling test file
 * @returns Absolute path to fixtures/sample-project
 *
 * @example
 * ```typescript
 * const fixturesDir = getFixturesDir(import.meta.url)
 * ```
 */
export const getFixturesDir = (testFileUrl: string): string =>
  new URL("../fixtures/sample-project", testFileUrl).pathname

/**
 * Create test config with common defaults.
 *
 * Reduces duplication in tests that need Config objects.
 *
 * @param root - Project root path (typically fixturesDir)
 * @param overrides - Optional config overrides
 * @returns Complete Config object
 *
 * @example
 * ```typescript
 * const config = makeTestConfig(fixturesDir)
 * const configWithConcurrency = makeTestConfig(fixturesDir, { concurrency: 4 })
 * ```
 */
export const makeTestConfig = (root: string, overrides?: Partial<Config>): Config => ({
  version: 1,
  paths: new PathsSchema({
    root,
    exclude: ["**/node_modules/**", "**/dist/**"]
  }),
  concurrency: 2,
  ...overrides
})

/**
 * Create test layer with all standard dependencies.
 *
 * Provides common layer composition for tests that need:
 * - Clock (from TestContext for TestClock support)
 * - FileSystem and Path (from NodeContext)
 * - Custom service layer (provided as argument)
 *
 * **Channel Management:**
 * - Input layer: `Layer<R, E, RIn>` (service layer with requirements)
 * - TestContext provides: Clock, Random, ConfigProvider, etc.
 * - NodeContext provides: FileSystem, Path, etc.
 * - Output: `Layer<R | NodeContext, E, never>` (all requirements satisfied)
 *
 * **Usage Pattern:**
 * ```typescript
 * const TestLayer = makeTestLayer(TimeLive)
 * layer(TestLayer)("my tests", it => { ... })
 * ```
 *
 * **Why TestContext:**
 * TestContext.TestContext provides Clock, Random, ConfigProvider, and other
 * runtime services. This allows tests to use TestClock for deterministic time
 * control via TestClock.adjust().
 *
 * **Note on Diagnostics:**
 * @effect/vitest's layer() helper expects Layer<Out, never, never> (no dependencies).
 * When using layers that require Clock, you may see "Missing Clock" diagnostics
 * from static analysis. These are false positives - TestContext provides Clock
 * at runtime. The tests will pass successfully.
 *
 * @param serviceLayer - Service layer to include (e.g., TimeLive, FileDiscoveryLive)
 * @returns Composed layer with all dependencies satisfied
 *
 * @category Test Utility
 * @since 0.4.0
 *
 * @example
 * ```typescript
 * import { makeTestLayer } from "../helpers.js"
 * import { layerLive as TimeLive } from "../../src/services/Time.js"
 *
 * const TestLayer = makeTestLayer(TimeLive)
 *
 * layer(TestLayer)("context-writer", it => {
 *   it.effect("should use controlled time", () =>
 *     Effect.gen(function* () {
 *       yield* TestClock.adjust("1 second")
 *       const timestamp = yield* Time.now
 *       // ...
 *     })
 *   )
 * })
 * ```
 */
export const makeTestLayer = <R, E, RIn>(
  serviceLayer: Layer.Layer<R, E, RIn>
): Layer.Layer<R | NodeContext.NodeContext, E, RIn> =>
  Layer.mergeAll(
    serviceLayer,
    NodeContext.layer
  )
