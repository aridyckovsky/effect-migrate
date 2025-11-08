/**
 * Normalizer - Pure functions for compacting and expanding rule results
 *
 * This module provides utilities for converting between full RuleResult arrays
 * and the normalized FindingsGroup structure used in Amp context files.
 *
 * The normalization process deduplicates rule metadata and file paths to reduce
 * JSON payload size by 60-80% on typical projects with hundreds of findings.
 *
 * **Key optimizations:**
 * - Rules stored once with metadata, referenced by index
 * - File paths stored once, referenced by index
 * - Ranges compressed to 4-element tuples [startLine, startCol, endLine, endCol]
 * - Message overrides only stored when different from rule.message
 * - Group indices use stringified numbers for consistent JSON serialization
 *
 * ## Cross-Checkpoint Delta Computation
 *
 * When computing deltas between checkpoints, DO NOT rely on array indices.
 * Indices shift when rules/files are added or removed.
 *
 * Instead, use {@link deriveResultKey} to generate stable content-based keys:
 *
 * @example
 * ```typescript
 * const checkpoint1 = normalizeResults(results1)
 * const checkpoint2 = normalizeResults(results2)
 *
 * const keys1 = deriveResultKeys(checkpoint1)
 * const keys2 = deriveResultKeys(checkpoint2)
 *
 * // Compute delta by comparing key sets
 * const added = [...keys2.values()].filter(k => ![...keys1.values()].includes(k))
 * const removed = [...keys1.values()].filter(k => ![...keys2.values()].includes(k))
 * ```
 *
 * @module @effect-migrate/core/amp/normalizer
 * @since 0.1.0
 */

import type { RuleResult } from "../rules/types.js"
import type { CompactRange, CompactResult, FindingsGroup, RuleDef } from "../schema/amp.js"

/**
 * Normalize rule results into a compact, deduplicated structure.
 *
 * This function transforms an array of RuleResult objects into a FindingsGroup
 * with significant space savings by deduplicating rule metadata and file paths.
 *
 * **Deduplication strategy:**
 * 1. Extract unique rules (id, kind, severity, message, docsUrl, tags) into rules[]
 * 2. Extract unique file paths into files[]
 * 3. Build compact results[] with index references
 * 4. Create byFile and byRule groupings with result indices
 * 5. Count errors/warnings and compute summary statistics
 *
 * **Space reduction example:**
 * - 1000 findings from 10 rules across 50 files
 * - Original: ~500KB (rule metadata duplicated 1000 times)
 * - Normalized: ~150KB (rules stored once, indexed by number)
 *
 * **Message override logic:**
 * If a result's message differs from its rule's message (e.g., dynamic interpolation),
 * the message is stored in the CompactResult. Otherwise, it's omitted and derived
 * from the rule definition during expansion.
 *
 * **Group key format:**
 * Keys in byFile and byRule are stringified indices:
 * - byFile["0"] = [0, 1, 2] (file index 0 has results [0, 1, 2])
 * - byRule["3"] = [5, 6] (rule index 3 has results [5, 6])
 *
 * **Groups field (performance cache):**
 * The `groups` field is always emitted for performance (fast O(1) lookups).
 * It is marked optional in the schema for future flexibility (may be omitted
 * to save space). Consumers should treat it as a cache and use `rebuildGroups()`
 * if missing.
 *
 * @param results - Array of rule results to normalize
 * @returns FindingsGroup with deduplicated structure and summary
 *
 * @example
 * ```typescript
 * const results: RuleResult[] = [
 *   {
 *     id: "no-async-await",
 *     ruleKind: "pattern",
 *     severity: "error",
 *     message: "Use Effect.gen instead of async/await",
 *     file: "src/index.ts",
 *     range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } },
 *     docsUrl: "https://effect.website/docs/async"
 *   },
 *   {
 *     id: "no-async-await",
 *     ruleKind: "pattern",
 *     severity: "error",
 *     message: "Use Effect.gen instead of async/await",
 *     file: "src/utils.ts",
 *     range: { start: { line: 5, column: 0 }, end: { line: 5, column: 15 } }
 *   }
 * ]
 *
 * const normalized = normalizeResults(results)
 * // normalized.rules.length === 1 (deduplicated)
 * // normalized.files.length === 2
 * // normalized.results.length === 2
 * // normalized.summary.errors === 2
 * // normalized.groups.byFile["0"] === [0] (file 0 has result 0)
 * // normalized.groups.byFile["1"] === [1] (file 1 has result 1)
 * // normalized.groups.byRule["0"] === [0, 1] (rule 0 has results 0, 1)
 * ```
 *
 * @category Normalization
 * @since 0.1.0
 */
