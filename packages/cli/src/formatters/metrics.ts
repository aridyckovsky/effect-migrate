import type { RuleResult } from "@effect-migrate/core"
import chalk from "chalk"
import Table from "cli-table3"

export interface MetricsData {
  totalIssues: number
  errors: number
  warnings: number
  filesWithIssues: number
  ruleBreakdown: Array<{ id: string; count: number; severity: string }>
}

export const calculateMetrics = (results: RuleResult[]): MetricsData => {
  const totalIssues = results.length
  const errors = results.filter(r => r.severity === "error").length
  const warnings = results.filter(r => r.severity === "warning").length
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
    filesWithIssues,
    ruleBreakdown
  }
}

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
        : chalk.yellow.bold("WARNING")

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
