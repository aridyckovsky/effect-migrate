/**
 * Rule Helpers - Factory functions for creating common rule types
 *
 * This module provides helper functions for creating pattern-based and
 * boundary-based rules without implementing the Rule interface manually.
 *
 * @module @effect-migrate/core/rules/helpers
 * @since 0.1.0
 */

import * as Effect from "effect/Effect"
import type { Severity } from "../types.js"
import type { Rule, RuleContext, RuleResult } from "./types.js"

/**
 * Input configuration for creating a pattern-based rule.
 *
 * Pattern rules search files using regex patterns and report matches.
 *
 * @category Rule Factory
 * @since 0.1.0
 */
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

/**
 * Create a pattern-based rule that searches files using regex.
 *
 * Pattern rules match code patterns and report violations at each match location.
 * Supports negative patterns to exclude false positives.
 *
 * @param input - Rule configuration
 * @returns Executable Rule instance
 *
 * @category Rule Factory
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const rule = makePatternRule({
 *   id: "no-async-await",
 *   files: "src/**\/*.ts",
 *   pattern: /async\s+function/g,
 *   negativePattern: /Effect\.gen/,  // Exclude if Effect.gen present
 *   message: "Use Effect.gen instead of async/await",
 *   severity: "warning",
 *   docsUrl: "https://effect.website/docs/gen",
 *   tags: ["migration", "async"]
 * })
 * ```
 */
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

/**
 * Input configuration for creating a boundary rule.
 *
 * Boundary rules enforce architectural constraints by disallowing
 * imports from certain files/patterns.
 *
 * @category Rule Factory
 * @since 0.1.0
 */
export interface MakeBoundaryRuleInput {
  id: string
  from: string
  disallow: string[]
  message: string
  severity: Severity
  docsUrl?: string
  tags?: string[]
}

/**
 * Create a boundary rule that enforces architectural constraints.
 *
 * Boundary rules build an import graph and report violations when files
 * in the `from` pattern import modules matching `disallow` patterns.
 *
 * @param input - Rule configuration
 * @returns Executable Rule instance
 *
 * @category Rule Factory
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const rule = makeBoundaryRule({
 *   id: "no-ui-in-core",
 *   from: "src/core/**\/*.ts",
 *   disallow: ["react", "src/ui/**"],
 *   message: "Core modules cannot import UI code",
 *   severity: "error",
 *   docsUrl: "https://docs.example.com/architecture",
 *   tags: ["architecture", "boundary"]
 * })
 * ```
 */
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
