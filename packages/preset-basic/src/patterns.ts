/**
 * Pattern Rules - Detect anti-patterns in Effect migration
 *
 * This module provides pattern-based rules that detect common JavaScript/TypeScript
 * patterns that should be migrated to Effect equivalents for better composability
 * and type safety.
 *
 * @module @effect-migrate/preset-basic/patterns
 * @since 0.3.0
 */

import type { Rule, RuleResult } from "@effect-migrate/core"
import * as Effect from "effect/Effect"
import { findMatchingBrace } from "./helpers.js"

/**
 * Detects async/await patterns in JavaScript/TypeScript code.
 *
 * This rule identifies async function declarations, async arrow functions, and async methods,
 * suggesting migration to Effect.gen for better composability, type-safe error handling,
 * and interruption support.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - async/await
 * async function fetchUser(id: string) {
 *   const response = await fetch(`/users/${id}`)
 *   return response.json()
 * }
 *
 * // ✅ Good - Effect.gen
 * const fetchUser = (id: string) =>
 *   Effect.gen(function* () {
 *     const response = yield* Effect.tryPromise(() => fetch(`/users/${id}`))
 *     const data = yield* Effect.tryPromise(() => response.json())
 *     return data
 *   })
 * ```
 *
 * @see https://effect.website/docs/guides/essentials/creating-effects
 */
export const noAsyncAwait: Rule = {
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

/**
 * Detects `new Promise()` constructor usage.
 *
 * This rule identifies Promise constructor calls and suggests using Effect.async or
 * Effect.promise for better integration with Effect's ecosystem.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - Promise constructor
 * const delayed = new Promise<number>((resolve) => {
 *   setTimeout(() => resolve(42), 1000)
 * })
 *
 * // ✅ Good - Effect.async
 * const delayed = Effect.async<number>((resume) => {
 *   const id = setTimeout(() => resume(Effect.succeed(42)), 1000)
 *   return Effect.sync(() => clearTimeout(id))
 * })
 * ```
 *
 * @see https://effect.website/docs/guides/essentials/creating-effects#from-async-callback
 */
export const noNewPromise: Rule = {
  id: "no-new-promise",
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
            id: "no-new-promise",
            ruleKind: "pattern",
            message: "Use Effect.async() or Effect.promise() instead of new Promise()",
            severity: "warning",
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            },
            tags: ["effect", "async"]
          })
        }
      }

      return results
    })
}

/**
 * Detects try/catch blocks in code.
 *
 * This rule identifies try/catch blocks and suggests using Effect's error handling
 * combinators (catchAll, catchTag, catchTags) for type-safe, composable error handling.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - try/catch
 * try {
 *   const data = JSON.parse(input)
 *   return data
 * } catch (error) {
 *   return defaultValue
 * }
 *
 * // ✅ Good - Effect.catchAll
 * Effect.gen(function* () {
 *   const data = yield* Effect.try(() => JSON.parse(input))
 *   return data
 * }).pipe(
 *   Effect.catchAll(() => Effect.succeed(defaultValue))
 * )
 * ```
 *
 * @see https://effect.website/docs/guides/error-management/expected-errors
 */
export const noTryCatch: Rule = {
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
            message: "Use Effect.catchAll() or Effect.catchTag() instead of try/catch",
            severity: "warning",
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            },
            tags: ["effect", "error-handling"]
          })
        }
      }

      return results
    })
}

/**
 * Detects barrel imports from "effect" package.
 *
 * This rule identifies imports from the "effect" barrel module and suggests importing
 * from specific modules (effect/Effect, effect/Console, etc.) for better tree-shaking
 * and smaller bundle sizes.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - barrel import
 * import { Effect, Console, pipe } from "effect"
 *
 * // ✅ Good - specific imports
 * import * as Effect from "effect/Effect"
 * import * as Console from "effect/Console"
 * import { pipe } from "effect/Function"
 * ```
 *
 * @see https://effect.website/docs/guides/essentials/importing
 */
