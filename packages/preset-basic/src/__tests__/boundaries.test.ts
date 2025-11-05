/**
 * Tests for boundary rules.
 *
 * @module @effect-migrate/preset-basic/__tests__/boundaries
 */

import type { RuleContext } from "@effect-migrate/core"
import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { noFsPromises, noNodeInServices, noNodePath, noPlatformNodeInCore } from "../boundaries.js"

// Extract imports from file content (simple parsing for tests)
const extractImports = (content: string): string[] => {
  const imports: string[] = []

  // Match import from "..."
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  return imports
}

// Mock rule context helper
const createMockContext = (files: Record<string, string>): RuleContext => {
  // Build import index from files
  const importMap = new Map<string, string[]>()
  for (const [file, content] of Object.entries(files)) {
    importMap.set(file, extractImports(content))
  }

  return {
    cwd: process.cwd(),
    path: ".",
    listFiles: patterns =>
      Effect.succeed(
        Object.keys(files).filter(file => {
          // Simple pattern matching for tests
          return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"))
            return regex.test(file)
          })
        })
      ),
    readFile: file => Effect.succeed(files[file] ?? ""),
    getImportIndex: () =>
      Effect.succeed({
        getImports: (file: string) => Effect.succeed(importMap.get(file) ?? []),
        getImporters: (module: string) => {
          const importers: string[] = []
          for (const [file, imports] of importMap.entries()) {
            if (imports.includes(module)) {
              importers.push(file)
            }
          }
          return Effect.succeed(importers)
        }
      }),
    config: {},
    logger: {
      debug: () => Effect.void,
      info: () => Effect.void
    }
  }
}

