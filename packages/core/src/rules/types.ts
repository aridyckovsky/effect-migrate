import type * as Effect from "effect/Effect"
import type { Location, Range, Severity } from "../types.js"

export interface RuleContext {
  /** Current working directory */
  cwd: string

  /** List files matching glob patterns (lazy) */
  listFiles: (globs: string[]) => Effect.Effect<string[], any>

  /** Read file content (lazy, cached) */
  readFile: (path: string) => Effect.Effect<string, any>

  /** Get import index (built on first use, cached) */
  getImportIndex: () => Effect.Effect<ImportIndexResult, any>

  /** User config (unknown, validate in rule) */
  config: unknown

  /** Root path for project */
  path: string

  /** Logger for debug output */
  logger: {
    debug: (message: string) => Effect.Effect<void>
    info: (message: string) => Effect.Effect<void>
  }
}

export interface ImportIndexResult {
  /** Map of file -> imported modules */
  getImports: (file: string) => Effect.Effect<ReadonlyArray<string>, any>

  /** Map of module -> files that import it */
  getImporters: (module: string) => Effect.Effect<ReadonlyArray<string>, any>
}

export interface RuleResult {
  /** Unique rule identifier */
  id: string

  /** Rule kind for categorization */
  ruleKind: "pattern" | "boundary" | "docs" | "metrics"

  /** Human-readable message */
  message: string

  /** Severity level */
  severity: Severity

  /** File path (optional for project-level rules) */
  file?: string

  /** Precise location range */
  range?: Range

  /** Legacy locations array for compatibility */
  locations?: Location[]

  /** Documentation URL for rule */
  docsUrl?: string

  /** Tags for filtering/categorization */
  tags?: string[]

  /** Auto-fix suggestion */
  suggestion?: string
}

export interface Rule {
  /** Unique identifier */
  id: string

  /** Rule category */
  kind: "pattern" | "boundary" | "docs" | "metrics"

  /** Execute rule check */
  run: (ctx: RuleContext) => Effect.Effect<RuleResult[], any>
}

export interface Preset {
  /** Collection of rules */
  rules: Rule[]

  /** Default configuration overrides */
  defaults?: Partial<any> // Will be Config type
}
