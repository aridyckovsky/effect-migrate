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
 * import { SCHEMA_VERSIONS } from "@effect-migrate/core"
 *
 * console.log(SCHEMA_VERSIONS.audit) // "2.0.0"
 * console.log(SCHEMA_VERSIONS.index) // "1.1.0"
 * ```
 */
export { SCHEMA_VERSIONS } from "./schema/index.js"

/**
 * Type representing all schema versions.
 */
export type { SchemaVersions } from "./schema/index.js"

/**
 * Type for individual schema version values.
 */
export type { SchemaVersion } from "./schema/index.js"

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
 * Add a thread reference to the tracking system.
 */
export { addThread } from "./amp/thread-manager.js"

/**
 * Read all tracked thread references.
 */
export { readThreads } from "./amp/thread-manager.js"
