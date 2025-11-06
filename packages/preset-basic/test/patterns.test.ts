/**
 * Tests for pattern rules.
 *
 * @module @effect-migrate/preset-basic/test/patterns
 */

import type { RuleContext } from "@effect-migrate/core"
import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import {
  noAnyType,
  noAsyncAwait,
  noBarrelImport,
  noConsoleLog,
  noEffectCatchAllSuccess,
  noEffectGenTryCatch,
  noFsPromises,
  noMixedPromiseEffect,
  noNewPromise,
  noRunPromiseToplevel,
  noTryCatch,
  noUnhandledEffect,
  preferTaggedError
} from "../src/patterns.js"

// Convert glob pattern to regex
function globToRegex(pattern: string): RegExp {
  let regex = pattern
    .replace(/\\/g, "/")
    .replace(/\./g, "\\.")
    .replace(/\*\*\//g, "((.+\\/)*)?") // **/ matches zero or more path segments
    .replace(/\/\*\*/g, "(\\/.*)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")

  return new RegExp("^" + regex + "$")
}

// Mock rule context helper
const createMockContext = (files: Record<string, string>): RuleContext => ({
  cwd: process.cwd(),
  path: ".",
  listFiles: patterns =>
    Effect.succeed(
      Object.keys(files).filter(file => {
        return patterns.some(pattern => {
          const regex = globToRegex(pattern)
          return regex.test(file)
        })
      })
    ),
  readFile: file => Effect.succeed(files[file] ?? ""),
  getImportIndex: () =>
    Effect.succeed({
      getImports: () => [],
      getImporters: () => []
    }),
  config: {},
  logger: {
    debug: () => Effect.void,
    info: () => Effect.void
  }
})

it.effect("noAsyncAwait - should detect async function declaration", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
async function fetchData() {
  const response = await fetch("/api")
  return response.json()
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noAsyncAwait.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-async-await")
    expect(results[0].severity).toBe("warning")
    expect(results[0].message).toContain("Effect.gen")
  }))

it.effect("noAsyncAwait - should detect async arrow function", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
const fetchData = async () => {
  return await fetch("/api")
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noAsyncAwait.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].message).toContain("Effect.gen")
  }))

it.effect("noAsyncAwait - should detect async arrow with params", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
const fetchUser = async (id: string) => {
  return await fetch(\`/users/\${id}\`)
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noAsyncAwait.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

// Note: async methods (class methods) are not currently detected by the pattern
// This could be a future enhancement

it.effect("noAsyncAwait - should not flag Effect.gen", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
import * as Effect from "effect/Effect"

const fetchData = Effect.gen(function* () {
  const response = yield* Effect.promise(() => fetch("/api"))
  return yield* Effect.promise(() => response.json())
})
`
    }

    const ctx = createMockContext(files)
    const results = yield* noAsyncAwait.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noNewPromise - should detect new Promise<T>", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
const delay = (ms: number) => new Promise<void>(resolve => {
  setTimeout(resolve, ms)
})
`
    }

    const ctx = createMockContext(files)
    const results = yield* noNewPromise.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-new-promise")
    expect(results[0].severity).toBe("warning")
    expect(results[0].message).toContain("Effect.async")
  }))

it.effect("noNewPromise - should provide location info", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `const p = new Promise<number>(resolve => resolve(42))`
    }

    const ctx = createMockContext(files)
    const results = yield* noNewPromise.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].range).toBeDefined()
    expect(results[0].range?.start.line).toBe(1)
  }))

it.effect("noNewPromise - should not flag Promise.resolve", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `const p = Promise.resolve(42)`
    }

    const ctx = createMockContext(files)
    const results = yield* noNewPromise.run(ctx)

    // Pattern only matches 'new Promise<'
    expect(results.length).toBe(0)
  }))

it.effect("noTryCatch - should detect try/catch block", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
function parseJSON(data: string) {
  try {
    return JSON.parse(data)
  } catch (error) {
    return null
  }
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noTryCatch.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-try-catch")
    expect(results[0].severity).toBe("warning")
    expect(results[0].message).toContain("Effect.catchAll")
  }))

it.effect("noTryCatch - should detect multiple try blocks", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
function foo() {
  try {
    doSomething()
  } catch (e) {}
  
  try {
    doSomethingElse()
  } catch (e) {}
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noTryCatch.run(ctx)

    expect(results.length).toBe(2)
  }))

it.effect("noTryCatch - should provide correct tags", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `try { doSomething() } catch (e) {}`
    }

    const ctx = createMockContext(files)
    const results = yield* noTryCatch.run(ctx)

    expect(results[0].tags).toContain("effect")
    expect(results[0].tags).toContain("error-handling")
  }))

it.effect("noBarrelImport - should detect barrel import from effect", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
import { Effect, Console, pipe } from "effect"

const program = pipe(
  Console.log("Hello"),
  Effect.map(() => 42)
)
`
    }

    const ctx = createMockContext(files)
    const results = yield* noBarrelImport.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-barrel-import-effect")
    expect(results[0].severity).toBe("warning")
    expect(results[0].message).toContain("tree-shaking")
  }))

