/**
 * Mock FileSystem and Path layers for testing
 *
 * Provides in-memory filesystem and path operations for isolated, fast tests.
 *
 * @module @effect-migrate/core/test/helpers
 */

import { SystemError } from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ProcessInfo } from "../../src/services/ProcessInfo.js"
import { Time } from "../../src/services/Time.js"

/**
 * In-memory file storage state
 */
export interface MockFileSystemState {
  files: Map<string, string>
}

/**
 * Create mock FileSystem layer with in-memory storage
 *
 * Returns both the layer and direct access to the state for test setup.
 */
export const makeMockFileSystem = () => {
  const state: MockFileSystemState = { files: new Map() }

  const mockFs = FileSystem.FileSystem.of({
    access: () => Effect.void,
    chmod: () => Effect.void,
    chown: () => Effect.void,
    copy: () => Effect.void,
    copyFile: () => Effect.void,
    exists: path => Effect.succeed(state.files.has(path)),
    link: () => Effect.void,
    makeDirectory: () => Effect.void,
    makeTempDirectory: () => Effect.succeed("/tmp/mock"),
    makeTempDirectoryScoped: () => Effect.succeed("/tmp/mock"),
    makeTempFile: () => Effect.succeed("/tmp/mock-file"),
    makeTempFileScoped: () => Effect.succeed("/tmp/mock-file"),
    open: () => Effect.die("Not implemented"),
    readDirectory: () => Effect.succeed([]),
    readFile: path =>
      Effect.gen(function*() {
        const content = state.files.get(path)
        if (!content) {
          return yield* Effect.fail(
            new SystemError({
              reason: "NotFound",
              module: "FileSystem",
              method: "readFile",
              description: `File not found: ${path}`
            })
          )
        }
        return new TextEncoder().encode(content)
      }),
    readFileString: path =>
      Effect.gen(function*() {
        const content = state.files.get(path)
        if (!content) {
          return yield* Effect.fail(
            new SystemError({
              reason: "NotFound",
              module: "FileSystem",
              method: "readFileString",
              description: `File not found: ${path}`
            })
          )
        }
        return content
      }),
    readLink: () => Effect.succeed(""),
    realPath: path => Effect.succeed(path),
    remove: () => Effect.void,
    rename: () => Effect.void,
    sink: () => Effect.die("Not implemented"),
    stat: () => Effect.die("Not implemented"),
    stream: () => Effect.die("Not implemented"),
    symlink: () => Effect.void,
    truncate: () => Effect.void,
    utimes: () => Effect.void,
    watch: () => Effect.die("Not implemented"),
    writeFile: (path, data) =>
      Effect.sync(() => {
        state.files.set(path, new TextDecoder().decode(data as Uint8Array))
      }),
    writeFileString: (path, content) =>
      Effect.sync(() => {
        state.files.set(path, content)
      })
  })

  return { mockFs, state }
}

/**
 * Mock Path layer with Unix-style path operations
 */
export const MockPathLayer = Layer.succeed(
  Path.Path,
  Path.Path.of({
    [Path.TypeId]: Path.TypeId,
    sep: "/",
    basename: path => path.split("/").pop() ?? "",
    dirname: path => path.split("/").slice(0, -1).join("/") || "/",
    extname: path => {
      const base = path.split("/").pop() ?? ""
      const idx = base.lastIndexOf(".")
      return idx > 0 ? base.slice(idx) : ""
    },
    format: () => "",
    fromFileUrl: url => Effect.succeed(url instanceof URL ? url.pathname : new URL(url).pathname),
    isAbsolute: path => path.startsWith("/"),
    join: (...parts) => parts.join("/"),
    normalize: path => path,
    parse: () => ({ root: "", dir: "", base: "", ext: "", name: "" }),
    relative: (from, to) => to.replace(from, "").replace(/^\//, ""),
    resolve: (...paths) => "/" + paths.filter(Boolean).join("/").replace(/\/+/g, "/"),
    toFileUrl: path => Effect.succeed(new URL(`file://${path}`)),
    toNamespacedPath: path => path
  })
)

/**
 * Mock ProcessInfo layer for testing
 *
 * Reads from actual process.env to allow tests to control environment dynamically.
 */
export const MockProcessInfoLayer = Layer.succeed(ProcessInfo, {
  cwd: Effect.succeed("/test-cwd"),
  getEnv: (key: string) => Effect.sync(() => process.env[key]),
  getAllEnv: Effect.sync(() => process.env as Record<string, string | undefined>)
})

/**
 * Create test context with fresh mock filesystem
 *
 * Combines mock FileSystem, mock Path, ProcessInfo, and Time layers.
 * TestContext provides Clock which Time.Default uses via Effect.clock.
 */
export const makeTestContext = () => {
  const { mockFs } = makeMockFileSystem()
  return Layer.mergeAll(
    Time.Default,
    Layer.succeed(FileSystem.FileSystem, mockFs),
    MockPathLayer,
    MockProcessInfoLayer
  )
}
