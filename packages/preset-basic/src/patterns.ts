import type { Rule, RuleResult } from "@effect-migrate/core"
import * as Effect from "effect/Effect"

const noAsyncAwait: Rule = {
  id: "no-async-await",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        const pattern = /\basync\s+(function\s+\w+|(\([^)]*\)|[\w]+)\s*=>)/g

        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const index = match.index
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          results.push({
            id: "no-async-await",
            ruleKind: "pattern",
            message: "Replace async/await with Effect.gen for composable async operations",
            severity: "warning",
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            }
          })
        }
      }

      return results
    })
}

const noPromiseConstructor: Rule = {
  id: "no-promise-constructor",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        const pattern = /new\s+Promise\s*</g

        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const index = match.index
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          results.push({
            id: "no-promise-constructor",
            ruleKind: "pattern",
            message: "Replace new Promise() with Effect.async or Effect.tryPromise",
            severity: "warning",
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            }
          })
        }
      }

      return results
    })
}

const noTryCatch: Rule = {
  id: "no-try-catch",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        const pattern = /\btry\s*\{/g

        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const index = match.index
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          results.push({
            id: "no-try-catch",
            ruleKind: "pattern",
            message: "Replace try/catch with Effect.catchAll or Effect.tryPromise",
            severity: "warning",
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            }
          })
        }
      }

      return results
    })
}

export const patternRules: Rule[] = [noAsyncAwait, noPromiseConstructor, noTryCatch]