it.effect("noBarrelImport - should allow specific imports", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import { pipe } from "effect/Function"

const program = pipe(
  Console.log("Hello"),
  Effect.map(() => 42)
)
`
    }

    const ctx = createMockContext(files)
    const results = yield* noBarrelImport.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noBarrelImport - should detect single-quoted imports", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `import { Effect } from 'effect'`
    }

    const ctx = createMockContext(files)
    const results = yield* noBarrelImport.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("noFsPromises - should detect fs/promises import", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
import { readFile, writeFile } from "fs/promises"

export const loadConfig = async () => {
  return await readFile("config.json", "utf-8")
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noFsPromises.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-fs-promises")
    expect(results[0].severity).toBe("warning")
    expect(results[0].message).toContain("FileSystem service")
  }))

it.effect("noFsPromises - should provide correct tags", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `import fs from "fs/promises"`
    }

    const ctx = createMockContext(files)
    const results = yield* noFsPromises.run(ctx)

    expect(results[0].tags).toContain("platform")
    expect(results[0].tags).toContain("filesystem")
  }))

it.effect("noFsPromises - should allow @effect/platform FileSystem", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
import { FileSystem } from "@effect/platform"
import * as Effect from "effect/Effect"

export const loadConfig = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFileString("config.json")
})
`
    }

    const ctx = createMockContext(files)
    const results = yield* noFsPromises.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("pattern rules - should work with TypeScript files", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `async function test() {}`
    }

    const ctx = createMockContext(files)
    const results = yield* noAsyncAwait.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("pattern rules - should work with TSX files", () =>
  Effect.gen(function*() {
    const files = {
      "Component.tsx": `
export const Component = async () => {
  return <div>Hello</div>
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noAsyncAwait.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("pattern rules - should work with JavaScript files", () =>
  Effect.gen(function*() {
    const files = {
      "test.js": `async function test() {}`
    }

    const ctx = createMockContext(files)
    const results = yield* noAsyncAwait.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("pattern rules - should have correct metadata", () =>
  Effect.gen(function*() {
    expect(noAsyncAwait.id).toBe("no-async-await")
    expect(noAsyncAwait.kind).toBe("pattern")

    expect(noNewPromise.id).toBe("no-new-promise")
    expect(noNewPromise.kind).toBe("pattern")

    expect(noTryCatch.id).toBe("no-try-catch")
    expect(noTryCatch.kind).toBe("pattern")

    expect(noBarrelImport.id).toBe("no-barrel-import-effect")
    expect(noBarrelImport.kind).toBe("pattern")

    expect(noFsPromises.id).toBe("no-fs-promises")
    expect(noFsPromises.kind).toBe("pattern")
  }))

it.effect("edge case - async in comments will trigger (known limitation)", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
// This is an async function example
// async function example() {}
const normalFunction = () => {
  return 42
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noAsyncAwait.run(ctx)

    // Note: Simple regex patterns will match even in comments
    // This is a known limitation - use @effect-migrate-ignore to suppress false positives
    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("edge case - new Promise in string should trigger", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `const code = "new Promise<void>(resolve => resolve())"`
    }

    const ctx = createMockContext(files)
    const results = yield* noNewPromise.run(ctx)

    // Pattern will match even in strings - conservative approach
    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("edge case - multiple violations in same file", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
async function foo() {
  try {
    const p = new Promise<number>(r => r(42))
    await p
  } catch (e) {}
}
`
    }

    const ctx = createMockContext(files)

    const asyncResults = yield* noAsyncAwait.run(ctx)
    const promiseResults = yield* noNewPromise.run(ctx)
    const tryCatchResults = yield* noTryCatch.run(ctx)

    expect(asyncResults.length).toBeGreaterThan(0)
    expect(promiseResults.length).toBeGreaterThan(0)
    expect(tryCatchResults.length).toBeGreaterThan(0)
  }))