export const normalizeResults = (results: readonly RuleResult[]): FindingsGroup => {
  const ruleMap = new Map<string, number>()
  const rules: RuleDef[] = []
  const fileMap = new Map<string, number>()
  const files: string[] = []
  const compact: CompactResult[] = []
  let errors = 0
  let warnings = 0
  let info = 0

  for (const r of results) {
    // Deduplicate rule metadata
    let ri = ruleMap.get(r.id)
    if (ri == null) {
      ri = rules.length
      ruleMap.set(r.id, ri)
      rules.push({
        id: r.id,
        kind: r.ruleKind,
        severity: r.severity,
        message: r.message,
        ...(r.docsUrl && { docsUrl: r.docsUrl }),
        ...(r.tags && r.tags.length > 0 && { tags: [...r.tags] })
      })
    }

    // Deduplicate file paths
    let fi: number | undefined
    if (r.file) {
      fi = fileMap.get(r.file)
      if (fi == null) {
        fi = files.length
        fileMap.set(r.file, fi)
        files.push(r.file)
      }
    }

    // Build compact result with index references
    const cr: CompactResult = {
      rule: ri,
      ...(fi != null && { file: fi }),
      ...(r.range && {
        range: [
          r.range.start.line,
          r.range.start.column,
          r.range.end.line,
          r.range.end.column
        ] as CompactRange
      }),
      // Only store message if it differs from rule.message
      ...(r.message !== rules[ri].message && { message: r.message })
    }

    compact.push(cr)

    // Count errors, warnings, and info
    if (r.severity === "error") errors++
    else if (r.severity === "warning") warnings++
    else info++
  }

  // Create old index to ID/path maps before sorting
  const oldRuleIndexToId = new Map<number, string>(rules.map((r, idx) => [idx, r.id]))
  const oldFileIndexToPath = new Map<number, string>(files.map((f, idx) => [idx, f]))

  // Sort rules and files for deterministic indices
  rules.sort((a, b) => a.id.localeCompare(b.id))
  files.sort((a, b) => a.localeCompare(b))

  // Build new ID/path to index maps for sorted arrays
  const ruleIdToNewIndex = new Map<string, number>(rules.map((r, idx) => [r.id, idx]))
  const pathToNewIndex = new Map<string, number>(files.map((f, idx) => [f, idx]))

  // Remap all result indices to new sorted positions
  const remappedResults: CompactResult[] = compact.map(result => ({
    ...result,
    rule: ruleIdToNewIndex.get(oldRuleIndexToId.get(result.rule)!)!,
    ...(result.file != null && { file: pathToNewIndex.get(oldFileIndexToPath.get(result.file)!)! })
  }))

  // Rebuild groups with new sorted indices
  const byFile: Record<string, number[]> = {}
  const byRule: Record<string, number[]> = {}

  remappedResults.forEach((result, idx) => {
    // Build byRule grouping (all results belong to a rule)
    const sRule = String(result.rule)
    ;(byRule[sRule] ??= []).push(idx)

    // Build byFile grouping (only if result has a file)
    if (result.file != null) {
      const sFile = String(result.file)
      ;(byFile[sFile] ??= []).push(idx)
    }
  })

  return {
    rules,
    files,
    results: remappedResults,
    groups: { byFile, byRule },
    summary: {
      errors,
      warnings,
      info,
      totalFiles: files.length,
      totalFindings: remappedResults.length
    }
  }
}

/**
 * Expand a compact result back into a full RuleResult.
 *
 * This function rehydrates a CompactResult by resolving index references
 * to the original rule and file data.
 *
 * **Reconstruction process:**
 * 1. Look up rule metadata from rules[r.rule]
 * 2. Look up file path from files[r.file] (if present)
 * 3. Use message override if present, otherwise use rule.message
 * 4. Reconstruct Range object from 4-element tuple (if present)
 * 5. Spread optional fields (docsUrl, tags) from rule definition
 *
 * **Range reconstruction:**
 * CompactRange [startLine, startCol, endLine, endCol] becomes:
 * ```typescript
 * {
 *   start: { line: startLine, column: startCol },
 *   end: { line: endLine, column: endCol }
 * }
 * ```
 *
 * @param r - Compact result with index references
 * @param rules - Rule definitions array
 * @param files - File paths array
 * @returns Full RuleResult with resolved references
 *
 * @example
 * ```typescript
 * const compact: CompactResult = {
 *   rule: 0,
 *   file: 0,
 *   range: [10, 5, 10, 20]
 * }
 * const rules: RuleDef[] = [{
 *   id: "no-async-await",
 *   kind: "pattern",
 *   severity: "error",
 *   message: "Use Effect.gen instead of async/await",
 *   docsUrl: "https://effect.website/docs/async"
 * }]
 * const files = ["src/index.ts"]
 *
 * const expanded = expandResult(compact, rules, files)
 * // {
 * //   id: "no-async-await",
 * //   ruleKind: "pattern",
 * //   severity: "error",
 * //   message: "Use Effect.gen instead of async/await",
 * //   file: "src/index.ts",
 * //   range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } },
 * //   docsUrl: "https://effect.website/docs/async"
 * // }
 * ```
 *
 * @category Normalization
 * @since 0.1.0
 */