export const noBarrelImport: Rule = {
  id: "no-barrel-import-effect",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        const pattern = /import\s+\{[^}]+\}\s+from\s+['"]effect['"]/g

        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const index = match.index
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          results.push({
            id: "no-barrel-import-effect",
            ruleKind: "pattern",
            message: "Import from 'effect/Effect', 'effect/Console', etc. for tree-shaking",
            severity: "warning",
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            },
            tags: ["effect", "imports"]
          })
        }
      }

      return results
    })
}

/**
 * Detects fs/promises imports.
 *
 * This rule identifies imports from Node.js fs/promises module and suggests using
 * @effect/platform FileSystem service for resource safety, composability, and
 * cross-platform compatibility.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - fs/promises
 * import { readFile, writeFile } from "fs/promises"
 * const content = await readFile("file.txt", "utf-8")
 *
 * // ✅ Good - @effect/platform FileSystem
 * import { FileSystem } from "@effect/platform"
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const content = yield* fs.readFileString("file.txt")
 *   return content
 * })
 * ```
 *
 * @see https://effect.website/docs/guides/platform/file-system
 */
export const noFsPromises: Rule = {
  id: "no-fs-promises",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        const pattern = /from\s+['"]fs\/promises['"]/g

        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const index = match.index
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          results.push({
            id: "no-fs-promises",
            ruleKind: "pattern",
            message: "Use @effect/platform FileSystem service instead of fs/promises",
            severity: "warning",
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            },
            tags: ["platform", "filesystem"]
          })
        }
      }

      return results
    })
}

/**
 * Detects unhandled Effect values (potential logic errors).
 *
 * This rule identifies Effect expressions that are created but not used, which
 * typically indicates a logic error (forgotten yield* or missing execution).
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - Effect created but not used
 * Effect.gen(function* () {
 *   Effect.log("This won't run!") // Missing yield*
 *   return 42
 * })
 *
 * // ✅ Good - Effect properly yielded
 * Effect.gen(function* () {
 *   yield* Effect.log("This will run")
 *   return 42
 * })
 * ```
 *
 * @see https://effect.website/docs/guides/essentials/effect-gen
 */
export const noUnhandledEffect: Rule = {
  id: "no-unhandled-effect",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        const lines = content.split("\n")

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]

          // Check for Effect.* calls on this line (not in comments)
          const effectCallPattern = /Effect\.\w+\(/g
          let match: RegExpExecArray | null

          while ((match = effectCallPattern.exec(line)) !== null) {
            const beforeEffect = line.substring(0, match.index).trim()

            // Skip if preceded by yield*, return, or assignment operators
            if (/yield\*\s*$|return\s*$|=\s*$|const\s+\w+\s*=$|let\s+\w+\s*=$|var\s+\w+\s*=$/.test(beforeEffect)) {
              continue
            }

            // Skip comments
            if (/\/\//.test(beforeEffect)) {
              continue
            }

            // Skip Effect.gen calls (they define effects, not execute them)
            if (match[0].startsWith("Effect.gen(")) {
              continue
            }

            // Found unhandled Effect call
            results.push({
              id: "no-unhandled-effect",
              ruleKind: "pattern",
              message: "Effect value created but not used. Did you forget 'yield*'?",
              severity: "error",
              file,
              range: {
                start: { line: i + 1, column: match.index + 1 },
                end: { line: i + 1, column: match.index + match[0].length + 1 }
              },
              tags: ["effect", "correctness"]
            })
          }
        }
      }

      return results
    })
}

/**
 * Detects Effect.runPromise at module top-level.
 *
 * This rule identifies Effect.runPromise calls at module scope, which can cause
 * initialization side-effects and make testing difficult. Effects should be composed
 * and run at application entry points only.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - runPromise at module level
 * const data = await Effect.runPromise(loadConfig())
 *
 * // ✅ Good - export Effect, run at entry point
 * export const loadConfigEffect = loadConfig()
 * // In main.ts:
 * Effect.runPromise(loadConfigEffect)
 * ```
 *
 * @see https://effect.website/docs/guides/essentials/running-effects
 */
