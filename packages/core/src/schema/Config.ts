/**
 * Configuration Schema - Type-safe config validation with effect/Schema
 *
 * This module defines the schema for effect-migrate configuration files.
 * All schemas use Schema.Class for nominal typing and transformation,
 * with static defaults for common values.
 *
 * @module @effect-migrate/core/schema/Config
 * @since 0.1.0
 */

import * as Schema from "effect/Schema"

/**
 * Schema for pattern-based rule configuration.
 *
 * Validates pattern rule definitions with regex transformation and
 * optional negative patterns for excluding false positives.
 *
 * @category Schema
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const patternRule = {
 *   id: "no-async-await",
 *   pattern: "async\\s+function",
 *   files: "src/**\/*.ts",
 *   message: "Use Effect.gen instead",
 *   severity: "warning"
 * }
 * ```
 */
export class PatternRuleSchema extends Schema.Class<PatternRuleSchema>("PatternRuleSchema")({
  id: Schema.String,
  pattern: Schema.Union(
    Schema.String,
    Schema.Struct({
      source: Schema.String,
      flags: Schema.optional(Schema.String)
    })
  ).pipe(
    Schema.transform(Schema.instanceOf(RegExp), {
      decode: input => {
        if (typeof input === "string") {
          return new RegExp(input, "gm")
        }
        return new RegExp(input.source, input.flags ?? "gm")
      },
      encode: regex => regex.source
    })
  ),
  negativePattern: Schema.optional(Schema.String),
  files: Schema.Union(Schema.String, Schema.Array(Schema.String)),
  message: Schema.String,
  severity: Schema.Literal("error", "warning"),
  docsUrl: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String))
}) {}

/**
 * Schema for boundary rule configuration.
 *
 * Validates architectural boundary rules that enforce import constraints
 * between code layers/modules.
 *
 * @category Schema
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const boundaryRule = {
 *   id: "no-ui-in-core",
 *   from: "src/core/**\/*.ts",
 *   disallow: ["react", "src/ui/**"],
 *   message: "Core cannot import UI",
 *   severity: "error"
 * }
 * ```
 */
export class BoundaryRuleSchema extends Schema.Class<BoundaryRuleSchema>("BoundaryRuleSchema")({
  id: Schema.String,
  from: Schema.String,
  disallow: Schema.Array(Schema.String),
  message: Schema.String,
  severity: Schema.Literal("error", "warning"),
  docsUrl: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String))
}) {}

/**
 * Schema for migration goal tracking.
 *
 * Defines percentage-based migration targets for progress tracking.
 *
 * @category Schema
 * @since 0.1.0
 */
export class MigrationGoalSchema extends Schema.Class<MigrationGoalSchema>("MigrationGoalSchema")({
  type: Schema.Literal("percentage"),
  target: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(100)),
  description: Schema.optional(Schema.String)
}) {}

/**
 * Schema for migration tracking configuration.
 *
 * Defines migration markers and status tracking for incremental migrations.
 *
 * @category Schema
 * @since 0.1.0
 */
export class MigrationSchema extends Schema.Class<MigrationSchema>("MigrationSchema")({
  id: Schema.String,
  description: Schema.String,
  globs: Schema.Array(Schema.String),
  exclude: Schema.optional(Schema.Array(Schema.String)),
  marker: Schema.String,
  statuses: Schema.Record({ key: Schema.String, value: Schema.String }),
  goal: Schema.optional(MigrationGoalSchema)
}) {}

/**
 * Schema for prohibited content patterns in documentation guards.
 *
 * @category Schema
 * @since 0.1.0
 */
export class ProhibitedContentSchema extends Schema.Class<ProhibitedContentSchema>(
  "ProhibitedContentSchema"
)({
  globs: Schema.optional(Schema.Array(Schema.String)),
  pattern: Schema.String,
  message: Schema.String,
  severity: Schema.Literal("error", "warning")
}) {}

