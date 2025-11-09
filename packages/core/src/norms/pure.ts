/**
 * Norms Pure Functions - Pure logic for norm detection and directory analysis.
 *
 * This module contains 100% pure functions for analyzing checkpoints and detecting
 * norms (rules that went to zero violations). All functions are Effect-free,
 * making them easily unit-testable.
 *
 * **Design Principles:**
 * - 100% pure functions (no IO, no side effects)
 * - Unit-testable without Effect runtime
 * - Use Option for explicit null handling
 * - All checkpoint data passed as plain objects
 *
 * @module @effect-migrate/core/norms/pure
 * @since 0.6.0
 */

import * as Option from "effect/Option"
import type { DirectoryStatus } from "./types.js"

/**
 * Plain object representation of a Norm (for pure functions).
 *
 * This is a simplified version of the Norm schema type that uses plain
 * JavaScript objects and ISO date strings instead of Schema types.
 * The service layer converts between NormData and the Norm schema.
 *
 * @category Type
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * const norm: NormData = {
 *   ruleId: "no-async-await",
 *   ruleKind: "pattern",
 *   severity: "warning",
 *   establishedAt: "2025-01-15T10:30:00Z",
 *   violationsFixed: 42,
 *   docsUrl: "https://effect.website/docs/gen"
 * }
 * ```
 */
export interface NormData {
  /** Rule ID (e.g., "no-async-await") */
  readonly ruleId: string

  /** Rule kind (e.g., "pattern", "boundary") */
  readonly ruleKind: string

  /** Severity level of the rule */
  readonly severity: "error" | "warning" | "info"

  /** ISO 8601 timestamp when norm was established */
  readonly establishedAt: string

  /** Total violations fixed to establish this norm */
  readonly violationsFixed: number

  /** Optional documentation URL */
  readonly docsUrl?: string
}

/**
 * Internal checkpoint representation for norm detection.
 *
 * Simplified version of AuditCheckpoint with only fields needed for analysis.
 * Uses the same compressed findings format as AuditCheckpoint for efficiency.
 *
 * @category Type
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * const checkpoint: CheckpointData = {
 *   checkpointId: "cp-abc123",
 *   timestamp: "2025-01-15T10:30:00Z",
 *   findings: {
 *     rules: [
 *       {
 *         id: "no-async-await",
 *         kind: "pattern",
 *         severity: "warning",
 *         message: "Use Effect.gen instead",
 *         docsUrl: "https://effect.website"
 *       }
 *     ],
 *     files: ["src/services/UserService.ts"],
 *     results: [
 *       { rule: 0, file: 0, range: [10, 5, 10, 20] }
 *     ]
 *   }
 * }
 * ```
 */
export interface CheckpointData {
  /** Unique checkpoint identifier */
  readonly checkpointId: string

  /** ISO 8601 timestamp when checkpoint was created */
  readonly timestamp: string

  /** Compressed audit findings */
  readonly findings: {
    /** Array of rules (indexed) */
    readonly rules: ReadonlyArray<{
      /** Rule ID */
      readonly id: string

      /** Rule kind */
      readonly kind: string

      /** Severity level */
      readonly severity: "error" | "warning" | "info"

      /** Rule message */
      readonly message: string

      /** Optional documentation URL */
      readonly docsUrl?: string
    }>

    /** Array of file paths (indexed) */
    readonly files: ReadonlyArray<string>

    /** Array of results referencing rule and file indices */
    readonly results: ReadonlyArray<{
      /** Index into rules array */
      readonly rule: number

      /** Optional index into files array */
      readonly file?: number

      /** Optional range tuple [startLine, startCol, endLine, endCol] */
      readonly range?: readonly [number, number, number, number]
    }>
  }
}

/**
 * Extract directory key from file path at specified depth.
 *
 * Splits a file path by "/" and returns the first N segments joined back together.
 * This is used to group files by directory at a specific nesting level.
 *
 * @param filePath - File path to extract directory from (e.g., "src/services/UserService.ts")
 * @param depth - Number of path segments to include (e.g., 2 for "src/services")
 * @returns Directory path at specified depth
 *
 * @category Pure Function
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * dirKeyFromPath("src/services/UserService.ts", 2)
 * // → "src/services"
 *
 * dirKeyFromPath("packages/core/src/index.ts", 2)
 * // → "packages/core"
 *
 * dirKeyFromPath("src/services/auth/UserService.ts", 3)
 * // → "src/services/auth"
 *
 * dirKeyFromPath("src/index.ts", 1)
 * // → "src"
 * ```
 */
