import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { describe, expect, it } from "@effect/vitest"
import * as Clock from "effect/Clock"
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

  return {
    exists: (path: string) => Effect.succeed(state.files.has(path)),
    readFileString: (path: string) =>
      Effect.gen(function*() {
        const content = state.files.get(path)
        if (!content) {
          return yield* Effect.fail(new Error(`File not found: ${path}`))
        }
        return content
      }),
    writeFileString: (path: string, content: string) =>
      Effect.sync(() => {
        state.files.set(path, content)
      }),
    makeDirectory: (_path: string, _options?: { recursive?: boolean }) => Effect.void,
    state
  }
}

const MockFileSystemLayer = Layer.succeed(FileSystem.FileSystem, makeMockFileSystem() as any)

const MockPathLayer = Layer.succeed(Path.Path, {
  join: (...parts: string[]) => parts.join("/"),
  sep: "/"
} as any)

const TestContext = Layer.merge(MockFileSystemLayer, MockPathLayer)

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
      }).pipe(Effect.provide(TestContext)))

    it.effect("handles malformed JSON gracefully", () =>
      Effect.gen(function*() {
        const mockFs = makeMockFileSystem()
        mockFs.state.files.set("/test-dir/threads.json", "{ invalid json }")

        const result = yield* readThreads("/test-dir").pipe(
          Effect.provide(
            Layer.merge(
              Layer.succeed(FileSystem.FileSystem, mockFs as any),
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
        const mockFs = makeMockFileSystem()
        mockFs.state.files.set(
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
              Layer.succeed(FileSystem.FileSystem, mockFs as any),
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
        const mockFs = makeMockFileSystem()
        const timestamp = new Date("2025-11-04T10:00:00Z")

        mockFs.state.files.set(
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
              Layer.succeed(FileSystem.FileSystem, mockFs as any),
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
    it.effect("adds new thread with all fields", () =>
      Effect.gen(function*() {
        const mockFs = makeMockFileSystem()
        const mockClock = Clock.make(now => now + 1000)

        const result = yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
          tags: ["migration", "api"],
          scope: ["src/api/*"],
          description: "API migration thread"
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Layer.succeed(FileSystem.FileSystem, mockFs as any),
              MockPathLayer,
              Layer.succeed(Clock.Clock, mockClock)
            )
          )
        )

        expect(result.added).toBe(true)
        expect(result.merged).toBe(false)
        expect(result.current.id).toBe("t-12345678-abcd-1234-abcd-123456789abc")
        expect(result.current.tags).toEqual(["api", "migration"]) // Sorted
        expect(result.current.scope).toEqual(["src/api/*"])
        expect(result.current.description).toBe("API migration thread")

        // Verify written to file
        const written = mockFs.state.files.get("/test-dir/threads.json")
        expect(written).toBeDefined()
        const parsed = JSON.parse(written!)
        expect(parsed.threads.length).toBe(1)
      }))

    it.effect("merges tags using set union on duplicate", () =>
      Effect.gen(function*() {
        const mockFs = makeMockFileSystem()
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

        mockFs.state.files.set("/test-dir/threads.json", JSON.stringify(initialThreads))

        // Add same thread with different tags
        const result = yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
          tags: ["api", "refactor", "core"] // "api" is duplicate
        }).pipe(
          Effect.provide(
            Layer.merge(
              Layer.succeed(FileSystem.FileSystem, mockFs as any),
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
        const mockFs = makeMockFileSystem()
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

        mockFs.state.files.set("/test-dir/threads.json", JSON.stringify(initialThreads))

        // Add same thread with different scope
        const result = yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
          scope: ["src/api/*", "src/core/*"] // "src/api/*" is duplicate
        }).pipe(
          Effect.provide(
            Layer.merge(
              Layer.succeed(FileSystem.FileSystem, mockFs as any),
              MockPathLayer
            )
          )
        )

        expect(result.added).toBe(false)
        expect(result.merged).toBe(true)
        expect(result.current.scope).toEqual(["src/api/*", "src/core/*", "src/utils/*"]) // Union + sorted
      }))

    it.effect("preserves original createdAt on merge", () =>
      Effect.gen(function*() {
        const mockFs = makeMockFileSystem()
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

        mockFs.state.files.set("/test-dir/threads.json", JSON.stringify(initialThreads))

        // Mock clock returns different time
        const mockClock = Clock.make(() => 99999)

        // Add same thread
        const result = yield* addThread("/test-dir", {
          url: "https://ampcode.com/threads/T-12345678-abcd-1234-abcd-123456789abc",
          tags: ["new-tag"]
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Layer.succeed(FileSystem.FileSystem, mockFs as any),
              MockPathLayer,
              Layer.succeed(Clock.Clock, mockClock)
            )
          )
        )

        expect(result.merged).toBe(true)
        // Should preserve original timestamp, not use clock's new time
        expect(result.current.createdAt.epochMillis).toBe(1000)
      }))

    it.live("sorts threads by createdAt descending", () =>
      Effect.gen(function*() {
        const mockFs = makeMockFileSystem()

        const context = Layer.merge(
          Layer.succeed(FileSystem.FileSystem, mockFs as any),
          MockPathLayer
        )

        const startTime = Date.now()

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
        const mockFs = makeMockFileSystem()
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
          Layer.succeed(FileSystem.FileSystem, mockFs as any),
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
})