/**
 * Schema for documentation governance rules.
 *
 * @category Schema
 * @since 0.1.0
 */
export class DocsGuardSchema extends Schema.Class<DocsGuardSchema>("DocsGuardSchema")({
  prohibitedFiles: Schema.Array(Schema.String),
  prohibitedContent: Schema.Array(ProhibitedContentSchema)
}) {}

/**
 * Schema for file path configuration.
 *
 * Defines include/exclude patterns and project root path.
 * Provides default exclusions for common build/dependency directories.
 *
 * @category Schema
 * @since 0.1.0
 */
export class PathsSchema extends Schema.Class<PathsSchema>("PathsSchema")({
  root: Schema.optional(Schema.String),
  exclude: Schema.Array(Schema.String),
  include: Schema.optional(Schema.Array(Schema.String))
}) {
  static readonly defaultExclude = [
    "node_modules/**",
    "dist/**",
    ".next/**",
    "coverage/**",
    ".git/**",
    "build/**",
    "*.min.js"
  ]
}

/**
 * Schema for audit reporting configuration.
 *
 * Defines which severity levels cause audit failure or warnings.
 *
 * @category Schema
 * @since 0.1.0
 */
export class ReportSchema extends Schema.Class<ReportSchema>("ReportSchema")({
  failOn: Schema.Array(Schema.Literal("error", "warning")),
  warnOn: Schema.Array(Schema.Literal("error", "warning"))
}) {
  static readonly defaultFailOn = ["error"] as const
  static readonly defaultWarnOn = [] as const
}

/**
 * Root configuration schema for effect-migrate.
 *
 * Defines the complete structure of effect-migrate.config.ts files
 * with validation, defaults, and type safety via effect/Schema.
 *
 * @category Schema
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const config = {
 *   version: 1,
 *   paths: {
 *     exclude: ["node_modules/**", "dist/**"],
 *     include: ["src/**\/*.ts"]
 *   },
 *   patterns: [{ id: "no-async", pattern: /async/, ... }],
 *   concurrency: 4
 * }
 * ```
 */
export class ConfigSchema extends Schema.Class<ConfigSchema>("ConfigSchema")({
  version: Schema.Number.pipe(Schema.greaterThan(0)),
  paths: Schema.optional(PathsSchema),
  patterns: Schema.optional(Schema.Array(PatternRuleSchema)),
  boundaries: Schema.optional(Schema.Array(BoundaryRuleSchema)),
  migrations: Schema.optional(Schema.Array(MigrationSchema)),
  docs: Schema.optional(DocsGuardSchema),
  presets: Schema.optional(Schema.Array(Schema.String)),
  report: Schema.optional(ReportSchema),
  concurrency: Schema.optional(
    Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(16))
  ),
  extensions: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
}) {
  static readonly defaultConcurrency = 4
}

/**
 * TypeScript type extracted from ConfigSchema.
 *
 * Use this type for function parameters and variables instead of
 * referencing ConfigSchema directly.
 *
 * @category Types
 * @since 0.1.0
 */
export type Config = Schema.Schema.Type<typeof ConfigSchema>

/**
 * Schema for preset default configuration.
 *
 * Preset defaults can override any Config field except version (which is always 1)
 * and patterns/boundaries (which come from the preset's rules array).
 *
 * @category Schema
 * @since 0.3.0
 */
export class PresetDefaultsSchema
  extends Schema.Class<PresetDefaultsSchema>("PresetDefaultsSchema")(
    {
      paths: Schema.optional(PathsSchema),
      migrations: Schema.optional(Schema.Array(MigrationSchema)),
      docs: Schema.optional(DocsGuardSchema),
      report: Schema.optional(ReportSchema),
      concurrency: Schema.optional(
        Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(16))
      ),
      extensions: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
    }
  )
{}

/**
 * TypeScript type for preset defaults.
 *
 * @category Types
 * @since 0.3.0
 */
export type PresetDefaults = Schema.Schema.Type<typeof PresetDefaultsSchema>
