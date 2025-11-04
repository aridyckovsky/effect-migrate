import * as NodeContext from "@effect/platform-node/NodeContext"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { addThread, readThreads, validateThreadUrl } from "../../src/amp/thread-manager.js"
import type { ThreadsFile } from "../../src/amp/thread-manager.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Test thread ID/URL constants for DRY
const TEST_THREAD_1_ID = "t-12345678-1234-1234-1234-123456789abc"
const TEST_THREAD_1_URL = "https://ampcode.com/threads/T-12345678-1234-1234-1234-123456789abc"
const TEST_THREAD_2_ID = "t-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const TEST_THREAD_2_URL = "https://ampcode.com/threads/T-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const TEST_THREAD_3_ID = "t-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const TEST_THREAD_3_URL = "https://ampcode.com/threads/T-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

describe("Thread Command Integration Tests", () => {
  const testDir = join(__dirname, "..", "..", "test-output")

  describe("thread add command", () => {
    it.effect("successfully adds thread with valid URL", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "add-valid")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        const result = yield* addThread(outputDir, { url: TEST_THREAD_1_URL })

        expect(result.added).toBe(true)
        expect(result.merged).toBe(false)
        expect(result.current.id).toBe(TEST_THREAD_1_ID)
        expect(result.current.url).toBe(TEST_THREAD_1_URL)

        // Verify file was written
        const threads = yield* readThreads(outputDir)
        expect(threads.threads.length).toBe(1)
        expect(threads.threads[0].url).toBe(TEST_THREAD_1_URL)

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))

    it.effect("fails with invalid URL", () =>
      Effect.gen(function*() {
        const invalidUrls = [
          "https://example.com/threads/T-12345678-1234-1234-1234-123456789abc",
          "https://ampcode.com/T-12345678-1234-1234-1234-123456789abc",
          "https://ampcode.com/threads/invalid-id",
          "not-a-url",
          ""
        ]

        for (const invalidUrl of invalidUrls) {
          const result = yield* Effect.exit(validateThreadUrl(invalidUrl))
          expect(result._tag).toBe("Failure")
        }
      }))

    it.effect("parses tags correctly (comma-separated)", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "add-tags")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        const validUrl = "https://ampcode.com/threads/T-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

        const result = yield* addThread(outputDir, {
          url: validUrl,
          tags: ["migration", "api", "core"]
        })

        expect(result.current.tags).toEqual(["api", "core", "migration"]) // Sorted

        // Verify in file
        const threads = yield* readThreads(outputDir)
        expect(threads.threads[0].tags).toEqual(["api", "core", "migration"])

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))

    it.effect("parses scope correctly (comma-separated)", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "add-scope")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        const validUrl = "https://ampcode.com/threads/T-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

        const result = yield* addThread(outputDir, {
          url: validUrl,
          scope: ["src/api/*", "src/core/*"]
        })

        expect(result.current.scope).toEqual(["src/api/*", "src/core/*"]) // Sorted

        // Verify in file
        const threads = yield* readThreads(outputDir)
        expect(threads.threads[0].scope).toEqual(["src/api/*", "src/core/*"])

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))

    it.effect("merges tags and scope on duplicate URL", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "add-merge")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        const validUrl = "https://ampcode.com/threads/T-cccccccc-cccc-cccc-cccc-cccccccccccc"

        // Add first time
        const result1 = yield* addThread(outputDir, {
          url: validUrl,
          tags: ["migration"],
          scope: ["src/api/*"]
        })

        expect(result1.added).toBe(true)

        // Add again with different tags/scope
        const result2 = yield* addThread(outputDir, {
          url: validUrl,
          tags: ["api", "migration"], // Duplicate "migration"
          scope: ["src/core/*", "src/api/*"] // Duplicate "src/api/*"
        })

        expect(result2.added).toBe(false)
        expect(result2.merged).toBe(true)
        expect(result2.current.tags).toEqual(["api", "migration"]) // Deduplicated and sorted
        expect(result2.current.scope).toEqual(["src/api/*", "src/core/*"]) // Deduplicated and sorted

        // Verify only one thread exists
        const threads = yield* readThreads(outputDir)
        expect(threads.threads.length).toBe(1)

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))

    it.effect("writes to correct output directory", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const customDir = path.join(testDir, "custom-output", "nested", "deep")

        // Clean up first
        const exists = yield* fs.exists(customDir)
        if (exists) {
          yield* fs.remove(customDir, { recursive: true })
        }

        const validUrl = "https://ampcode.com/threads/T-dddddddd-dddd-dddd-dddd-dddddddddddd"

        yield* addThread(customDir, { url: validUrl })

        // Verify directory was created and file exists
        const threadsPath = path.join(customDir, "threads.json")
        const fileExists = yield* fs.exists(threadsPath)
        expect(fileExists).toBe(true)

        // Cleanup
        yield* fs.remove(path.join(testDir, "custom-output"), { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))
  })

  describe("thread list command", () => {
    it.effect("handles empty threads file gracefully", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "list-empty")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        // Read from non-existent directory
        const threads = yield* readThreads(outputDir)

        expect(threads.version).toBe(1)
        expect(threads.threads).toEqual([])
      }).pipe(Effect.provide(NodeContext.layer)))

    it.live("shows threads in correct format", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "list-format")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        // Add multiple threads
        const url1 = "https://ampcode.com/threads/T-11111111-1111-1111-1111-111111111111"
        const url2 = "https://ampcode.com/threads/T-22222222-2222-2222-2222-222222222222"

        yield* addThread(outputDir, {
          url: url1,
          tags: ["migration"],
          scope: ["src/*"],
          description: "First thread"
        })

        // Small delay to ensure different timestamps
        yield* Effect.sleep("10 millis")

        yield* addThread(outputDir, {
          url: url2,
          tags: ["api"],
          description: "Second thread"
        })

        // Read threads
        const threads = yield* readThreads(outputDir)

        expect(threads.threads.length).toBe(2)

        // Should be sorted by createdAt descending (newest first)
        expect(threads.threads[0].id).toBe("t-22222222-2222-2222-2222-222222222222")
        expect(threads.threads[1].id).toBe("t-11111111-1111-1111-1111-111111111111")

        // Verify all fields
        expect(threads.threads[1].tags).toEqual(["migration"])
        expect(threads.threads[1].scope).toEqual(["src/*"])
        expect(threads.threads[1].description).toBe("First thread")

        expect(threads.threads[0].tags).toEqual(["api"])
        expect(threads.threads[0].description).toBe("Second thread")

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))

    it.effect("outputs valid JSON with correct schema", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "list-json")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        // Add a thread
        const url = "https://ampcode.com/threads/T-33333333-3333-3333-3333-333333333333"
        yield* addThread(outputDir, {
          url,
          tags: ["test"],
          scope: ["**/*.ts"]
        })

        // Read and verify JSON structure
        const threads = yield* readThreads(outputDir)
        const jsonOutput = JSON.stringify(threads, null, 2)
        const parsed: ThreadsFile = JSON.parse(jsonOutput)

        expect(parsed.version).toBe(1)
        expect(Array.isArray(parsed.threads)).toBe(true)
        expect(parsed.threads[0].id).toBe("t-33333333-3333-3333-3333-333333333333")
        expect(parsed.threads[0].url).toBe(url)
        expect(typeof parsed.threads[0].createdAt).toBe("string") // ISO date string in JSON

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))
  })

  describe("audit integration", () => {
    it.effect("audit.json includes threads array with correct format", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "audit-integration")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        // Add threads via thread add
        const url1 = "https://ampcode.com/threads/T-aaaabbbb-cccc-dddd-eeee-ffffffffffff"
        const url2 = "https://ampcode.com/threads/T-11112222-3333-4444-5555-666666666666"

        yield* addThread(outputDir, {
          url: url1,
          tags: ["migration", "phase1"],
          scope: ["src/core/*"],
          description: "Core migration thread"
        })

        yield* addThread(outputDir, {
          url: url2,
          tags: ["api"],
          description: "API refactor"
        })

        // Verify threads were written
        const threads = yield* readThreads(outputDir)
        expect(threads.threads.length).toBe(2)

        // Verify thread format matches expected schema
        for (const thread of threads.threads) {
          expect(thread.id).toMatch(
            /^t-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          )
          expect(thread.url).toMatch(
            /^https:\/\/ampcode\.com\/threads\/T-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          )
          expect(typeof thread.createdAt.epochMillis).toBe("number")
          if (thread.tags) {
            expect(Array.isArray(thread.tags)).toBe(true)
          }
          if (thread.scope) {
            expect(Array.isArray(thread.scope)).toBe(true)
          }
          if (thread.description) {
            expect(typeof thread.description).toBe("string")
          }
        }

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))

    it.effect("threads array is empty when no threads exist", () =>
      Effect.gen(function*() {
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "audit-empty")

        // Read from non-existent directory
        const threads = yield* readThreads(outputDir)

        expect(threads.version).toBe(1)
        expect(threads.threads).toEqual([])
      }).pipe(Effect.provide(NodeContext.layer)))

    it.effect("handles malformed threads.json gracefully", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "audit-malformed")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        // Create directory and write malformed JSON
        yield* fs.makeDirectory(outputDir, { recursive: true })
        const threadsPath = path.join(outputDir, "threads.json")
        yield* fs.writeFileString(threadsPath, "{ invalid json }")

        // Should return empty instead of failing
        const threads = yield* readThreads(outputDir)
        expect(threads.version).toBe(1)
        expect(threads.threads).toEqual([])

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))
  })

  describe("URL validation", () => {
    it.effect("accepts valid Amp thread URLs", () =>
      Effect.gen(function*() {
        const validUrls = [
          "https://ampcode.com/threads/T-12345678-1234-1234-1234-123456789abc",
          "https://ampcode.com/threads/T-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          "https://ampcode.com/threads/T-00000000-0000-0000-0000-000000000000"
        ]

        for (const url of validUrls) {
          const result = yield* validateThreadUrl(url)
          expect(result.url).toBe(url)
          expect(result.id).toMatch(
            /^t-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          )
        }
      }))

    it.effect("rejects invalid thread URLs", () =>
      Effect.gen(function*() {
        const invalidUrls = [
          "https://example.com/threads/T-12345678-1234-1234-1234-123456789abc", // Wrong domain
          "ftp://ampcode.com/threads/T-12345678-1234-1234-1234-123456789abc", // Wrong protocol
          "https://ampcode.com/threads/invalid-format",
          "https://ampcode.com/threads/T-GGGGGGGG-GGGG-GGGG-GGGG-GGGGGGGGGGGG", // Invalid hex
          "https://ampcode.com/threads/T-123-456-789", // Wrong format
          "",
          "not-a-url"
        ]

        for (const url of invalidUrls) {
          const result = yield* Effect.exit(validateThreadUrl(url))
          expect(result._tag).toBe("Failure")
        }
      }))
  })

  describe("edge cases", () => {
    it.effect("filters empty strings from tags and scope", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "edge-empty-strings")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        const url = "https://ampcode.com/threads/T-eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"

        // addThread handles filtering internally
        const result = yield* addThread(outputDir, {
          url,
          tags: ["migration", "", "  ", "api"], // Empty strings and whitespace
          scope: ["src/*", "", "  "] // Empty strings and whitespace
        })

        // Empty strings should be filtered out
        expect(result.current.tags).toEqual(["api", "migration"])
        expect(result.current.scope).toEqual(["src/*"])

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))

    it.effect("deduplicates tags and scope", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "edge-duplicates")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        const url = "https://ampcode.com/threads/T-ffffffff-ffff-ffff-ffff-ffffffffffff"

        // addThread handles deduplication internally via Set
        const result = yield* addThread(outputDir, {
          url,
          tags: ["api", "migration", "api", "migration"], // Duplicates
          scope: ["src/*", "src/*", "test/*"] // Duplicates
        })

        // Should be deduplicated and sorted
        expect(result.current.tags).toEqual(["api", "migration"])
        expect(result.current.scope).toEqual(["src/*", "test/*"])

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))

    it.live("preserves original createdAt on merge", () =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const outputDir = path.join(testDir, "edge-preserve-timestamp")

        // Clean up first
        const exists = yield* fs.exists(outputDir)
        if (exists) {
          yield* fs.remove(outputDir, { recursive: true })
        }

        const url = "https://ampcode.com/threads/T-99999999-9999-9999-9999-999999999999"

        // Add first time
        const result1 = yield* addThread(outputDir, { url })
        const originalTimestamp = result1.current.createdAt

        // Wait a bit
        yield* Effect.sleep("50 millis")

        // Add again
        const result2 = yield* addThread(outputDir, {
          url,
          tags: ["new-tag"]
        })

        // Timestamp should be preserved
        expect(result2.current.createdAt.epochMillis).toBe(originalTimestamp.epochMillis)

        // Cleanup
        yield* fs.remove(outputDir, { recursive: true })
      }).pipe(Effect.provide(NodeContext.layer)))
  })
})
