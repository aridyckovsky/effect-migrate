export type Severity = "error" | "warning"

export interface Location {
  line: number
  column: number
  text: string
}

export interface Range {
  start: { line: number; column: number }
  end: { line: number; column: number }
}

export interface Finding {
  id: string
  file: string
  message: string
  severity: Severity
  locations?: Location[]
}

export interface Violation extends Finding {
  ruleId: string
}

export interface Metric {
  id: string
  description: string
  current: number
  target?: number
  status: "migrated" | "in-progress" | "pending"
}