export function dirKeyFromPath(filePath: string, depth: number): string {
  const parts = filePath.split("/")
  return parts.slice(0, depth).join("/")
}

/**
 * Build time series of violation counts for a specific rule in a directory.
 *
 * For each checkpoint, counts how many violations of the specified rule exist
 * in files within the given directory. Returns an array of [timestamp, count]
 * tuples that can be analyzed to detect norm transitions.
 *
 * @param checkpoints - Checkpoints sorted ascending by timestamp
 * @param ruleId - Rule ID to track (e.g., "no-async-await")
 * @param directory - Directory path to filter files (e.g., "src/services")
 * @returns Array of [timestamp, violationCount] tuples, one per checkpoint
 *
 * @category Internal
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * const timeSeries = buildRuleTimeSeries(
 *   checkpoints,
 *   "no-async-await",
 *   "src/services"
 * )
 * // → [
 * //   ["2025-01-01T10:00:00Z", 42],
 * //   ["2025-01-02T10:00:00Z", 15],
 * //   ["2025-01-03T10:00:00Z", 0],
 * //   ["2025-01-04T10:00:00Z", 0]
 * // ]
 * ```
 */
function buildRuleTimeSeries(
  checkpoints: ReadonlyArray<CheckpointData>,
  ruleId: string,
  directory: string
): ReadonlyArray<readonly [string, number]> {
  return checkpoints.map(checkpoint => {
    const { rules, files, results } = checkpoint.findings

    // Find rule index
    const ruleIndex = rules.findIndex(r => r.id === ruleId)
    if (ruleIndex === -1) {
      return [checkpoint.timestamp, 0] as const
    }

    // Count violations in this directory
    let count = 0
    for (const result of results) {
      if (result.rule === ruleIndex && result.file !== undefined) {
        const filePath = files[result.file]
        if (filePath && filePath.startsWith(directory + "/")) {
          count++
        }
      }
    }

    return [checkpoint.timestamp, count] as const
  })
}

/**
 * Detect if a rule became a norm (went to zero and stayed there).
 *
 * This implements the core norm detection algorithm:
 * 1. Last K checkpoints (lookbackWindow) all have count === 0
 * 2. There exists an earlier checkpoint with count > 0
 * 3. establishedAt = timestamp of first zero after last non-zero
 *
 * Returns Option.none() if the rule is not a norm (still has violations,
 * never had violations, or hasn't been zero long enough).
 *
 * @param timeSeries - Array of [timestamp, count] tuples (sorted ascending by time)
 * @param lookbackWindow - Number of consecutive zero checkpoints required (default 5)
 * @returns Option.some([establishedAt, violationsFixed]) if norm detected, Option.none() otherwise
 *
 * @category Internal
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * // Norm detected: went to zero and stayed there
 * const timeSeries1 = [
 *   ["2025-01-01", 42],
 *   ["2025-01-02", 15],
 *   ["2025-01-03", 0],  // ← Transition point
 *   ["2025-01-04", 0],
 *   ["2025-01-05", 0],
 *   ["2025-01-06", 0],
 *   ["2025-01-07", 0]
 * ]
 * detectNormTransition(timeSeries1, 5)
 * // → Option.some(["2025-01-03", 15])
 *
 * // Not a norm: still has violations
 * const timeSeries2 = [
 *   ["2025-01-01", 42],
 *   ["2025-01-02", 15],
 *   ["2025-01-03", 10]
 * ]
 * detectNormTransition(timeSeries2, 5)
 * // → Option.none()
 *
 * // Not a norm: never had violations
 * const timeSeries3 = [
 *   ["2025-01-01", 0],
 *   ["2025-01-02", 0],
 *   ["2025-01-03", 0]
 * ]
 * detectNormTransition(timeSeries3, 2)
 * // → Option.none()
 * ```
 */
function detectNormTransition(
  timeSeries: ReadonlyArray<readonly [string, number]>,
  lookbackWindow: number
): Option.Option<readonly [string, number]> {
  if (timeSeries.length < lookbackWindow + 1) {
    return Option.none()
  }

  // Check last K checkpoints are all zero
  const recentCheckpoints = timeSeries.slice(-lookbackWindow)
  const allZero = recentCheckpoints.every(([_, count]) => count === 0)

  if (!allZero) {
    return Option.none()
  }

  // Find earliest checkpoint before lookback window that was non-zero
  const earlierCheckpoints = timeSeries.slice(0, -lookbackWindow)
  const hadViolations = earlierCheckpoints.some(([_, count]) => count > 0)

  if (!hadViolations) {
    return Option.none()
  }

  // Find transition point: first zero after non-zero
  let lastNonZeroIndex = -1
  for (let i = timeSeries.length - lookbackWindow - 1; i >= 0; i--) {
    if (timeSeries[i][1] > 0) {
      lastNonZeroIndex = i
      break
    }
  }

  if (lastNonZeroIndex === -1) {
    return Option.none()
  }

  const firstZeroIndex = lastNonZeroIndex + 1
  if (firstZeroIndex >= timeSeries.length) {
    return Option.none()
  }

  const establishedAt = timeSeries[firstZeroIndex][0]

  // Calculate violations fixed as peak before zero
  const earlierCounts = timeSeries
    .slice(0, timeSeries.length - lookbackWindow)
    .map(([_, c]) => c)
  const violationsFixed = Math.max(...earlierCounts)

  return Option.some([establishedAt, violationsFixed] as const)
}

