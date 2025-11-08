/**
 * Console Formatter - Human-readable audit output with colors and icons
 *
 * This module formats audit results for terminal display using chalk for
 * colorization and Unicode icons for visual clarity. Output is grouped by
 * file with severity-based styling and includes project-level issues.
 *
 * @module @effect-migrate/cli/formatters/console
 * @since 0.1.0
 */

import type { RuleResult } from "@effect-migrate/core"
import type { Config } from "@effect-migrate/core"
import chalk from "chalk"

/**
 * Format audit results for human-readable console output.
 *
 * Produces colorized, icon-rich output grouped by file with:
 * - Project-level issues (no associated file)
 * - File-level issues with location and suggestions
 * - Summary statistics (errors, warnings, total)
 *
 * @param results - Array of rule violation results from audit
 * @param config - Migration configuration (currently unused but reserved for future formatting options)
 * @returns Formatted string ready for console display
 *
 * @category Formatter
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const output = formatConsoleOutput(results, config)
 * console.log(output)
 * // Displays:
 * // ════════════════════════════════════════════════════════════
 * //   AUDIT RESULTS
 * // ════════════════════════════════════════════════════════════
 * //
 * // 📄 src/api/users.ts
 * //   ❌ [async-await-to-effect] Convert async/await to Effect.gen
 * //      Line 42:5
 * //      💡 Use Effect.gen instead of async/await
 * //      📖 https://effect.website/docs/gen
 * // ...
 * ```
 */
export const formatConsoleOutput = (results: RuleResult[], config: Config): string => {
  if (results.length === 0) {
    return `
${chalk.green.bold("✅ No issues found!")}

${chalk.green("All checks passed successfully.")}
`
  }

  // Group by file
  const byFile = new Map<string, RuleResult[]>()
  const projectLevel: RuleResult[] = []

  for (const result of results) {
    if (result.file) {
      const fileResults = byFile.get(result.file) ?? []
      fileResults.push(result)
      byFile.set(result.file, fileResults)
    } else {
      projectLevel.push(result)
    }
  }

  const lines: string[] = []
  lines.push("")
  lines.push(chalk.cyan("═".repeat(60)))
  lines.push(chalk.bold.cyan("  AUDIT RESULTS"))
  lines.push(chalk.cyan("═".repeat(60)))
  lines.push("")

  // Project-level issues
  if (projectLevel.length > 0) {
    lines.push(chalk.bold("📋 Project Issues:"))
    for (const result of projectLevel) {
      const icon = result.severity === "error" ? chalk.red("❌") : chalk.yellow("⚠️ ")
      const ruleId = chalk.gray(`[${result.id}]`)
      lines.push(`  ${icon} ${ruleId} ${result.message}`)
      if (result.docsUrl) {
        lines.push(chalk.blue(`     📖 ${result.docsUrl}`))
      }
    }
    lines.push("")
  }

  // File-level issues
  const sortedFiles = Array.from(byFile.keys()).sort()
  for (const file of sortedFiles) {
    const fileResults = byFile.get(file)!
    lines.push(chalk.bold(`📄 ${file}`))

    for (const result of fileResults) {
      const icon = result.severity === "error" ? chalk.red("❌") : chalk.yellow("⚠️ ")
      const ruleId = chalk.gray(`[${result.id}]`)
      const location = result.range
        ? `Line ${result.range.start.line}:${result.range.start.column}`
        : result.locations?.[0]
        ? `Line ${result.locations[0].line}`
        : ""

      lines.push(`  ${icon} ${ruleId} ${result.message}`)
      if (location) {
        lines.push(chalk.dim(`     ${location}`))
      }
      if (result.locations?.[0]?.text) {
        lines.push(chalk.dim(`     ${result.locations[0].text.substring(0, 80)}`))
      }
      if (result.suggestion) {
        lines.push(chalk.cyan(`     💡 ${result.suggestion}`))
      }
      if (result.docsUrl) {
        lines.push(chalk.blue(`     📖 ${result.docsUrl}`))
      }
    }
    lines.push("")
  }

  // Summary
  const errors = results.filter(r => r.severity === "error")
  const warnings = results.filter(r => r.severity === "warning")
  const info = results.filter(r => r.severity === "info")

  lines.push(chalk.cyan("─".repeat(60)))
  lines.push(chalk.bold.cyan("  SUMMARY"))
  lines.push(chalk.cyan("─".repeat(60)))

  const errorsDisplay = errors.length > 0
    ? chalk.red(errors.length.toString())
    : chalk.green(errors.length.toString())
  const warningsDisplay = warnings.length > 0
    ? chalk.yellow(warnings.length.toString())
    : chalk.green(warnings.length.toString())
  const infoDisplay = info.length > 0
    ? chalk.blue(info.length.toString())
    : chalk.green(info.length.toString())

  lines.push(`  Errors:   ${errorsDisplay}`)
  lines.push(`  Warnings: ${warningsDisplay}`)
  lines.push(`  Info:     ${infoDisplay}`)
  lines.push(`  Total:    ${results.length}`)
  lines.push("")

  return lines.join("\n")
}
