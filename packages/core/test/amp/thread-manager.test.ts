import { SystemError } from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { describe, expect, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  addThread,
  readThreads,
  type ThreadsFile,
  validateThreadUrl,
  writeThreads
} from "../../src/amp/thread-manager.js"

// Test thread ID/URL constants for DRY
const TEST_THREAD_1_ID = "t-12345678-abcd-1234-abcd-123456789abc"
const TEST_THREAD_1_URL = "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc"
const TEST_THREAD_2_ID = "t-11111111-1111-1111-1111-111111111111"
const TEST_THREAD_2_URL = "https://ampcode.com/threads/T-11111111-1111-1111-1111-111111111111"
const TEST_THREAD_3_ID = "t-22222222-2222-2222-2222-222222222222"
const TEST_THREAD_3_URL = "https://ampcode.com/threads/T-22222222-2222-2222-2222-222222222222"

// Mock filesystem with in-memory storage
interface MockFileSystemState {
  files: Map<string, string>
}

const makeMockFileSystem = () => {
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

  // Return both the filesystem and state as a tuple for external access
  return { mockFs, state }
}

const MockPathLayer = Layer.succeed(
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

// Helper to create test context with fresh mock filesystem
const makeTestContext = () => {
  const { mockFs } = makeMockFileSystem()
  return Layer.merge(Layer.succeed(FileSystem.FileSystem, mockFs), MockPathLayer)
}

describe("thread-manager", () => {
  describe("validateThreadUrl", () => {
    it.effect("accepts valid URLs with lowercase hex", () =>
      Effect.gen(function*() {
        const result = yield* validateThreadUrl(TEST_THREAD_1_URL)

        expect(result.id).toBe(TEST_THREAD_1_ID)
        expect(result.url).toBe(TEST_THREAD_1_URL)
      }))

    it.effect("accepts valid URLs with uppercase hex and normalizes to lowercase", () =>
      Effect.gen(function*() {
        const result = yield* validateThreadUrl(
          "https://ampcode.com/threads/T-12345678-ABCD-1234-ABCD-123456789ABC"
        )

        expect(result.id).toBe("t-12345678-abcd-1234-abcd-123456789abc")
        expect(result.url).toBe(
          "https://ampcode.com/threads/T-12345678-ABCD-1234-ABCD-123456789ABC"
        )
      }))

    it.effect("rejects URL with wrong domain", () =>
      Effect.gen(function*() {
        const result = yield* Effect.exit(
          validateThreadUrl("https://example.com/threads/T-12345678-abcd-1234-abcd-123456789abc")
        )

        expect(result._tag).toBe("Failure")
      }))

    it.effect("rejects URL missing thread ID", () =>
      Effect.gen(function*() {
        const result = yield* Effect.exit(validateThreadUrl("https://ampcode.com/threads/"))

        expect(result._tag).toBe("Failure")
      }))

    it.effect("rejects URL with invalid UUID format", () =>
      Effect.gen(function*() {
        const result = yield* Effect.exit(
          validateThreadUrl("https://ampcode.com/threads/T-invalid-uuid")
        )

        expect(result._tag).toBe("Failure")
      }))

    it.effect("rejects URL with wrong prefix", () =>
      Effect.gen(function*() {
        const result = yield* Effect.exit(
          validateThreadUrl("https://ampcode.com/threads/X-12345678-abcd-1234-abcd-123456789abc")
        )

        expect(result._tag).toBe("Failure")
      }))

    it.effect("rejects malformed URL", () =>
      Effect.gen(function*() {
        const result = yield* Effect.exit(validateThreadUrl("not-a-url"))

        expect(result._tag).toBe("Failure")
      }))
  })

  describe("readThreads", () => {
    it.effect("returns empty ThreadsFile when file doesn't exist", () =>
      Effect.gen(function*() {
        const result = yield* readThreads("/test-dir")

        expect(result).toEqual({
          version: 1,
          threads: []
        })
      }).pipe(Effect.provide(makeTestContext())))

    it.effect("handles malformed JSON gracefully", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        state.files.set("/test-dir/threads.json", "{ invalid json }")

        const result = yield* readThreads("/test-dir").pipe(
          Effect.provide(
            Layer.merge(
              Layer.succeed(FileSystem.FileSystem, mockFs),
              MockPathLayer
            )
          )
        )

        expect(result).toEqual({
          version: 1,
          threads: []
        })
      }))

    it.effect("handles invalid schema gracefully", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        state.files.set(
          "/test-dir/threads.json",
          JSON.stringify({
            version: 1,
            threads: [
              {
                // Missing required fields
                url: "invalid"
              }
            ]
          })
        )

        const result = yield* readThreads("/test-dir").pipe(
          Effect.provide(
            Layer.merge(
              Layer.succeed(FileSystem.FileSystem, mockFs),
              MockPathLayer
            )
          )
        )

        expect(result).toEqual({
          version: 1,
          threads: []
        })
      }))

    it.effect("successfully reads valid threads.json", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const timestamp = new Date("2025-11-04T10:00:00Z")

        state.files.set(
          "/test-dir/threads.json",
          JSON.stringify({
            version: 1,
            threads: [
              {
                id: "t-12345678-abcd-1234-abcd-123456789abc",
                url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
                createdAt: timestamp.toISOString(),
                tags: ["migration", "api"],
                scope: ["src/api/*"]
              }
            ]
          })
        )

        const result = yield* readThreads("/test-dir").pipe(
          Effect.provide(
            Layer.merge(
              Layer.succeed(FileSystem.FileSystem, mockFs),
              MockPathLayer
            )
          )
        )

        expect(result.version).toBe(1)
        expect(result.threads.length).toBe(1)
        expect(result.threads[0].id).toBe("t-12345678-abcd-1234-abcd-123456789abc")
        expect(result.threads[0].tags).toEqual(["migration", "api"])
        expect(result.threads[0].scope).toEqual(["src/api/*"])
      }))
  })

  describe("addThread", () => {
    it.scoped("adds new thread with all fields", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()

        const baseContext = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        const result = yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
          tags: ["migration", "api"],
          scope: ["src/api/*"],
          description: "API migration thread"
        }).pipe(Effect.provide(baseContext))

        expect(result.added).toBe(true)
        expect(result.merged).toBe(false)
        expect(result.current.id).toBe("t-12345678-abcd-1234-abcd-123456789abc")
        expect(result.current.tags).toEqual(["api", "migration"]) // Sorted
        expect(result.current.scope).toEqual(["src/api/*"])
        expect(result.current.description).toBe("API migration thread")

        // Verify written to file
        const written = state.files.get("/test-dir/threads.json")
        expect(written).toBeDefined()
        const parsed = JSON.parse(written!)
        expect(parsed.threads.length).toBe(1)
      }))

    it.effect("merges tags using set union on duplicate", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const timestamp = DateTime.unsafeMake(1000)

        // Add initial thread
        const initialThreads: ThreadsFile = {
          version: 1,
          threads: [
            {
              id: "t-12345678-abcd-1234-abcd-123456789abc",
              url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
              createdAt: timestamp,
              tags: ["migration", "api"]
            }
          ]
        }

        state.files.set("/test-dir/threads.json", JSON.stringify(initialThreads))

        // Add same thread with different tags
        const result = yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
          tags: ["api", "refactor", "core"] // "api" is duplicate
        }).pipe(
          Effect.provide(
            Layer.merge(
              Layer.succeed(FileSystem.FileSystem, mockFs),
              MockPathLayer
            )
          )
        )

        expect(result.added).toBe(false)
        expect(result.merged).toBe(true)
        expect(result.current.tags).toEqual(["api", "core", "migration", "refactor"]) // Union + sorted
      }))

    it.effect("merges scope using set union on duplicate", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const timestamp = DateTime.unsafeMake(1000)

        // Add initial thread
        const initialThreads: ThreadsFile = {
          version: 1,
          threads: [
            {
              id: "t-12345678-abcd-1234-abcd-123456789abc",
              url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
              createdAt: timestamp,
              scope: ["src/api/*", "src/utils/*"]
            }
          ]
        }

        state.files.set("/test-dir/threads.json", JSON.stringify(initialThreads))

        // Add same thread with different scope
        const result = yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
          scope: ["src/api/*", "src/core/*"] // "src/api/*" is duplicate
        }).pipe(
          Effect.provide(
            Layer.merge(
              Layer.succeed(FileSystem.FileSystem, mockFs),
              MockPathLayer
            )
          )
        )

        expect(result.added).toBe(false)
        expect(result.merged).toBe(true)
        expect(result.current.scope).toEqual(["src/api/*", "src/core/*", "src/utils/*"]) // Union + sorted
      }))

    it.scoped("preserves original createdAt on merge", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const originalTimestamp = DateTime.unsafeMake(1000)

        // Add initial thread
        const initialThreads: ThreadsFile = {
          version: 1,
          threads: [
            {
              id: "t-12345678-abcd-1234-abcd-123456789abc",
              url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
              createdAt: originalTimestamp
            }
          ]
        }

        state.files.set("/test-dir/threads.json", JSON.stringify(initialThreads))

        const baseContext = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        // Add same thread
        const result = yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
          tags: ["new-tag"]
        }).pipe(Effect.provide(baseContext))

        expect(result.merged).toBe(true)
        // Should preserve original timestamp, not use clock's new time
        expect(result.current.createdAt.epochMillis).toBe(1000)
      }))

    it.live("sorts threads by createdAt descending", () =>
      Effect.gen(function*() {
        const { mockFs } = makeMockFileSystem()

        const context = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        // Add first thread
        yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-11111111-1111-1111-1111-111111111111"
        }).pipe(Effect.provide(context))

        // Wait a bit to ensure different timestamp
        yield* Effect.sleep("10 millis")

        // Add second thread (newer)
        yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-22222222-2222-2222-2222-222222222222"
        }).pipe(Effect.provide(context))

        // Wait a bit to ensure different timestamp
        yield* Effect.sleep("10 millis")

        // Add third thread (newest)
        yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-33333333-3333-3333-3333-333333333333"
        }).pipe(Effect.provide(context))

        // Read back
        const result = yield* readThreads("/test-dir").pipe(Effect.provide(context))

        // Should be sorted newest first
        expect(result.threads[0].id).toBe("t-33333333-3333-3333-3333-333333333333")
        expect(result.threads[1].id).toBe("t-22222222-2222-2222-2222-222222222222")
        expect(result.threads[2].id).toBe("t-11111111-1111-1111-1111-111111111111")
      }))
  })

  describe("read/write round-trip", () => {
    it.effect("writes threads and reads back successfully", () =>
      Effect.gen(function*() {
        const { mockFs } = makeMockFileSystem()
        const timestamp = DateTime.unsafeMake(1000)

        const threadsToWrite: ThreadsFile = {
          version: 1,
          threads: [
            {
              id: "t-12345678-abcd-1234-abcd-123456789abc",
              url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
              createdAt: timestamp,
              tags: ["migration", "api"],
              scope: ["src/api/*"],
              description: "Test thread"
            }
          ]
        }

        const context = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        // Write
        yield* writeThreads("/test-dir", threadsToWrite).pipe(Effect.provide(context))

        // Read
        const result = yield* readThreads("/test-dir").pipe(Effect.provide(context))

        expect(result.version).toBe(1)
        expect(result.threads.length).toBe(1)
        expect(result.threads[0].id).toBe("t-12345678-abcd-1234-abcd-123456789abc")
        expect(result.threads[0].tags).toEqual(["migration", "api"])
        expect(result.threads[0].scope).toEqual(["src/api/*"])
        expect(result.threads[0].description).toBe("Test thread")
      }))
  })

  describe("schema migration tests", () => {
    it.effect("handles version 0 by reading it as-is (no migration yet)", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const timestamp = new Date("2025-11-04T10:00:00Z")

        // Create old format with version 0 (schema accepts numeric version)
        const oldFormat = {
          version: 0,
          threads: [
            {
              id: TEST_THREAD_1_ID,
              url: TEST_THREAD_1_URL,
              createdAt: timestamp.toISOString(),
              tags: ["migration", "api"],
              scope: ["src/api/*"],
              description: "Old format thread"
            }
          ]
        }

        state.files.set("/test-dir/threads.json", JSON.stringify(oldFormat))

        const context = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        const result = yield* readThreads("/test-dir").pipe(Effect.provide(context))

        // Reads version 0 as-is without migration (read doesn't modify version)
        // Version is only updated when writing new data via addThread/writeThreads
        expect(result.version).toBe(0)
        expect(result.threads.length).toBe(1)
        expect(result.threads[0].id).toBe(TEST_THREAD_1_ID)
      }))

    it.effect("handles missing version field gracefully (returns empty)", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const timestamp = new Date("2025-11-04T10:00:00Z")

        // Create format without version field (schema validation fails)
        const noVersionFormat = {
          threads: [
            {
              id: TEST_THREAD_2_ID,
              url: TEST_THREAD_2_URL,
              createdAt: timestamp.toISOString(),
              tags: ["test"]
            }
          ]
        }

        state.files.set("/test-dir/threads.json", JSON.stringify(noVersionFormat))

        const context = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        const result = yield* readThreads("/test-dir").pipe(Effect.provide(context))

        // Returns empty on schema validation failure
        expect(result.version).toBe(1)
        expect(result.threads).toEqual([])
      }))

    it.effect("writes audit version when adding thread", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const oldTimestamp = new Date("2025-11-03T10:00:00Z")

        // Start with version 0 file (old audit version)
        const oldFormat = {
          version: 0,
          threads: [
            {
              id: TEST_THREAD_1_ID,
              url: TEST_THREAD_1_URL,
              createdAt: oldTimestamp.toISOString(),
              tags: ["old-tag"]
            }
          ]
        }

        state.files.set("/test-dir/threads.json", JSON.stringify(oldFormat))

        const context = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        // Add a new thread with audit version 5
        yield* addThread(
          "/test-dir",
          {
            url: "https://ampcode.com/threads/T-22222222-2222-2222-2222-222222222222",
            tags: ["new-tag"]
          },
          5 // Audit version parameter
        ).pipe(Effect.provide(context))

        // Read the updated file
        const updated = yield* readThreads("/test-dir").pipe(Effect.provide(context))

        // Version should match the audit version we passed
        expect(updated.version).toBe(5)
        expect(updated.threads.length).toBe(2)

        // Old thread preserved
        const oldThread = updated.threads.find(t => t.id === TEST_THREAD_1_ID)
        expect(oldThread).toBeDefined()
        expect(oldThread?.tags).toContain("old-tag")
      }))

    it.effect("handles future versions gracefully (treats as valid if schema matches)", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const timestamp = new Date("2025-11-04T10:00:00Z")

        // Create format with future version (999) but valid schema
        const futureFormat = {
          version: 999,
          threads: [
            {
              id: TEST_THREAD_3_ID,
              url: TEST_THREAD_3_URL,
              createdAt: timestamp.toISOString(),
              tags: ["future"]
            }
          ]
        }

        state.files.set("/test-dir/threads.json", JSON.stringify(futureFormat))

        const context = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        const result = yield* readThreads("/test-dir").pipe(Effect.provide(context))

        // Currently accepts any numeric version as long as schema is valid
        // In the future, could add version validation/migration logic
        expect(result.version).toBe(999)
        expect(result.threads.length).toBe(1)
        expect(result.threads[0].id).toBe(TEST_THREAD_3_ID)
      }))

    it.effect("preserves data when unknown fields present (filtered by schema)", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const timestamp = new Date("2025-11-04T10:00:00Z")

        // Create format with extra unknown fields (schema strips them)
        const formatWithExtras = {
          version: 1,
          threads: [
            {
              id: TEST_THREAD_1_ID,
              url: TEST_THREAD_1_URL,
              createdAt: timestamp.toISOString(),
              tags: ["migration"],
              unknownField1: "should be stripped by schema",
              nestedUnknown: { deep: "value" }
            }
          ],
          unknownTopLevel: "also stripped"
        }

        state.files.set("/test-dir/threads.json", JSON.stringify(formatWithExtras))

        const context = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        const result = yield* readThreads("/test-dir").pipe(Effect.provide(context))

        // Successfully reads and strips unknown fields
        expect(result.version).toBe(1)
        expect(result.threads.length).toBe(1)
        expect(result.threads[0].id).toBe(TEST_THREAD_1_ID)
        expect(result.threads[0].tags).toEqual(["migration"])
        // Unknown fields filtered by Effect Schema
      }))

    it.effect("writes threads with version 1 consistently", () =>
      Effect.gen(function*() {
        const { mockFs, state } = makeMockFileSystem()
        const timestamp = DateTime.unsafeMake(1000)

        const context = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs),
          MockPathLayer
        )

        const threadsToWrite: ThreadsFile = {
          version: 1,
          threads: [
            {
              id: TEST_THREAD_1_ID,
              url: TEST_THREAD_1_URL,
              createdAt: timestamp,
              tags: ["test"]
            }
          ]
        }

        yield* writeThreads("/test-dir", threadsToWrite).pipe(Effect.provide(context))

        const written = state.files.get("/test-dir/threads.json")
        expect(written).toBeDefined()

        const parsed = JSON.parse(written!)
        expect(parsed.version).toBe(1)
        expect(parsed.threads.length).toBe(1)
      }))
  })
})
