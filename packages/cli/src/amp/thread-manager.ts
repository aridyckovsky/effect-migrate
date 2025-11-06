/**
 * Thread Manager - Track Amp thread URLs where migration work occurred
 *
 * This module manages the threads.json file that tracks which Amp threads
 * contain migration-related work. It provides validation, deduplication,
 * and merging of thread metadata (tags, scope, description).
 *
 * @module @effect-migrate/cli/amp/thread-manager
 * @since 0.2.0
 */

import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Clock from "effect/Clock"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

// Strict thread URL pattern: http(s)://ampcode.com/threads/T-{uuid-v4}
// UUID must match RFC 4122 format: 8-4-4-4-12 hex digits (lowercase)
const THREAD_URL_RE =
  /^https?:\/\/ampcode\.com\/threads\/T-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Branded type for validated thread URLs
const ThreadUrl = Schema.String.pipe(Schema.pattern(THREAD_URL_RE), Schema.brand("ThreadUrl"))

/**
 * Merge two arrays with deduplication and sorting.
 *
 * Combines two arrays using set union, removing duplicates and sorting.
 * Handles undefined arrays gracefully by treating them as empty.
 *
 * @param a - First array (optional)
 * @param b - Second array (optional)
 * @returns Merged, deduplicated, and sorted array
 *
 * @internal
 * @since 0.2.0
 */
const mergeUnique = <T>(a: readonly T[] | undefined = [], b: readonly T[] | undefined = []): T[] =>
  Array.from(new Set([...a, ...b])).sort()

/**
 * Thread entry schema for threads.json.
 *
 * Each entry represents an Amp thread URL where migration work occurred,
 * with optional metadata for categorization and filtering.
 *
 * @category Schema
 * @since 0.2.0
 */
export const ThreadEntry = Schema.Struct({
  id: Schema.String,
  url: Schema.String.pipe(
    Schema.pattern(
      /^https:\/\/ampcode\.com\/threads\/T-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    )
  ),
  createdAt: Schema.DateTimeUtc,
  tags: Schema.optional(Schema.Array(Schema.String)),
  scope: Schema.optional(Schema.Array(Schema.String)),
  description: Schema.optional(Schema.String)
})

/**
 * Threads file schema for threads.json.
 *
 * Root structure containing version and array of thread entries.
 * Threads are sorted by createdAt descending (newest first).
 *
 * **Note:** The `version` field tracks the audit version these threads
 * are associated with, NOT a schema version for threads.json itself.
 * This version should match the audit.json version from context-writer.
 *
 * @category Schema
 * @since 0.2.0
 */
export const ThreadsFile = Schema.Struct({
  version: Schema.Number,
  threads: Schema.Array(ThreadEntry)
})

/**
 * Extracted TypeScript types from schemas.
 *
 * @category Types
 * @since 0.2.0
 */
export type ThreadEntry = typeof ThreadEntry.Type
export type ThreadsFile = typeof ThreadsFile.Type

/**
 * Extract normalized thread ID from Amp thread URL.
 *
 * Extracts and normalizes the thread ID (T-{uuid}) portion of an Amp thread URL.
 * The URL must match the expected format with a valid UUID v4 pattern.
 *
 * Validation is case-insensitive, but the returned ID is normalized to lowercase
 * for consistent comparison and storage.
 *
 * @param url - Thread URL to extract ID from
 * @returns Effect containing normalized thread ID (lowercase)
 *
 * @category Validation
 * @since 0.2.0
 *
 * @example
 * Valid extractions:
 * ```typescript
 * // Extract from standard URL
 * const id = yield* extractThreadId(
 *   "https://ampcode.com/threads/T-12345678-abcd-1234-5678-123456789abc"
 * )
 * // id === "t-12345678-abcd-1234-5678-123456789abc"
 *
 * // Case normalization
 * const id2 = yield* extractThreadId(
 *   "https://ampcode.com/threads/T-ABCDEF12-ABCD-1234-5678-123456789ABC"
 * )
 * // id2 === "t-abcdef12-abcd-1234-5678-123456789abc"
 * ```
 *
 * @example
 * Invalid URLs:
 * ```typescript
 * // Invalid - wrong domain
 * yield* extractThreadId("https://example.com/threads/T-12345678-abcd-1234-5678-123456789abc")
 * // Error: Invalid thread URL...
 *
 * // Invalid - malformed UUID
 * yield* extractThreadId("https://ampcode.com/threads/T-invalid-uuid")
 * // Error: Invalid thread URL...
 * ```
 */