it.effect("noNodeInServices - should detect node:fs import", () =>
  Effect.gen(function*() {
    const files = {
      "src/services/auth/FileService.ts": `
import { readFile } from "node:fs/promises"

export const readConfig = async () => {
  return await readFile("config.json", "utf-8")
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noNodeInServices.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-node-in-services")
    expect(results[0].severity).toBe("error")
    expect(results[0].message).toContain("@effect/platform")
  }))

it.effect("noNodeInServices - should detect node:path import", () =>
  Effect.gen(function*() {
    const files = {
      "src/services/util/PathService.ts": `
import { join } from "node:path"

export const getPath = (file: string) => {
  return join("/root", file)
}
`
    }

    const ctx = createMockContext(files)
    const results = yield* noNodeInServices.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-node-in-services")
  }))

it.effect("noNodeInServices - should detect node:http import", () =>
  Effect.gen(function*() {
    const files = {
      "src/services/api/HttpService.ts": `
import { createServer } from "node:http"

export const server = createServer()
`
    }

    const ctx = createMockContext(files)
    const results = yield* noNodeInServices.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("noNodeInServices - should allow @effect/platform imports", () =>
  Effect.gen(function*() {
    const files = {
      "src/services/data/FileService.ts": `
import { FileSystem } from "@effect/platform"
import * as Effect from "effect/Effect"

export const readConfig = (fs: FileSystem.FileSystem) =>
  Effect.gen(function* () {
    return yield* fs.readFileString("config.json")
  })
`
    }

    const ctx = createMockContext(files)
    const results = yield* noNodeInServices.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noNodeInServices - should not flag files outside src/services", () =>
  Effect.gen(function*() {
    const files = {
      "src/index.ts": `
import { readFile } from "node:fs/promises"
`
    }

    const ctx = createMockContext(files)
    const results = yield* noNodeInServices.run(ctx)

    // Rule only applies to src/services/**
    expect(results.length).toBe(0)
  }))

it.effect("noPlatformNodeInCore - should detect @effect/platform-node import", () =>
  Effect.gen(function*() {
    const files = {
      "src/core/business/Business.ts": `
import { NodeFileSystem } from "@effect/platform-node"

export const fs = NodeFileSystem.layer
`
    }

    const ctx = createMockContext(files)
    const results = yield* noPlatformNodeInCore.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-platform-node-in-core")
    expect(results[0].severity).toBe("error")
    expect(results[0].message).toContain("@effect/platform")
  }))

it.effect("noPlatformNodeInCore - should detect @effect/platform-node/NodeFileSystem", () =>
  Effect.gen(function*() {
    const files = {
      "src/core/logic/Logic.ts": `
import { NodeFileSystem } from "@effect/platform-node/NodeFileSystem"

export const layer = NodeFileSystem.layer
`
    }

    const ctx = createMockContext(files)
    const results = yield* noPlatformNodeInCore.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("noPlatformNodeInCore - should allow @effect/platform imports", () =>
  Effect.gen(function*() {
    const files = {
      "src/core/domain/Business.ts": `
import { FileSystem } from "@effect/platform"
import * as Effect from "effect/Effect"

export const readConfig = (fs: FileSystem.FileSystem) =>
  fs.readFileString("config.json")
`
    }

    const ctx = createMockContext(files)
    const results = yield* noPlatformNodeInCore.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noPlatformNodeInCore - should not flag files outside src/core", () =>
  Effect.gen(function*() {
    const files = {
      "src/index.ts": `
import { NodeFileSystem } from "@effect/platform-node"
`
    }

    const ctx = createMockContext(files)
    const results = yield* noPlatformNodeInCore.run(ctx)

    // Rule only applies to src/core/**
    expect(results.length).toBe(0)
  }))

it.effect("noNodePath - should detect path import", () =>
  Effect.gen(function*() {
    const files = {
      "src/utils/paths.ts": `
import path from "path"

export const joinPath = (a: string, b: string) => path.join(a, b)
`
    }

    const ctx = createMockContext(files)
    const results = yield* noNodePath.run(ctx)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("no-node-path")
    expect(results[0].severity).toBe("warning")
    expect(results[0].message).toContain("Path service")
  }))

it.effect("noNodePath - should detect node:path import", () =>
  Effect.gen(function*() {
    const files = {
      "src/utils/paths.ts": `
import { join, dirname } from "node:path"

export const getDir = (file: string) => dirname(file)
`
    }

    const ctx = createMockContext(files)
    const results = yield* noNodePath.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("noNodePath - should allow @effect/platform Path", () =>
  Effect.gen(function*() {
    const files = {
      "src/utils/paths.ts": `
import { Path } from "@effect/platform"
import * as Effect from "effect/Effect"

export const joinPath = (a: string, b: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    return path.join(a, b)
  })
`
    }

    const ctx = createMockContext(files)
    const results = yield* noNodePath.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("noFsPromises - should detect fs/promises import", () =>
  Effect.gen(function*() {
    const files = {
      "src/utils/file-utils.ts": `
import { readFile, writeFile } from "fs/promises"

export const readConfig = async () => {
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

it.effect("noFsPromises - should detect node:fs/promises import", () =>
  Effect.gen(function*() {
    const files = {
      "src/data/loader.ts": `
import { readFile } from "node:fs/promises"

export const load = (path: string) => readFile(path, "utf-8")
`
    }

    const ctx = createMockContext(files)
    const results = yield* noFsPromises.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("noFsPromises - should detect node:fs import", () =>
  Effect.gen(function*() {
    const files = {
      "src/data/reader.ts": `
import * as fs from "node:fs"

export const readSync = (path: string) => fs.readFileSync(path, "utf-8")
`
    }

    const ctx = createMockContext(files)
    const results = yield* noFsPromises.run(ctx)

    expect(results.length).toBeGreaterThan(0)
  }))

it.effect("noFsPromises - should allow @effect/platform FileSystem", () =>
  Effect.gen(function*() {
    const files = {
      "src/data/config-loader.ts": `
import { FileSystem } from "@effect/platform"
import * as Effect from "effect/Effect"

export const readConfig = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFileString("config.json")
})
`
    }

    const ctx = createMockContext(files)
    const results = yield* noFsPromises.run(ctx)

    expect(results.length).toBe(0)
  }))

it.effect("boundary rules - should provide correct rule metadata", () =>
  Effect.gen(function*() {
    // Check noNodeInServices metadata
    expect(noNodeInServices.id).toBe("no-node-in-services")
    expect(noNodeInServices.kind).toBe("boundary")

    // Check noPlatformNodeInCore metadata
    expect(noPlatformNodeInCore.id).toBe("no-platform-node-in-core")
    expect(noPlatformNodeInCore.kind).toBe("boundary")

    // Check noNodePath metadata
    expect(noNodePath.id).toBe("no-node-path")
    expect(noNodePath.kind).toBe("boundary")

    // Check noFsPromises metadata
    expect(noFsPromises.id).toBe("no-fs-promises")
    expect(noFsPromises.kind).toBe("boundary")
  }))

it.effect("boundary rules - should have documentation URLs", () =>
  Effect.gen(function*() {
    const files = {
      "src/services/test/test.ts": `import { readFile } from "node:fs/promises"`
    }

    const ctx = createMockContext(files)
    const results = yield* noNodeInServices.run(ctx)

    if (results.length > 0) {
      expect(results[0].docsUrl).toBeDefined()
      expect(results[0].docsUrl).toContain("effect.website")
    }
  }))
