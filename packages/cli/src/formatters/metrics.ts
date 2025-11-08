/**
 * Metrics Formatter - Migration progress dashboard with tables and progress bars
 *
 * This module calculates and formats migration metrics for terminal display,
 * including rule breakdown tables, progress bars, and completion status.
 * Uses cli-table3 for rich table formatting and chalk for colorization.
 *
 * @module @effect-migrate/cli/formatters/metrics
 * @since 0.1.0
 */

import type { RuleResult } from "@effect-migrate/core"
import chalk from "chalk"
import Table from "cli-table3"

/**
 * Aggregated metrics data for migration progress tracking.
 *
 * Contains summary statistics and per-rule breakdown for migration violations.
 *
 * @category Schema
 * @since 0.1.0
 */
export interface MetricsData {
  /** Total count of all violations */
  totalIssues: number
  /** Count of error-severity violations */
  errors: number
  /** Count of warning-severity violations */
  warnings: number
  /** Count of info-severity violations */
  info: number
  /** Count of unique files with violations */
  filesWithIssues: number
  /** Per-rule breakdown sorted by violation count descending */
  ruleBreakdown: Array<{ id: string; count: number; severity: string }>
}

/**
 * Calculate migration metrics from audit results.
 *
 * Aggregates rule violations into summary statistics and per-rule breakdowns.
 * Rule breakdown is sorted by violation count descending (most violations first).
 *
 * @param results - Array of rule violation results from audit
 * @returns Aggregated metrics data
 *
 * @category Calculator
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const metrics = calculateMetrics(results)
 * // metrics = {
 * //   totalIssues: 15,
 * //   errors: 10,
 * //   warnings: 5,
 * //   filesWithIssues: 3,
 * //   ruleBreakdown: [
 * //     { id: "async-await-to-effect", count: 8, severity: "error" },
 * //     { id: "promise-to-effect", count: 7, severity: "warning" }
 * //   ]
 * // }
 * ```
 */
export const calculateMetrics = (results: RuleResult[]): MetricsData => {
  const totalIssues = results.length
  const errors = results.filter(r => r.severity === "error").length
  const warnings = results.filter(r => r.severity === "warning").length
  const info = results.filter(r => r.severity === "info").length
  const filesWithIssues = new Set(results.map(r => r.file).filter(Boolean)).size

  // Calculate rule breakdown
  const ruleMap = new Map<string, { count: number; severity: string }>()
  for (const result of results) {
    const existing = ruleMap.get(result.id)
    if (existing) {
      existing.count++
    } else {
      ruleMap.set(result.id, { count: 1, severity: result.severity })
    }
  }

  const ruleBreakdown = Array.from(ruleMap.entries())
    .map(([id, data]) => ({ id, count: data.count, severity: data.severity }))
    .sort((a, b) => b.count - a.count)

  return {
    totalIssues,
    errors,
    warnings,
    info,
    filesWithIssues,
    ruleBreakdown
  }
}

/**
 * Format metrics data as a rich terminal dashboard.
 *
 * Produces a colorized dashboard with:
 * - Header banner with title
 * - Summary metrics table (violations, errors, warnings, files affected)
 * - Progress bar showing completion percentage
 * - Rule breakdown table (top 10 rules by violation count)
 * - Next steps recommendations
 *
 * Uses color coding: green (complete), yellow (in progress), red (pending).
 *
 * @param data - Aggregated metrics data from calculateMetrics
 * @returns Formatted dashboard string ready for console display
 *
 * @category Formatter
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const metrics = calculateMetrics(results)
 * const dashboard = formatMetricsOutput(metrics)
 * console.log(dashboard)
 * // Displays:
 * // ╔═══════════════════════════════════════════════════════════╗
 * // ║          📊 MIGRATION METRICS DASHBOARD                   ║
 * // ╚═══════════════════════════════════════════════════════════╝
 * //
 * // ┌────────────────────────────┬────────────┬────────────┬───────────────┐
 * // │ Metric                     │ Current    │ Target     │ Status        │
 * // ├────────────────────────────┼────────────┼────────────┼───────────────┤
 * // │ Total Violations           │ 15         │ 0          │ ○ Pending     │
 * // │ Error-level Issues         │ 10         │ 0          │ ○ Pending     │
 * // ...
 * ```
 */