export const extractThreadId = (url: string): Effect.Effect<string, Error> =>
  Effect.gen(function*() {
    // Decode using branded Schema for effectful validation
    const decode = Schema.decodeUnknown(ThreadUrl)
    const validatedUrl = yield* decode(url).pipe(
      Effect.mapError(
        () =>
          new Error(
            `Invalid thread URL. Expected format: http(s)://ampcode.com/threads/T-{uuid-v4}\n` +
              `Example: https://ampcode.com/threads/T-12345678-abcd-1234-5678-123456789abc`
          )
      )
    )

    // Extract ID using strict regex with capture group
    const regex =
      /^https?:\/\/ampcode\.com\/threads\/(T-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
    const match = validatedUrl.match(regex)

    // Extract and normalize ID to lowercase
    const id = match![1].toLowerCase()
    return id
  })

/**
 * Validate Amp thread URL and extract normalized thread ID.
 *
 * Validates that the URL matches the expected Amp thread format:
 * `https://ampcode.com/threads/T-{uuid-v4}`
 *
 * The UUID must be a valid RFC 4122 pattern (8-4-4-4-12 hex digits).
 * Validation is case-insensitive, and the returned ID is normalized to lowercase.
 *
 * @param url - Thread URL to validate
 * @returns Effect containing normalized id and original url
 *
 * @category Validation
 * @since 0.2.0
 *
 * @example
 * Valid URLs:
 * ```typescript
 * // Valid - standard format
 * const result = yield* validateThreadUrl(
 *   "https://ampcode.com/threads/T-12345678-abcd-1234-5678-123456789abc"
 * )
 * // result.id === "t-12345678-abcd-1234-5678-123456789abc"
 *
 * // Valid - http protocol allowed
 * yield* validateThreadUrl("http://ampcode.com/threads/T-12345678-abcd-1234-5678-123456789abc")
 *
 * // Valid - case insensitive (normalized to lowercase)
 * yield* validateThreadUrl("https://ampcode.com/threads/T-ABCDEF12-ABCD-1234-5678-123456789ABC")
 * ```
 *
 * @example
 * Invalid URLs:
 * ```typescript
 * // Invalid - empty URL
 * yield* validateThreadUrl("")
 * // Error: Thread URL cannot be empty
 *
 * // Invalid - wrong domain
 * yield* validateThreadUrl("https://example.com/threads/T-12345678-abcd-1234-5678-123456789abc")
 * // Error: Invalid thread URL...
 *
 * // Invalid - malformed UUID
 * yield* validateThreadUrl("https://ampcode.com/threads/T-invalid-uuid")
 * // Error: Invalid thread URL...
 * ```
 */
export const validateThreadUrl = (url: string): Effect.Effect<{ id: string; url: string }, Error> =>
  Effect.gen(function*() {
    // Validate non-empty URL
    if (!url || url.trim().length === 0) {
      return yield* Effect.fail(new Error("Thread URL cannot be empty"))
    }

    // Extract normalized thread ID
    const id = yield* extractThreadId(url)

    return { id, url }
  })

/**
 * Read threads.json from the output directory.
 *
 * Returns empty ThreadsFile if the file doesn't exist or contains invalid data.
 * Malformed JSON or schema validation errors are logged and gracefully handled.
 *
 * **Performance Note**: Caching is intentionally NOT implemented because:
 * - File reads occur infrequently (CLI command invocations, not hot paths)
 * - File is small (<1KB for typical usage, ~10KB at 1000 threads)
 * - Cache invalidation complexity outweighs benefits at current scale
 * - Process lifecycle is short-lived (single command execution)
 *
 * Caching should be reconsidered if:
 * - Thread count exceeds 10,000 entries (file >100KB)
 * - Long-running daemon/server mode is added
 * - Multiple reads per command execution become common
 *
 * @param outputDir - Directory containing threads.json
 * @returns Effect containing ThreadsFile (never fails)
 *
 * @category Effect
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const threads = yield* readThreads(".amp/effect-migrate")
 * yield* Console.log(`Found ${threads.threads.length} threads`)
 * ```
 */
export const readThreads = (
  outputDir: string
): Effect.Effect<ThreadsFile, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const threadsPath = path.join(outputDir, "threads.json")

    // If file doesn't exist, return empty
    const exists = yield* fs.exists(threadsPath)
    if (!exists) {
      return { version: 1, threads: [] }
    }

    // Try to read
    const content = yield* fs
      .readFileString(threadsPath)
      .pipe(Effect.catchAll(() => Effect.succeed("")))

    if (!content) {
      return { version: 1, threads: [] }
    }

    // Parse JSON - log warning and return empty on failure
    const data = yield* Effect.try({
      try: () => JSON.parse(content),
      catch: error => error
    }).pipe(
      Effect.tapError(error => Effect.logWarning(`Malformed threads.json: ${error}`)),
      Effect.catchAll(() => Effect.succeed({ version: 1, threads: [] }))
    )

    // Early return if parsing failed
    if (data.version === 1 && data.threads.length === 0 && !content.includes("\"version\"")) {
      return data
    }

    // Decode with schema - log warning and return empty on failure
    const decode = Schema.decodeUnknownSync(ThreadsFile)

    return yield* Effect.try({
      try: () => decode(data),
      catch: error => error
    }).pipe(
      Effect.tapError(error => Effect.logWarning(`Invalid threads.json schema: ${error}`)),
      Effect.catchAll(() => Effect.succeed({ version: 1, threads: [] }))
    )
  }).pipe(Effect.catchAll(() => Effect.succeed({ version: 1, threads: [] })))