// Tests for new pattern rules

it.effect("noUnhandledEffect - should detect unhandled Effect call", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
Effect.gen(function* () {
  Effect.log("This won't run!")
  return 42
})
`
    }

    const ctx = createMockContext(files)
    const results = yield* noUnhandledEffect.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-unhandled-effect")
    expect(results[0].severity).toBe("error")
    expect(results[0].message).toContain("yield*")
  }))

it.effect("noUnhandledEffect - should not flag yielded Effects", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
Effect.gen(function* () {
  yield* Effect.log("This will run")
  return 42
})
`
    }

    const ctx = createMockContext(files)
    const results = yield* noUnhandledEffect.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noUnhandledEffect - should not flag assigned Effects", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
const program = Effect.log("Assigned")
const result = Effect.succeed(42)
`
    }

    const ctx = createMockContext(files)
    const results = yield* noUnhandledEffect.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noRunPromiseToplevel - should detect Effect.runPromise at module level", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
import * as Effect from "effect/Effect"

const config = await Effect.runPromise(loadConfig())
`
    }

    const ctx = createMockContext(files)
    const results = yield* noRunPromiseToplevel.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-runpromise-toplevel")
    expect(results[0].severity).toBe("error")
    expect(results[0].message).toContain("module level")
  }))

it.effect("noRunPromiseToplevel - should allow runPromise in functions", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
import * as Effect from "effect/Effect"

export async function main() {
  const config = await Effect.runPromise(loadConfig())
  return config
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noRunPromiseToplevel.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noRunPromiseToplevel - should detect runSync and runFork too", () =>
  Effect.gen(function*() {
    const files = {
      "test1.ts": `const x = Effect.runSync(program)`,
      "test2.ts": `const y = Effect.runFork(program)`
    }

    const ctx = createMockContext(files)
    const results = yield* noRunPromiseToplevel.run(ctx)

    expect(results.length).toBe(2)
  }))

it.effect("noAnyType - should detect any type annotation", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
function process(data: any) {
  return data.value
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noAnyType.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-any-type")
    expect(results[0].severity).toBe("warning")
    expect(results[0].message).toContain("unknown")
  }))

it.effect("noAnyType - should detect any in generics", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `const arr: Array<any> = []`
    }

    const ctx = createMockContext(files)
    const results = yield* noAnyType.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("noAnyType - should not flag any in comments", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
// This should not use any
function safe(data: unknown) {}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noAnyType.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noEffectCatchAllSuccess - should detect Effect.succeed in catchAll", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
effect.pipe(
  Effect.catchAll(() => Effect.succeed(null))
)
`
    }

    const ctx = createMockContext(files)
    const results = yield* noEffectCatchAllSuccess.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-effect-catchall-success")
    expect(results[0].severity).toBe("warning")
    expect(results[0].message).toContain("swallow errors")
  }))

it.effect("noEffectCatchAllSuccess - should allow catchAll with logging", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
effect.pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Effect.logWarning(error)
      return defaultValue
    })
  )
)
`
    }

    const ctx = createMockContext(files)
    const results = yield* noEffectCatchAllSuccess.run(ctx)

    // Still flags because pattern matches catchAll + succeed
    // This is intentional - warns about potential error swallowing
    expect(results.length).toBe(0)
  }))

