import * as Schema from "effect/Schema"

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

export class BoundaryRuleSchema extends Schema.Class<BoundaryRuleSchema>("BoundaryRuleSchema")({
  id: Schema.String,
  from: Schema.String,
  disallow: Schema.Array(Schema.String),
  message: Schema.String,
  severity: Schema.Literal("error", "warning"),
  docsUrl: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String))
}) {}

export class MigrationGoalSchema extends Schema.Class<MigrationGoalSchema>("MigrationGoalSchema")({
  type: Schema.Literal("percentage"),
  target: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(100)),
  description: Schema.optional(Schema.String)
}) {}

export class MigrationSchema extends Schema.Class<MigrationSchema>("MigrationSchema")({
  id: Schema.String,
  description: Schema.String,
  globs: Schema.Array(Schema.String),
  exclude: Schema.optional(Schema.Array(Schema.String)),
  marker: Schema.String,
  statuses: Schema.Record({ key: Schema.String, value: Schema.String }),
  goal: Schema.optional(MigrationGoalSchema)
}) {}

export class ProhibitedContentSchema extends Schema.Class<ProhibitedContentSchema>(
  "ProhibitedContentSchema"
)({
  globs: Schema.optional(Schema.Array(Schema.String)),
  pattern: Schema.String,
  message: Schema.String,
  severity: Schema.Literal("error", "warning")
}) {}

export class DocsGuardSchema extends Schema.Class<DocsGuardSchema>("DocsGuardSchema")({
  prohibitedFiles: Schema.Array(Schema.String),
  prohibitedContent: Schema.Array(ProhibitedContentSchema)
}) {}

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

export class ReportSchema extends Schema.Class<ReportSchema>("ReportSchema")({
  failOn: Schema.Array(Schema.Literal("error", "warning")),
  warnOn: Schema.Array(Schema.Literal("error", "warning"))
}) {
  static readonly defaultFailOn = ["error"] as const
  static readonly defaultWarnOn = [] as const
}

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

export type Config = Schema.Schema.Type<typeof ConfigSchema>
