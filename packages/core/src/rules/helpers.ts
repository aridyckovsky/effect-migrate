import * as Effect from "effect/Effect"
import type { Severity } from "../types.js"
import type { Rule, RuleContext, RuleResult } from "./types.js"

export interface MakePatternRuleInput {
  id: string
  files: string | string[]
  pattern: RegExp | string
  negativePattern?: RegExp | string
  message: string
  severity: Severity
  docsUrl?: string
  tags?: string[]
}

export const makePatternRule = (input: MakePatternRuleInput): Rule => ({
  id: input.id,
  kind: "pattern",
  run: (ctx: RuleContext) =>
    Effect.gen(function*() {
      const globs = Array.isArray(input.files) ? input.files : [input.files]
      const files = yield* ctx.listFiles(globs)

      const pattern = typeof input.pattern === "string"
        ? new RegExp(input.pattern, "gm")
        : input.pattern

      const negativePattern = input.negativePattern
        ? typeof input.negativePattern === "string"
          ? new RegExp(input.negativePattern, "gm")
          : input.negativePattern
        : null

      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)

        if (negativePattern && negativePattern.test(content)) {
          continue
        }

        const matches = Array.from(content.matchAll(pattern))

        if (matches.length > 0) {
          for (const match of matches) {
            const index = match.index ?? 0
            const beforeMatch = content.substring(0, index)
            const line = beforeMatch.split("\n").length
            const column = index - beforeMatch.lastIndexOf("\n")

            const result: RuleResult = {
              id: input.id,
              ruleKind: "pattern",
              message: input.message,
              severity: input.severity,
              file
            }
            result.range = {
              start: { line, column },
              end: { line, column: column + match[0].length }
            }
            result.locations = [
              {
                line,
                column,
                text: match[0]
              }
            ]
            if (input.docsUrl !== undefined) result.docsUrl = input.docsUrl
            if (input.tags !== undefined) result.tags = input.tags
            results.push(result)
          }
        }
      }

      return results
    })
})

export interface MakeBoundaryRuleInput {
  id: string
  from: string
  disallow: string[]
  message: string
  severity: Severity
  docsUrl?: string
  tags?: string[]
}

export const makeBoundaryRule = (input: MakeBoundaryRuleInput): Rule => ({
  id: input.id,
  kind: "boundary",
  run: (ctx: RuleContext) =>
    Effect.gen(function*() {
      const importIndex = yield* ctx.getImportIndex()
      const files = yield* ctx.listFiles([input.from])

      const results: RuleResult[] = []

      for (const file of files) {
        const imports = yield* importIndex.getImports(file)

        for (const importPath of imports) {
          const isDisallowed = input.disallow.some(pattern => {
            const regex = new RegExp(pattern.replace("*", ".*"))
            return regex.test(importPath)
          })

          if (isDisallowed) {
            const content = yield* ctx.readFile(file)
            // Strip pkg: prefix when searching in file content
            const searchPath = importPath.startsWith("pkg:")
              ? importPath.slice(4)
              : importPath

            let lineNumber = 1
            for (const line of content.split("\n")) {
              if (line.includes(searchPath)) {
                const result: RuleResult = {
                  id: input.id,
                  ruleKind: "boundary",
                  message: `${input.message}: Found import of "${importPath}"`,
                  severity: input.severity,
                  file
                }
                result.range = {
                  start: { line: lineNumber, column: 1 },
                  end: { line: lineNumber, column: line.length }
                }
                result.locations = [
                  {
                    line: lineNumber,
                    column: 1,
                    text: line.trim()
                  }
                ]
                if (input.docsUrl !== undefined) result.docsUrl = input.docsUrl
                if (input.tags !== undefined) result.tags = input.tags
                results.push(result)
                break
              }
              lineNumber++
            }
          }
        }
      }

      return results
    })
})
