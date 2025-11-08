/**
 * @effect-migrate/core
 *
 * Reusable migration engine for TypeScript projects with Effect-TS patterns.
 *
 * @module
 */

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * Severity level for findings and rule results.
 */
export type { Severity } from "./types.js"

/**
 * Location information for findings within a file.
 */
export type { Location } from "./types.js"

/**
 * Range information for precise code location.
 */
export type { Range } from "./types.js"

/**
 * Generic finding in the codebase.
 */
export type { Finding } from "./types.js"

/**
 * Rule violation with associated rule ID.
 */
export type { Violation } from "./types.js"

/**
 * Metric for tracking migration progress.
 */
export type { Metric } from "./types.js"

// ============================================================================
// Rule System Types
// ============================================================================

/**
 * Rule kind schema for validation.
 */
export { RuleKindSchema } from "./rules/types.js"

/**
 * Rule kind type (pattern, boundary, docs, metrics).
 */
export type { RuleKind } from "./rules/types.js"

/**
 * Context provided to rules during execution.
 * Includes file access, import index, and config.
 */
export type { RuleContext } from "./rules/types.js"

/**
 * Result of running a rule check.
 */
export type { RuleResult } from "./rules/types.js"

/**
 * Interface for implementing custom rules.
 */
export type { Rule } from "./rules/types.js"

/**
 * Collection of rules with optional default configuration.
 */
export type { Preset } from "./rules/types.js"

/**
 * Import index result interface for querying imports.
 */
export type { ImportIndexResult } from "./rules/types.js"

// ============================================================================
// Rule Helpers
// ============================================================================

/**
 * Create a pattern-based rule that matches regex in files.
 *
 * @example
 * ```ts
 * const rule = makePatternRule({
 *   id: "no-async-await",
 *   files: "src/**\/*.ts",
 *   pattern: /async\s+function/g,
 *   message: "Use Effect.gen instead of async/await",
 *   severity: "warning"
 * })
 * ```
 */
export { makePatternRule } from "./rules/helpers.js"

/**
 * Input type for creating pattern rules.
 */
export type { MakePatternRuleInput } from "./rules/helpers.js"

/**
 * Create a boundary rule that enforces architectural constraints.
 *
 * @example
 * ```ts
 * const rule = makeBoundaryRule({
 *   id: "no-ui-in-core",
 *   from: "src/core/**\/*.ts",
 *   disallow: ["react", "src/ui/**"],
 *   message: "Core modules cannot import UI code",
 *   severity: "error"
 * })
 * ```
 */
export { makeBoundaryRule } from "./rules/helpers.js"

/**
 * Input type for creating boundary rules.
 */
export type { MakeBoundaryRuleInput } from "./rules/helpers.js"

/**
 * Construct rules from config (both pattern and boundary rules).
 *
 * @example
 * ```ts
 * const rules = rulesFromConfig(config)
 * ```
 */
export { rulesFromConfig } from "./rules/builders.js"

// ============================================================================
// Configuration Schema
// ============================================================================

/**
 * Main configuration type for effect-migrate.
 */
export type { Config } from "./schema/Config.js"

/**
 * Schema class for pattern-based rules in config.
 */
export { PatternRuleSchema } from "./schema/Config.js"

/**
 * Schema class for boundary rules in config.
 */
export { BoundaryRuleSchema } from "./schema/Config.js"

/**
 * Schema class for file paths configuration.
 */
export { PathsSchema } from "./schema/Config.js"

/**
 * Schema class for migration tracking configuration.
 */
export { MigrationSchema } from "./schema/Config.js"

/**
 * Schema class for migration goals.
 */
export { MigrationGoalSchema } from "./schema/Config.js"

/**
 * Schema class for documentation guards.
 */
export { DocsGuardSchema } from "./schema/Config.js"

/**
 * Schema class for prohibited content patterns.
 */
export { ProhibitedContentSchema } from "./schema/Config.js"

/**
 * Schema class for report configuration.
 */
export { ReportSchema } from "./schema/Config.js"

/**
 * Main configuration schema class.
 */
export { ConfigSchema } from "./schema/Config.js"

// ============================================================================
// Configuration Utilities
// ============================================================================

/**
 * Check if a value is a plain object (not an array, null, or class instance).
 *
 * @example
 * ```ts
 * isPlainObject({})        // => true
 * isPlainObject([])        // => false
 * isPlainObject(null)      // => false
 * ```
 */
export { isPlainObject } from "./utils/merge.js"

/**
 * Deep merge two objects with source taking precedence.
 *
 * Recursively merges nested plain objects. Arrays are replaced, not merged.
 *
 * @example
 * ```ts
 * deepMerge(
 *   { a: { b: 1 }, tags: ["x"] },
 *   { a: { c: 2 }, tags: ["y"] }
 * )
 * // => { a: { b: 1, c: 2 }, tags: ["y"] }
 * ```
 */
