/**
 * Core Domain Types - Fundamental types for migration tracking
 *
 * This module defines the core domain types used throughout effect-migrate
 * for representing findings, violations, metrics, and code locations.
 *
 * @module @effect-migrate/core/types
 * @since 0.1.0
 */

/**
 * Severity level for findings and rule violations.
 *
 * - `error`: Critical issues that must be fixed
 * - `warning`: Issues that should be addressed but aren't blocking
 *
 * @category Core
 * @since 0.1.0
 */
export type Severity = "error" | "warning"

/**
 * Location information for a finding within a file.
 *
 * Includes line number, column, and the actual text at that location.
 *
 * @category Core
 * @since 0.1.0
 */
export interface Location {
  /** Line number (1-indexed) */
  line: number
  /** Column number (0-indexed) */
  column: number
  /** Actual text at this location */
  text: string
}

/**
 * Range information for precise code location.
 *
 * Defines a span from start position to end position within a file.
 *
 * @category Core
 * @since 0.1.0
 */
export interface Range {
  /** Start position */
  start: { line: number; column: number }
  /** End position */
  end: { line: number; column: number }
}

/**
 * Generic finding in the codebase.
 *
 * Represents any issue or violation discovered during analysis.
 *
 * @category Core
 * @since 0.1.0
 */
export interface Finding {
  /** Unique identifier for this finding */
  id: string
  /** File path where finding was discovered */
  file: string
  /** Human-readable description of the finding */
  message: string
  /** Severity level */
  severity: Severity
  /** Optional locations within the file */
  locations?: Location[]
}

/**
 * Rule violation with associated rule ID.
 *
 * Extends Finding with explicit rule tracking for audit purposes.
 *
 * @category Core
 * @since 0.1.0
 */
export interface Violation extends Finding {
  /** ID of the rule that produced this violation */
  ruleId: string
}

/**
 * Metric for tracking migration progress.
 *
 * Represents a measurable aspect of migration with current/target values.
 *
 * @category Core
 * @since 0.1.0
 */
export interface Metric {
  /** Unique metric identifier */
  id: string
  /** Human-readable description */
  description: string
  /** Current value */
  current: number
  /** Optional target value (goal) */
  target?: number
  /** Migration status for this metric */
  status: "migrated" | "in-progress" | "pending"
}