export const noRunPromiseToplevel: Rule = {
  id: "no-runpromise-toplevel",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        // Detect runPromise outside of functions
        const lines = content.split("\n")
        let inFunction = 0

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]

          // Track function depth
          if (/function\s+\w+|=>\s*\{|^\s*\w+\s*\([^)]*\)\s*\{/.test(line)) {
            inFunction++
          }
          if (line.includes("}")) {
            inFunction = Math.max(0, inFunction - 1)
          }

          // Check for runPromise at top level
          if (inFunction === 0 && /Effect\.runPromise|Effect\.runSync|Effect\.runFork/.test(line)) {
            const column = line.indexOf("Effect.run") + 1

            results.push({
              id: "no-runpromise-toplevel",
              ruleKind: "pattern",
              message:
                "Don't run Effects at module level. Export the Effect and run at application entry.",
              severity: "error",
              file,
              range: {
                start: { line: i + 1, column },
                end: { line: i + 1, column: column + 20 }
              },
              tags: ["effect", "architecture"]
            })
          }
        }
      }

      return results
    })
}

/**
 * Detects usage of `any` type.
 *
 * This rule identifies the `any` type in TypeScript code, which defeats type safety.
 * Effect's type system provides better alternatives like `unknown` or proper type parameters.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - any type
 * function process(data: any) {
 *   return data.value
 * }
 *
 * // ✅ Good - unknown with validation
 * function process(data: unknown) {
 *   return Effect.gen(function* () {
 *     const validated = yield* Schema.decodeUnknown(MySchema)(data)
 *     return validated.value
 *   })
 * }
 * ```
 *
 * @see https://effect.website/docs/guides/schema/introduction
 */
export const noAnyType: Rule = {
  id: "no-any-type",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        // Detect : any or <any> but not in comments
        const pattern = /:\s*any\b|<any>/g

        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const index = match.index
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          // Skip if in comment
          const currentLine = content.split("\n")[line - 1]
          if (!currentLine.trim().startsWith("//") && !currentLine.includes("/*")) {
            results.push({
              id: "no-any-type",
              ruleKind: "pattern",
              message: "Avoid 'any' type. Use 'unknown' with Schema validation for type safety.",
              severity: "warning",
              file,
              range: {
                start: { line, column },
                end: { line, column: column + match[0].length }
              },
              tags: ["typescript", "type-safety"]
            })
          }
        }
      }

      return results
    })
}

/**
 * Detects Effect.succeed in catchAll handlers.
 *
 * This rule identifies Effect.succeed being used in catchAll handlers, which often
 * indicates error swallowing. Consider whether the error should truly be converted
 * to success or if a default value should be used differently.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Questionable - error swallowed
 * effect.pipe(
 *   Effect.catchAll(() => Effect.succeed(null))
 * )
 *
 * // ✅ Better - explicit default handling
 * effect.pipe(
 *   Effect.catchAll((error) =>
 *     Effect.gen(function* () {
 *       yield* Effect.logWarning(`Using default due to: ${error}`)
 *       return defaultValue
 *     })
 *   )
 * )
 * ```
 *
 * @see https://effect.website/docs/guides/error-management/expected-errors
 */
export const noEffectCatchAllSuccess: Rule = {
  id: "no-effect-catchall-success",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        // Detect catchAll with Effect.succeed (using dotall to match across lines)
        const pattern = /catchAll\(\s*\([^)]*\)\s*=>\s*Effect\.succeed/gs

        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const index = match.index
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          results.push({
            id: "no-effect-catchall-success",
            ruleKind: "pattern",
            message:
              "Effect.succeed in catchAll may swallow errors. Consider logging or using Option.",
            severity: "warning",
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            },
            tags: ["effect", "error-handling"]
          })
        }
      }

      return results
    })
}

/**
 * Detects try/catch inside Effect.gen.
 *
 * This rule identifies try/catch blocks inside Effect.gen, which bypasses Effect's
 * type-safe error handling. Use Effect.try or Effect.tryPromise instead.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - try/catch in Effect.gen
 * Effect.gen(function* () {
 *   try {
 *     const data = JSON.parse(input)
 *     return data
 *   } catch (e) {
 *     return null
 *   }
 * })
 *
 * // ✅ Good - Effect.try with catchAll
 * Effect.gen(function* () {
 *   const data = yield* Effect.try(() => JSON.parse(input))
 *   return data
 * }).pipe(
 *   Effect.catchAll(() => Effect.succeed(null))
 * )
 * ```
 *
 * @see https://effect.website/docs/guides/error-management/expected-errors
 */