/**
 * Write threads.json to the output directory.
 *
 * Creates the output directory if it doesn't exist. Validates the data
 * against ThreadsFile schema before writing.
 *
 * @param outputDir - Directory to write threads.json
 * @param data - ThreadsFile data to write
 * @returns Effect that writes the file
 *
 * @category Effect
 * @since 0.2.0
 */
export const writeThreads = (
  outputDir: string,
  data: ThreadsFile
): Effect.Effect<void, Error, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Ensure directory exists
    yield* fs.makeDirectory(outputDir, { recursive: true })

    // Encode and write
    const encode = Schema.encodeSync(ThreadsFile)
    const encoded = encode(data)
    const threadsPath = path.join(outputDir, "threads.json")

    yield* fs.writeFileString(threadsPath, JSON.stringify(encoded, null, 2))
  })

/**
 * Add or merge a thread entry in threads.json.
 *
 * If the thread URL already exists (matched by normalized ID), merges the
 * metadata using set union for tags and scope. Otherwise, adds a new entry.
 *
 * Tags and scope are automatically deduplicated, sorted, and empty strings filtered.
 * Threads are sorted by createdAt descending (newest first) after modification.
 *
 * **Version Handling:** The `auditVersion` parameter should match the current
 * audit version from getNextAuditVersion(). If not provided, defaults to 1.
 *
 * @param outputDir - Directory containing threads.json
 * @param input - Thread data to add or merge
 * @param input.url - Amp thread URL (validated)
 * @param input.tags - Optional tags for categorization
 * @param input.scope - Optional file globs/paths for filtering
 * @param input.description - Optional description of thread context
 * @param auditVersion - Audit version to associate threads with (defaults to 1)
 * @returns Effect containing result with added/merged flags and current entry
 *
 * @category Effect
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const result = yield* addThread(".amp/effect-migrate", {
 *   url: "https://ampcode.com/threads/T-abc123...",
 *   tags: ["migration", "api"],
 *   scope: ["src/api/*"],
 *   description: "API migration work"
 * }, 2)  // Audit version 2
 *
 * if (result.added) {
 *   yield* Console.log("New thread added")
 * } else if (result.merged) {
 *   yield* Console.log("Existing thread updated")
 * }
 * ```
 */
export const addThread = (
  outputDir: string,
  input: {
    url: string
    tags?: string[]
    scope?: string[]
    description?: string
  },
  auditVersion: number = 1
): Effect.Effect<
  { added: boolean; merged: boolean; current: ThreadEntry },
  Error,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    // Validate URL and extract normalized ID
    const { id, url } = yield* validateThreadUrl(input.url)

    // Get current timestamp from Clock service
    const now = yield* Clock.currentTimeMillis
    const createdAt = DateTime.unsafeMake(now)

    // Read existing threads
    const threadsFile = yield* readThreads(outputDir)

    // Create mutable copy of threads array (Schema returns readonly)
    const threads = [...threadsFile.threads]

    // Check if thread already exists (merge by id, not url)
    const existingIndex = threads.findIndex(t => t.id === id)

    if (existingIndex >= 0) {
      // Merge tags and scope (set union)
      const existing = threads[existingIndex]
      const mergedTags = mergeUnique(existing.tags, input.tags)
      const mergedScope = mergeUnique(existing.scope, input.scope)

      const updated: ThreadEntry = {
        id: existing.id,
        url: existing.url,
        createdAt: existing.createdAt,
        ...(mergedTags.length > 0 && { tags: mergedTags }),
        ...(mergedScope.length > 0 && { scope: mergedScope }),
        ...(input.description && !existing.description && { description: input.description })
      }

      threads[existingIndex] = updated

      // Sort by createdAt descending
      const sorted = threads.sort(
        (a: ThreadEntry, b: ThreadEntry) => b.createdAt.epochMillis - a.createdAt.epochMillis
      )

      yield* writeThreads(outputDir, { version: auditVersion, threads: sorted })

      return { added: false, merged: true, current: updated }
    } else {
      // Add new thread - deduplicate and sort tags/scope
      const dedupedTags = input.tags
        ? Array.from(new Set(input.tags.filter(t => t.trim().length > 0))).sort()
        : undefined
      const dedupedScope = input.scope
        ? Array.from(new Set(input.scope.filter(s => s.trim().length > 0))).sort()
        : undefined

      const newEntry: ThreadEntry = {
        id,
        url,
        createdAt,
        ...(dedupedTags && dedupedTags.length > 0 && { tags: dedupedTags }),
        ...(dedupedScope && dedupedScope.length > 0 && { scope: dedupedScope }),
        ...(input.description && { description: input.description })
      }

      threads.push(newEntry)

      // Sort by createdAt descending
      const sorted = threads.sort(
        (a: ThreadEntry, b: ThreadEntry) => b.createdAt.epochMillis - a.createdAt.epochMillis
      )

      yield* writeThreads(outputDir, { version: auditVersion, threads: sorted })

      return { added: true, merged: false, current: newEntry }
    }
  })
