import type { RuleResult } from "@effect-migrate/core"
import type { Config } from "@effect-migrate/core"

export interface AuditJsonOutput {
  version: number
  toolVersion: string
  timestamp: string
  findings: {
    byFile: Record<string, RuleResult[]>
    summary: {
      errors: number
      warnings: number
      totalFiles: number
      totalFindings: number
    }
  }
}

export const formatJsonOutput = (results: RuleResult[], config: Config): AuditJsonOutput => {
  const byFile: Record<string, RuleResult[]> = {}

  for (const result of results) {
    if (result.file) {
      if (!byFile[result.file]) {
        byFile[result.file] = []
      }
      byFile[result.file].push(result)
    }
  }

  const errors = results.filter(r => r.severity === "error").length
  const warnings = results.filter(r => r.severity === "warning").length
  const totalFiles = Object.keys(byFile).length

  return {
    version: 1,
    toolVersion: "0.1.0",
    timestamp: new Date().toISOString(),
    findings: {
      byFile,
      summary: {
        errors,
        warnings,
        totalFiles,
        totalFindings: results.length
      }
    }
  }
}