export const expandResult = (
  r: CompactResult,
  rules: readonly RuleDef[],
  files: readonly string[]
): RuleResult => {
  const rule = rules[r.rule]

  // Build result with conditional optional properties
  const result: RuleResult = {
    id: rule.id,
    ruleKind: rule.kind,
    severity: rule.severity,
    message: r.message ?? rule.message,
    ...(r.file != null && { file: files[r.file] }),
    ...(r.range && {
      range: {
        start: { line: r.range[0], column: r.range[1] },
        end: { line: r.range[2], column: r.range[3] }
      }
    }),
    ...(rule.docsUrl && { docsUrl: rule.docsUrl }),
    ...(rule.tags && rule.tags.length > 0 && { tags: [...rule.tags] })
  }

  return result
}

/**
 * Generate stable key for a result within a checkpoint.
 *
 * Used for cross-checkpoint delta computation. Keys are stable across
 * checkpoints even when rule/file indices change.
 *
 * Format: "ruleId|filePath|startLine:startCol-endLine:endCol|message"
 *
 * @param result - Compact result
 * @param rules - Rules array (to resolve rule index)
 * @param files - Files array (to resolve file index)
 * @returns Stable key string
 *
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const key = deriveResultKey(
 *   { rule: 0, file: 1, range: [10, 5, 10, 20] },
 *   rules,
 *   files
 * )
 * // "no-async|src/index.ts|10:5-10:20|Use Effect.gen"
 * ```
 *
 * @category Normalization
 */
export const deriveResultKey = (
  result: CompactResult,
  rules: readonly RuleDef[],
  files: readonly string[]
): string => {
  const rule = rules[result.rule]
  const filePath = result.file !== undefined ? files[result.file] : ""
  const rangeStr = result.range
    ? `${result.range[0]}:${result.range[1]}-${result.range[2]}:${result.range[3]}`
    : ""
  const message = result.message ?? rule.message

  return `${rule.id}|${filePath}|${rangeStr}|${message}`
}

/**
 * Derive stable keys for all results in a FindingsGroup.
 *
 * Returns a Map for O(1) lookup when computing deltas.
 *
 * @param findings - Normalized findings
 * @returns Map of result index to stable key
 *
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const keyMap = deriveResultKeys(findings)
 * const key0 = keyMap.get(0) // Stable key for first result
 * ```
 *
 * @category Normalization
 */
export const deriveResultKeys = (findings: FindingsGroup): Map<number, string> => {
  const keyMap = new Map<number, string>()

  findings.results.forEach((result, idx) => {
    const key = deriveResultKey(result, findings.rules, findings.files)
    keyMap.set(idx, key)
  })

  return keyMap
}

/**
 * Rebuild groups from results array.
 *
 * Reconstructs the groups.byFile and groups.byRule indices from results[].
 * Useful when groups were omitted from FindingsGroup to save space.
 *
 * @param findings - Normalized findings
 * @returns Groups object with byFile and byRule indices
 *
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const findings: FindingsGroup = {
 *   rules: [...],
 *   files: [...],
 *   results: [...],
 *   summary: {...}
 *   // groups omitted
 * }
 * const groups = rebuildGroups(findings)
 * // groups.byFile["0"] = [0, 1, 2]
 * // groups.byRule["0"] = [0, 2]
 * ```
 *
 * @category Normalization
 */
export const rebuildGroups = (findings: FindingsGroup): NonNullable<FindingsGroup["groups"]> => {
  const byFile: Record<string, number[]> = {}
  const byRule: Record<string, number[]> = {}

  findings.results.forEach((result, idx) => {
    // Build byRule grouping (all results belong to a rule)
    const sRule = String(result.rule)
    ;(byRule[sRule] ??= []).push(idx)

    // Build byFile grouping (only if result has a file)
    if (result.file != null) {
      const sFile = String(result.file)
      ;(byFile[sFile] ??= []).push(idx)
    }
  })

  return { byFile, byRule }
}