export { deepMerge } from "./utils/merge.js"

/**
 * Merge preset defaults with user configuration.
 *
 * User config always takes precedence over preset defaults.
 *
 * @example
 * ```ts
 * const merged = mergeConfig(
 *   { concurrency: 4, paths: { exclude: ["node_modules"] } },
 *   userConfig
 * )
 * ```
 */
export { mergeConfig } from "./config/merge.js"

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load and validate configuration from file.
 *
 * Supports .json, .js, and .ts config files.
 *
 * @example
 * ```ts
 * const config = yield* loadConfig("./effect-migrate.config.ts")
 * ```
 */
export { loadConfig } from "./schema/loader.js"

/**
 * Helper for defining typed configuration in .ts files.
 *
 * @example
 * ```ts
 * // effect-migrate.config.ts
 * import { defineConfig } from "@effect-migrate/core"
 *
 * export default defineConfig({
 *   version: 1,
 *   paths: { exclude: ["node_modules/**"] }
 * })
 * ```
 */
export { defineConfig } from "./schema/loader.js"

/**
 * Error thrown when config loading fails.
 */
export { ConfigLoadError } from "./schema/loader.js"

// ============================================================================
// Schema Versioning
// ============================================================================

/**
 * Registry of schema versions for all output artifacts.
 *
 * Provides single source of truth for versioning index.json, audit.json,
 * metrics.json, and threads.json. Schema versions follow semver and are
 * independent of package versions.
 *
 * @example
 * ```ts
 * import { SCHEMA_VERSION } from "@effect-migrate/core"
 *
 * yield* Console.log(SCHEMA_VERSION) // "0.2.0"
 * ```
 */
export { SCHEMA_VERSION } from "./schema/index.js"

/**
 * Type for schema version value.
 */
export type { SchemaVersion } from "./schema/index.js"

// ============================================================================
// Package Metadata
// ============================================================================

/**
 * Get package metadata (version and schema version) from package.json.
 *
 * Works in both development (tsx) and production (built) environments.
 *
 * @example
 * ```ts
 * const { toolVersion, schemaVersion } = yield* getPackageMeta
 * // toolVersion: "0.4.0"
 * // schemaVersion: "0.2.0"
 * ```
 */
export { getPackageMeta } from "./amp/package-meta.js"

/**
 * Package metadata interface.
 */
export type { PackageMeta } from "./amp/package-meta.js"

// ============================================================================
// Services
// ============================================================================

/**
 * File discovery service for listing and reading files.
 *
 * Provides lazy loading and caching of file contents.
 */
export { FileDiscovery } from "./services/FileDiscovery.js"

/**
 * Live implementation of FileDiscovery service.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function*() {
 *   const discovery = yield* FileDiscovery
 *   const files = yield* discovery.listFiles(["src/**\/*.ts"])
 *   return files
 * }).pipe(Effect.provide(FileDiscoveryLive))
 * ```
 */
export { FileDiscoveryLive } from "./services/FileDiscovery.js"

/**
 * Import index service for building and querying import graphs.
 *
 * Used by boundary rules to enforce architectural constraints.
 */
export { ImportIndex } from "./services/ImportIndex.js"

/**
 * Error thrown when import parsing fails.
 */
export { ImportParseError } from "./services/ImportIndex.js"

/**
 * Live implementation of ImportIndex service.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function*() {
 *   const indexService = yield* ImportIndex
 *   const index = yield* indexService.getImportIndex(
 *     ["src/**\/*.ts"],
 *     ["node_modules/**"]
 *   )
 *   return index
 * }).pipe(Effect.provide(ImportIndexLive))
 * ```
 */
export { ImportIndexLive } from "./services/ImportIndex.js"

/**
 * Rule runner service for executing rules with context.
 *
 * Orchestrates file discovery, import indexing, and rule execution.
 */
export { RuleRunner, type RuleRunnerService } from "./services/RuleRunner.js"

/**
 * Live implementation of RuleRunner service with all dependencies.
 *
 * Provides FileDiscovery and ImportIndex services.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function*() {
 *   const runner = yield* RuleRunner
 *   const results = yield* runner.runRules(rules, config)
 *   return results
 * }).pipe(Effect.provide(RuleRunnerLive))
 * ```
 */
export { RuleRunnerLayer, RuleRunnerLive } from "./services/RuleRunner.js"