export const noEffectGenTryCatch: Rule = {
  id: "no-effect-gen-trycatch",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)

        // Find Effect.gen blocks and check for try inside them
        const genPattern = /Effect\.gen\(function\*\s*\(\)\s*\{/g
        let genMatch: RegExpExecArray | null

        while ((genMatch = genPattern.exec(content)) !== null) {
          const genStart = genMatch.index
          // Find matching closing brace (simplified)
          const afterGen = content.substring(genStart)
          const genEnd = findMatchingBrace(afterGen, genStart)

          const genBlock = content.substring(genStart, genEnd)

          // Check for try in this block
          if (/\btry\s*\{/.test(genBlock)) {
            const tryIndex = genBlock.indexOf("try {")
            const absoluteIndex = genStart + tryIndex
            const beforeMatch = content.substring(0, absoluteIndex)
            const line = beforeMatch.split("\n").length
            const column = absoluteIndex - beforeMatch.lastIndexOf("\n")

            results.push({
              id: "no-effect-gen-trycatch",
              ruleKind: "pattern",
              message:
                "Don't use try/catch in Effect.gen. Use Effect.try() or Effect.catchAll() instead.",
              severity: "error",
              file,
              range: {
                start: { line, column },
                end: { line, column: column + 5 }
              },
              tags: ["effect", "error-handling"]
            })
          }
        }
      }

      return results
    })
}
/**
 * Suggests using Data.TaggedError over plain Error.
 *
 * This rule identifies Error class extensions and suggests using Data.TaggedError
 * for better type inference and pattern matching in Effect error handling.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Discouraged - plain Error
 * class MyError extends Error {
 *   constructor(message: string) {
 *     super(message)
 *   }
 * }
 *
 * // ✅ Good - Data.TaggedError
 * class MyError extends Data.TaggedError("MyError")<{
 *   readonly message: string
 * }> {}
 * ```
 *
 * @see https://effect.website/docs/guides/error-management/expected-errors#tagged-errors
 */
export const preferTaggedError: Rule = {
  id: "prefer-tagged-error",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        // Detect class extends Error but not TaggedError
        const pattern = /class\s+\w+\s+extends\s+Error\b/g

        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const index = match.index
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          // Check if it's not already a TaggedError
          const currentLine = content.split("\n")[line - 1]
          if (!currentLine.includes("Data.TaggedError")) {
            results.push({
              id: "prefer-tagged-error",
              ruleKind: "pattern",
              message:
                "Consider using Data.TaggedError for better type inference and error handling.",
              severity: "info",
              file,
              range: {
                start: { line, column },
                end: { line, column: column + match[0].length }
              },
              tags: ["effect", "error-handling"]
            })
          }
        }
      }

      return results
    })
}

/**
 * Detects Promise usage inside Effect.gen.
 *
 * This rule identifies Promise-related code inside Effect.gen blocks, suggesting
 * to use Effect.tryPromise or Effect.promise for proper integration.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - Promise in Effect.gen
 * Effect.gen(function* () {
 *   const result = await fetch("/api")
 *   return result
 * })
 *
 * // ✅ Good - Effect.tryPromise
 * Effect.gen(function* () {
 *   const result = yield* Effect.tryPromise(() => fetch("/api"))
 *   return result
 * })
 * ```
 *
 * @see https://effect.website/docs/guides/essentials/creating-effects#from-promises
 */