/**
 * Detect all established norms for a directory.
 *
 * This is the main entry point for norm detection. It:
 * 1. Collects all unique rules across all checkpoints
 * 2. For each rule, builds a time series of violation counts
 * 3. Detects if the rule transitioned to zero and stayed there
 * 4. Returns NormData for all rules that became norms
 *
 * @param checkpoints - Checkpoints sorted ascending by timestamp
 * @param directory - Directory path to analyze (e.g., "src/services")
 * @param lookbackWindow - Number of consecutive zero checkpoints required (default 5)
 * @returns Array of NormData objects representing established norms
 *
 * @category Pure Function
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { detectExtinctNorms } from "@effect-migrate/core"
 *
 * const checkpoints = [
 *   // ... checkpoint data
 * ]
 *
 * const norms = detectExtinctNorms(checkpoints, "src/services", 5)
 * // → [
 * //   {
 * //     ruleId: "no-async-await",
 * //     ruleKind: "pattern",
 * //     severity: "warning",
 * //     establishedAt: "2025-01-15T10:30:00Z",
 * //     violationsFixed: 42,
 * //     docsUrl: "https://effect.website/docs/gen"
 * //   },
 * //   // ... more norms
 * // ]
 * ```
 */
export function detectExtinctNorms(
  checkpoints: ReadonlyArray<CheckpointData>,
  directory: string,
  lookbackWindow: number = 5
): ReadonlyArray<NormData> {
  if (checkpoints.length === 0) {
    return []
  }

  // Collect all unique rules across checkpoints
  const ruleMap = new Map<
    string,
    { id: string; kind: string; severity: "error" | "warning" | "info"; docsUrl?: string }
  >()

  for (const checkpoint of checkpoints) {
    for (const rule of checkpoint.findings.rules) {
      if (!ruleMap.has(rule.id)) {
        // Only set docsUrl if it's actually defined
        const ruleEntry: {
          id: string
          kind: string
          severity: "error" | "warning" | "info"
          docsUrl?: string
        } = {
          id: rule.id,
          kind: rule.kind,
          severity: rule.severity
        }
        if (rule.docsUrl !== undefined) {
          ruleEntry.docsUrl = rule.docsUrl
        }
        ruleMap.set(rule.id, ruleEntry)
      }
    }
  }

  const norms: NormData[] = []

  // Check each rule for norm transition
  for (const [ruleId, rule] of ruleMap) {
    const timeSeries = buildRuleTimeSeries(checkpoints, ruleId, directory)
    const transition = detectNormTransition(timeSeries, lookbackWindow)

    if (Option.isSome(transition)) {
      const [establishedAt, violationsFixed] = transition.value

      // Build norm with conditional docsUrl
      const norm: NormData = {
        ruleId: rule.id,
        ruleKind: rule.kind,
        severity: rule.severity,
        establishedAt,
        violationsFixed,
        ...(rule.docsUrl !== undefined && { docsUrl: rule.docsUrl })
      }

      norms.push(norm)
    }
  }

  return norms
}

/**
 * Compute directory file statistics from latest checkpoint.
 *
 * Analyzes the most recent checkpoint to determine:
 * - Total files in the directory
 * - Files with no violations (clean)
 * - Files with at least one violation
 *
 * @param checkpoints - Checkpoints sorted ascending by timestamp
 * @param directory - Directory path to analyze (e.g., "src/services")
 * @returns Object with total, clean, and withViolations counts
 *
 * @category Pure Function
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { computeDirectoryStats } from "@effect-migrate/core"
 *
 * const stats = computeDirectoryStats(checkpoints, "src/services")
 * // → {
 * //   total: 25,
 * //   clean: 20,
 * //   withViolations: 5
 * // }
 * ```
 */