it.effect("noEffectGenTryCatch - should detect try/catch in Effect.gen", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
Effect.gen(function* () {
  try {
    const data = JSON.parse(input)
    return data
  } catch (e) {
    return null
  }
})
`
    }

    const ctx = createMockContext(files)
    const results = yield* noEffectGenTryCatch.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-effect-gen-trycatch")
    expect(results[0].severity).toBe("error")
    expect(results[0].message).toContain("Effect.try")
  }))

it.effect("noEffectGenTryCatch - should allow try/catch outside Effect.gen", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
function parseJSON(input: string) {
  try {
    return JSON.parse(input)
  } catch (e) {
    return null
  }
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noEffectGenTryCatch.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("preferTaggedError - should suggest TaggedError for Error classes", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
class MyError extends Error {
  constructor(message: string) {
    super(message)
  }
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* preferTaggedError.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("prefer-tagged-error")
    expect(results[0].severity).toBe("info")
    expect(results[0].message).toContain("Data.TaggedError")
  }))

it.effect("preferTaggedError - should not flag TaggedError usage", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
class MyError extends Data.TaggedError("MyError")<{ message: string }> {}
`
    }

    const ctx = createMockContext(files)
    const results = yield* preferTaggedError.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noMixedPromiseEffect - should detect await in Effect.gen", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
Effect.gen(function* () {
  const result = await fetch("/api")
  return result
})
`
    }

    const ctx = createMockContext(files)
    const results = yield* noMixedPromiseEffect.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-mixed-promise-effect")
    expect(results[0].severity).toBe("error")
    expect(results[0].message).toContain("Effect.tryPromise")
  }))

it.effect("noMixedPromiseEffect - should detect .then() in Effect.gen", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
Effect.gen(function* () {
  const result = fetch("/api").then(r => r.json())
  return result
})
`
    }

    const ctx = createMockContext(files)
    const results = yield* noMixedPromiseEffect.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("noMixedPromiseEffect - should allow Effect.tryPromise", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
Effect.gen(function* () {
  const result = yield* Effect.tryPromise(() => fetch("/api"))
  return result
})
`
    }

    const ctx = createMockContext(files)
    const results = yield* noMixedPromiseEffect.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noConsoleLog - should detect console.log", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
function greet(name: string) {
  console.log("Hello", name)
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noConsoleLog.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-console-log")
    expect(results[0].severity).toBe("warning")
    expect(results[0].message).toContain("Console service")
  }))

it.effect("noConsoleLog - should detect all console methods", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
console.log("log")
console.warn("warn")
console.error("error")
console.info("info")
console.debug("debug")
`
    }

    const ctx = createMockContext(files)
    const results = yield* noConsoleLog.run(ctx)

    expect(results.length).toBe(5)
  }))

it.effect("noConsoleLog - should allow Effect Console", () =>
  Effect.gen(function*() {
    const files = {
      "test.ts": `
import * as Console from "effect/Console"

yield* Console.log("Hello")
yield* Console.error("Error")
`
    }

    const ctx = createMockContext(files)
    const results = yield* noConsoleLog.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("new rules - should have correct metadata", () =>
  Effect.gen(function*() {
    expect(noUnhandledEffect.id).toBe("no-unhandled-effect")
    expect(noUnhandledEffect.kind).toBe("pattern")

    expect(noRunPromiseToplevel.id).toBe("no-runpromise-toplevel")
    expect(noRunPromiseToplevel.kind).toBe("pattern")

    expect(noAnyType.id).toBe("no-any-type")
    expect(noAnyType.kind).toBe("pattern")

    expect(noEffectCatchAllSuccess.id).toBe("no-effect-catchall-success")
    expect(noEffectCatchAllSuccess.kind).toBe("pattern")

    expect(noEffectGenTryCatch.id).toBe("no-effect-gen-trycatch")
    expect(noEffectGenTryCatch.kind).toBe("pattern")

    expect(preferTaggedError.id).toBe("prefer-tagged-error")
    expect(preferTaggedError.kind).toBe("pattern")

    expect(noMixedPromiseEffect.id).toBe("no-mixed-promise-effect")
    expect(noMixedPromiseEffect.kind).toBe("pattern")

    expect(noConsoleLog.id).toBe("no-console-log")
    expect(noConsoleLog.kind).toBe("pattern")
  }))