export const formatMetricsOutput = (data: MetricsData): string => {
  const lines: string[] = []

  // Header
  lines.push("")
  lines.push(chalk.bold.cyan("╔═══════════════════════════════════════════════════════════╗"))
  lines.push(
    chalk.bold.cyan("║") +
      chalk.bold.white("          📊 MIGRATION METRICS DASHBOARD                 ") +
      chalk.bold.cyan("║")
  )
  lines.push(chalk.bold.cyan("╚═══════════════════════════════════════════════════════════╝"))
  lines.push("")

  // Summary metrics table
  const summaryTable = new Table({
    head: [chalk.bold("Metric"), chalk.bold("Current"), chalk.bold("Target"), chalk.bold("Status")],
    colWidths: [30, 12, 12, 15],
    style: {
      head: [],
      border: ["cyan"]
    }
  })

  const metrics: Array<{ label: string; current: number; target: number }> = [
    { label: "Total Violations", current: data.totalIssues, target: 0 },
    { label: "Error-level Issues", current: data.errors, target: 0 },
    { label: "Warning-level Issues", current: data.warnings, target: 0 },
    { label: "Info-level Issues", current: data.info, target: 0 },
    { label: "Files Affected", current: data.filesWithIssues, target: 0 }
  ]

  for (const metric of metrics) {
    const statusIcon = metric.current === 0
      ? chalk.green("✓ Complete")
      : metric.current < 10
      ? chalk.yellow("⚠ In Progress")
      : chalk.red("○ Pending")

    const currentDisplay = metric.current === 0
      ? chalk.green(metric.current.toString())
      : metric.current > 20
      ? chalk.red(metric.current.toString())
      : chalk.yellow(metric.current.toString())

    summaryTable.push([metric.label, currentDisplay, metric.target.toString(), statusIcon])
  }

  lines.push(summaryTable.toString())
  lines.push("")

  // Progress bar
  if (data.totalIssues > 0) {
    const maxIssues = Math.max(data.totalIssues, 50)
    const completionPercent = Math.max(0, ((maxIssues - data.totalIssues) / maxIssues) * 100)
    const progressWidth = 50
    const filledWidth = Math.round((completionPercent / 100) * progressWidth)
    const emptyWidth = progressWidth - filledWidth

    const progressBar = chalk.green("█".repeat(filledWidth)) + chalk.gray("░".repeat(emptyWidth))

    lines.push(chalk.bold("  Migration Progress:"))
    lines.push(`  [${progressBar}] ${Math.round(completionPercent)}%`)
    lines.push("")
  }

  // Rule breakdown table
  if (data.ruleBreakdown.length > 0) {
    lines.push(chalk.bold.cyan("  Rule Breakdown:"))
    lines.push("")

    const ruleTable = new Table({
      head: [chalk.bold("Rule ID"), chalk.bold("Violations"), chalk.bold("Severity")],
      colWidths: [45, 15, 15],
      style: {
        head: [],
        border: ["cyan"]
      }
    })

    for (const rule of data.ruleBreakdown.slice(0, 10)) {
      const severityBadge = rule.severity === "error"
        ? chalk.red.bold("ERROR  ")
        : rule.severity === "warning"
        ? chalk.yellow.bold("WARNING")
        : chalk.blue.bold("INFO   ")

      const countDisplay = rule.count > 10
        ? chalk.red(rule.count.toString())
        : chalk.yellow(rule.count.toString())

      ruleTable.push([rule.id, countDisplay, severityBadge])
    }

    lines.push(ruleTable.toString())

    if (data.ruleBreakdown.length > 10) {
      lines.push("")
      lines.push(
        chalk.gray(
          `  ... and ${data.ruleBreakdown.length - 10} more rule${
            data.ruleBreakdown.length - 10 === 1 ? "" : "s"
          }`
        )
      )
    }
  }

  lines.push("")

  // Footer recommendations
  if (data.totalIssues > 0) {
    lines.push(chalk.bold("  💡 Next Steps:"))
    lines.push("")

    if (data.errors > 0) {
      lines.push(
        chalk.red(
          `  • Fix ${data.errors} error-level violation${data.errors === 1 ? "" : "s"} first`
        )
      )
    }

    if (data.warnings > 0) {
      lines.push(
        chalk.yellow(
          `  • Address ${data.warnings} warning${
            data.warnings === 1 ? "" : "s"
          } to complete migration`
        )
      )
    }

    lines.push(chalk.cyan(`  • Run ${chalk.bold("effect-migrate audit")} for detailed locations`))
    lines.push("")
  } else {
    lines.push(chalk.green.bold("  🎉 Migration Complete!"))
    lines.push(chalk.green("  All rules are passing. Great work!"))
    lines.push("")
  }

  return lines.join("\n")
}
