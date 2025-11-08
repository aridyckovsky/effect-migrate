/**
 * Rule System Types - Core interfaces for rule execution and results
 *
 * This module defines the type system for effect-migrate's rule engine,
 * including rule context, results, and import index interfaces.
 *
 * @module @effect-migrate/core/rules/types
 * @since 0.1.0
 */

import type * as Effect from "effect/Effect"
import type { Location, Range, Severity } from "../types.js"

/**
 * All valid rule kinds.
 *
 * @category Rule System
 * @since 0.1.0
 */
export const RULE_KINDS = ["pattern", "boundary", "docs", "metrics"] as const

/**
 * Rule kind type derived from RULE_KINDS constant.
 *
 * @category Rule System
 * @since 0.1.0
 */
export type RuleKind = typeof RULE_KINDS[number]

/**
 * Execution context provided to rules during run.
 *
 * Provides lazy access to files, imports, and configuration. All file
 * operations are cached to avoid redundant I/O.
 *
 * @category Rule System
 * @since 0.1.0
 */
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

/**
 * Import index query interface for boundary rules.
 *
 * Provides methods to query the import graph built from project files.
 * Used by boundary rules to detect architectural violations.
 *
 * @category Rule System
 * @since 0.1.0
 */
export interface ImportIndexResult {
  /** Get imported modules for a given file */
  getImports: (file: string) => Effect.Effect<ReadonlyArray<string>, any>

  /** Get files that import a given module */
  getImporters: (module: string) => Effect.Effect<ReadonlyArray<string>, any>
}

/**
 * Result of running a rule check.
 *
 * Contains all information about a violation including location, severity,
 * message, and optional documentation links.
 *
 * @category Rule System
 * @since 0.1.0
 */
export interface RuleResult {
  /** Unique rule identifier */
  id: string

  /** Rule kind for categorization */
  ruleKind: RuleKind

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

/**
 * Interface for implementing custom rules.
 *
 * Rules receive a RuleContext and return an Effect containing RuleResults.
 * All rules must be pure (no side effects except logging) and idempotent.
 *
 * @category Rule System
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const myRule: Rule = {
 *   id: "custom-rule",
 *   kind: "pattern",
 *   run: (ctx) => Effect.gen(function*() {
 *     const files = yield* ctx.listFiles(["src/**\/*.ts"])
 *     // ... analyze files
 *     return results
 *   })
 * }
 * ```
 */
export interface Rule {
  /** Unique identifier */
  id: string

  /** Rule category */
  kind: RuleKind

  /** Execute rule check */
  run: (ctx: RuleContext) => Effect.Effect<RuleResult[], any>
}

/**
 * Collection of rules with optional default configuration.
 *
 * Presets bundle related rules together (e.g., "basic" migration rules)
 * and can provide default config overrides.
 *
 * @category Rule System
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const myPreset: Preset = {
 *   rules: [asyncAwaitRule, promiseRule],
 *   defaults: {
 *     report: { failOn: ["error"] }
 *   }
 * }
 * ```
 */
export interface Preset {
  /** Collection of rules */
  rules: Rule[]

  /** Default configuration overrides */
  defaults?: {
    paths?: {
      root?: string
      exclude?: string[]
      include?: string[]
    }
    concurrency?: number
    report?: {
      failOn?: readonly ("error" | "warning")[]
      warnOn?: readonly ("error" | "warning")[]
    }
    migrations?: ReadonlyArray<unknown>
    docs?: unknown
    extensions?: Record<string, unknown>
  }
}