export const noMixedPromiseEffect: Rule = {
  id: "no-mixed-promise-effect",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)

        // Find Effect.gen blocks and check for Promise usage
        const genPattern = /Effect\.gen\(function\*\s*\(\)\s*\{/g
        let genMatch: RegExpExecArray | null

        while ((genMatch = genPattern.exec(content)) !== null) {
          const genStart = genMatch.index
          const afterGen = content.substring(genStart)
          const genEnd = findMatchingBrace(afterGen, genStart)
          const genBlock = content.substring(genStart, genEnd)

          // Check for Promise patterns (but not Effect.promise/tryPromise)
          const promisePattern = /\b(await|new Promise)|\.then\(/g
          let promiseMatch: RegExpExecArray | null

          while ((promiseMatch = promisePattern.exec(genBlock)) !== null) {
            // Skip if it's Effect.promise or Effect.tryPromise
            const before = genBlock.substring(
              Math.max(0, promiseMatch.index - 20),
              promiseMatch.index
            )
            if (before.includes("Effect.promise") || before.includes("Effect.tryPromise")) {
              continue
            }

            const absoluteIndex = genStart + promiseMatch.index
            const beforeMatch = content.substring(0, absoluteIndex)
            const line = beforeMatch.split("\n").length
            const column = absoluteIndex - beforeMatch.lastIndexOf("\n")

            results.push({
              id: "no-mixed-promise-effect",
              ruleKind: "pattern",
              message: "Don't mix Promise and Effect. Use Effect.tryPromise() to wrap promises.",
              severity: "error",
              file,
              range: {
                start: { line, column },
                end: { line, column: column + promiseMatch[0].length }
              },
              tags: ["effect", "async"]
            })
          }
        }
      }

      return results
    })
}

/**
 * Detects console.log usage.
 *
 * This rule identifies console.log calls and suggests using Effect's Console
 * service for testable, composable logging that integrates with Effect's runtime.
 *
 * @category Pattern Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - console.log
 * console.log("User created:", user.id)
 *
 * // ✅ Good - Effect Console service
 * import * as Console from "effect/Console"
 * yield* Console.log("User created:", user.id)
 * ```
 *
 * @see https://effect.website/docs/guides/essentials/console
 */
export const noConsoleLog: Rule = {
  id: "no-console-log",
  kind: "pattern",
  run: ctx =>
    Effect.gen(function*() {
      const files = yield* ctx.listFiles(["**/*.ts", "**/*.tsx"])
      const results: RuleResult[] = []

      for (const file of files) {
        const content = yield* ctx.readFile(file)
        const pattern = /console\.(log|warn|error|info|debug)\(/g

        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const index = match.index
          const beforeMatch = content.substring(0, index)
          const line = beforeMatch.split("\n").length
          const column = index - beforeMatch.lastIndexOf("\n")

          results.push({
            id: "no-console-log",
            ruleKind: "pattern",
            message: "Use Effect Console service (Console.log, Console.error) instead of console.*",
            severity: "warning",
            file,
            range: {
              start: { line, column },
              end: { line, column: column + match[0].length }
            },
            tags: ["effect", "logging"]
          })
        }
      }

      return results
    })
}

/**
 * All pattern-based rules for detecting anti-patterns in Effect migration.
 *
 * These rules detect common non-Effect patterns (async/await, Promise, try/catch)
 * and suggest Effect alternatives for better composability and type safety.
 *
 * @category Pattern Rules
 * @since 0.3.0
 *
 * @see {@link noAsyncAwait} for async/await detection
 * @see {@link noNewPromise} for Promise constructor detection
 * @see {@link noTryCatch} for try/catch detection
 * @see {@link noBarrelImport} for barrel import detection
 * @see {@link noFsPromises} for fs/promises detection
 * @see {@link noUnhandledEffect} for unhandled Effect detection
 * @see {@link noRunPromiseToplevel} for top-level runPromise detection
 * @see {@link noAnyType} for any type usage
 * @see {@link noEffectCatchAllSuccess} for catchAll with succeed
 * @see {@link noEffectGenTryCatch} for try/catch in Effect.gen
 * @see {@link preferTaggedError} for TaggedError preference
 * @see {@link noMixedPromiseEffect} for Promise in Effect.gen
 * @see {@link noConsoleLog} for console.log usage
 */
export const patternRules: Rule[] = [
  noAsyncAwait,
  noNewPromise,
  noTryCatch,
  noBarrelImport,
  noFsPromises,
  noUnhandledEffect,
  noRunPromiseToplevel,
  noAnyType,
  noEffectCatchAllSuccess,
  noEffectGenTryCatch,
  preferTaggedError,
  noMixedPromiseEffect,
  noConsoleLog
]