/**
 * Time service for centralized time operations.
 *
 * Wraps Clock.Clock to provide consistent timestamps and TestClock compatibility.
 *
 * @example
 * ```ts
 * import { Time, TimeLive } from "@effect-migrate/core"
 *
 * const program = Effect.gen(function*() {
 *   const timestamp = yield* Time.now
 *   const checkpointId = yield* Time.checkpointId
 *   return { timestamp, checkpointId }
 * }).pipe(Effect.provide(TimeLive))
 * ```
 */
export {
  checkpointId,
  formatCheckpointId,
  layerLive as TimeLive,
  now,
  nowMillis,
  nowUtc,
  Time
} from "./services/Time.js"

/**
 * ProcessInfo service for Effect-first access to process information.
 *
 * Provides safe, testable access to Node.js process globals (cwd, env, etc.)
 * following Effect-first patterns.
 *
 * @example
 * ```ts
 * import { ProcessInfo, ProcessInfoLive } from "@effect-migrate/core"
 *
 * const program = Effect.gen(function*() {
 *   const processInfo = yield* ProcessInfo
 *   const cwd = yield* processInfo.cwd
 *   const ampThreadId = yield* processInfo.getEnv("AMP_CURRENT_THREAD_ID")
 *   return { cwd, ampThreadId }
 * }).pipe(Effect.provide(ProcessInfoLive))
 * ```
 */
export { ProcessInfo, ProcessInfoLive, type ProcessInfoService } from "./services/ProcessInfo.js"

// ============================================================================
// Amp Context Generation
// ============================================================================

/**
 * Default output directory for Amp context files.
 */
export { AMP_OUT_DEFAULT } from "./amp/constants.js"

/**
 * Update index.json with thread references.
 */
export { updateIndexWithThreads } from "./amp/context-writer.js"

/**
 * Write audit context to file for Amp integration.
 */
export { writeAmpContext } from "./amp/context-writer.js"

/**
 * Write metrics context to file for Amp integration.
 */
export { writeMetricsContext } from "./amp/metrics-writer.js"

/**
 * Normalize rule results into compact structure for Amp context.
 */
export { normalizeResults } from "./amp/normalizer.js"

/**
 * Expand a compact result back to full RuleResult format.
 */
export { expandResult } from "./amp/normalizer.js"

/**
 * Generate stable key for a result (for cross-checkpoint delta computation).
 */
export { deriveResultKey } from "./amp/normalizer.js"

/**
 * Derive stable keys for all results in a FindingsGroup.
 */
export { deriveResultKeys } from "./amp/normalizer.js"

/**
 * Rebuild groups from results array (when groups were omitted).
 */
export { rebuildGroups } from "./amp/normalizer.js"

/**
 * Add a thread reference to the tracking system.
 */
export { addThread } from "./amp/thread-manager.js"

/**
 * Read all tracked thread references.
 */
export { readThreads } from "./amp/thread-manager.js"

/**
 * Generate filesystem-safe checkpoint ID from DateTime.
 */
export { generateCheckpointId } from "./amp/checkpoint-manager.js"

/**
 * Compute delta statistics between two FindingsSummary objects.
 */
export { computeDelta } from "./amp/checkpoint-manager.js"

/**
 * List recent checkpoints (newest first, sliced to limit).
 */
export { listCheckpoints } from "./amp/checkpoint-manager.js"

/**
 * Read checkpoint manifest from directory.
 */
export { readManifest } from "./amp/checkpoint-manager.js"

/**
 * Write checkpoint manifest to directory.
 */
export { writeManifest } from "./amp/checkpoint-manager.js"

/**
 * Read and decode a checkpoint file.
 */
export { readCheckpoint } from "./amp/checkpoint-manager.js"

/**
 * Create a new checkpoint with findings and config snapshot.
 */
export { createCheckpoint } from "./amp/checkpoint-manager.js"

// ============================================================================
// Preset Loading
// ============================================================================

/**
 * Preset loader service for loading presets via dynamic imports.
 *
 * Core package provides npm-only implementation; CLI provides workspace-aware layer.
 */
export { PresetLoader, type PresetLoaderService } from "./presets/PresetLoader.js"

/**
 * Live implementation of PresetLoader for npm package imports.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function*() {
 *   const loader = yield* PresetLoader
 *   const preset = yield* loader.loadPreset("@effect-migrate/preset-basic")
 *   return preset
 * }).pipe(Effect.provide(PresetLoaderNpmLive))
 * ```
 */
export { PresetLoaderNpmLive } from "./presets/PresetLoader.js"

/**
 * Error thrown when preset loading fails.
 */
export { PresetLoadError } from "./presets/PresetLoader.js"

/**
 * Result of loading multiple presets.
 */
export type { LoadPresetsResult } from "./presets/PresetLoader.js"

/**
 * Preset shape with rules and optional defaults.
 */
export type { Preset as PresetShape } from "./presets/PresetLoader.js"