export function computeDirectoryStats(
  checkpoints: ReadonlyArray<CheckpointData>,
  directory: string
): { total: number; clean: number; withViolations: number } {
  if (checkpoints.length === 0) {
    return { total: 0, clean: 0, withViolations: 0 }
  }

  // Union of files in directory across all checkpoints
  const allFiles = new Set<string>()
  for (const cp of checkpoints) {
    for (const f of cp.findings.files) {
      if (f.startsWith(directory + "/")) {
        allFiles.add(f)
      }
    }
  }
  const total = allFiles.size
  if (total === 0) {
    return { total: 0, clean: 0, withViolations: 0 }
  }

  // Violations from latest checkpoint only
  const latest = checkpoints[checkpoints.length - 1]
  const latestFiles = latest.findings.files
  const filesWithViolations = new Set<string>()
  for (const r of latest.findings.results) {
    if (r.file !== undefined) {
      const p = latestFiles[r.file]
      if (p && p.startsWith(directory + "/")) {
        filesWithViolations.add(p)
      }
    }
  }
  const withViolations = filesWithViolations.size
  const clean = total - withViolations
  return { total, clean, withViolations }
}

/**
 * Determine directory migration status.
 *
 * Computes the status based on file statistics and established norms:
 * - **migrated**: No violations remain AND norms have been established
 * - **in-progress**: Some violations remain OR norms partially established
 * - **not-started**: No files OR no meaningful migration activity
 *
 * @param stats - File statistics (total, clean, withViolations)
 * @param norms - Array of established norms
 * @returns Directory migration status
 *
 * @category Pure Function
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { determineStatus } from "@effect-migrate/core"
 *
 * // Migrated: all clean with norms
 * determineStatus({ total: 25, clean: 25, withViolations: 0 }, [norm1, norm2])
 * // → "migrated"
 *
 * // In-progress: some violations remain
 * determineStatus({ total: 25, clean: 20, withViolations: 5 }, [norm1])
 * // → "in-progress"
 *
 * // Not started: no norms, no clean files
 * determineStatus({ total: 25, clean: 0, withViolations: 25 }, [])
 * // → "not-started"
 * ```
 */
export function determineStatus(
  stats: { total: number; clean: number; withViolations: number },
  norms: ReadonlyArray<NormData>
): DirectoryStatus {
  // Norms established and no current violations => migrated
  if (stats.withViolations === 0 && norms.length > 0) {
    return "migrated"
  }

  // No files and no norms => not-started
  if (stats.total === 0 && norms.length === 0) {
    return "not-started"
  }

  // Some activity (norms or clean files) => in-progress
  if (norms.length > 0 || stats.clean > 0) {
    return "in-progress"
  }

  return "not-started"
}

/**
 * Find when directory became clean (all files have zero violations).
 *
 * Builds a time series of total violations in the directory and finds the
 * first checkpoint where violations went to zero and stayed at zero for all
 * subsequent checkpoints.
 *
 * Returns Option.none() if the directory has never been clean or if it
 * became clean but later regressed.
 *
 * @param checkpoints - Checkpoints sorted ascending by timestamp
 * @param directory - Directory path to analyze (e.g., "src/services")
 * @returns Option.some(timestamp) if directory became clean, Option.none() otherwise
 *
 * @category Pure Function
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { findCleanTimestamp } from "@effect-migrate/core"
 * import * as Option from "effect/Option"
 *
 * const cleanTime = findCleanTimestamp(checkpoints, "src/services")
 *
 * if (Option.isSome(cleanTime)) {
 *   console.log(`Directory clean since: ${cleanTime.value}`)
 * } else {
 *   console.log("Directory not yet clean")
 * }
 * ```
 */
export function findCleanTimestamp(
  checkpoints: ReadonlyArray<CheckpointData>,
  directory: string
): Option.Option<string> {
  if (checkpoints.length === 0) {
    return Option.none()
  }

  // Build time series of total violations in directory
  const timeSeries = checkpoints.map(checkpoint => {
    const { files, results } = checkpoint.findings

    let totalViolations = 0
    for (const result of results) {
      if (result.file !== undefined) {
        const filePath = files[result.file]
        if (filePath && filePath.startsWith(directory + "/")) {
          totalViolations++
        }
      }
    }

    return [checkpoint.timestamp, totalViolations] as const
  })

  // Find first checkpoint where violations went to zero and stayed zero
  for (let i = 0; i < timeSeries.length; i++) {
    if (timeSeries[i][1] === 0) {
      // Check if all subsequent checkpoints are also zero
      const remainingZero = timeSeries.slice(i).every(([_, count]) => count === 0)
      if (remainingZero) {
        return Option.some(timeSeries[i][0])
      }
    }
  }

  return Option.none()
}
