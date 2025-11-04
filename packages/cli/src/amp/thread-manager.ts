import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Clock from "effect/Clock"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

// Thread entry for threads.json
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

// File format for threads.json
export const ThreadsFile = Schema.Struct({
  version: Schema.Number,
  threads: Schema.Array(ThreadEntry)
})

export type ThreadEntry = typeof ThreadEntry.Type
export type ThreadsFile = typeof ThreadsFile.Type

// Validate thread URL and extract ID (case-insensitive, normalize to lowercase)
export const validateThreadUrl = (url: string): Effect.Effect<{ id: string; url: string }, Error> =>
  Effect.gen(function*() {
    const regex =
      /^https:\/\/ampcode\.com\/threads\/(T-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/i
    const match = url.match(regex)

    if (!match) {
      return yield* Effect.fail(
        new Error(`Invalid thread URL. Expected format: https://ampcode.com/threads/T-{uuid}`)
      )
    }

    const id = match[1].toLowerCase()
    return { id, url }
  })

// Read threads.json (returns empty if missing/invalid)
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

    // Parse with try/catch
    const data = yield* Effect.try({
      try: () => JSON.parse(content),
      catch: error => {
        // Use Effect.logWarning for malformed JSON
        Effect.logWarning(`Malformed threads.json: ${error}`).pipe(Effect.runSync)
        return { version: 1, threads: [] }
      }
    })

    // Decode with schema
    const decode = Schema.decodeUnknownSync(ThreadsFile)

    return yield* Effect.try({
      try: () => decode(data),
      catch: error => {
        // Use Effect.logWarning instead of console.warn
        Effect.logWarning(`Invalid threads.json schema: ${error}`).pipe(Effect.runSync)
        return { version: 1, threads: [] }
      }
    })
  }).pipe(Effect.catchAll(() => Effect.succeed({ version: 1, threads: [] })))

// Write threads.json
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

// Add or merge thread
export const addThread = (
  outputDir: string,
  input: {
    url: string
    tags?: string[]
    scope?: string[]
    description?: string
  }
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
      const mergedTags = Array.from(
        new Set([...(existing.tags ?? []), ...(input.tags ?? [])])
      ).sort()
      const mergedScope = Array.from(
        new Set([...(existing.scope ?? []), ...(input.scope ?? [])])
      ).sort()

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

      yield* writeThreads(outputDir, { version: 1, threads: sorted })

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

      yield* writeThreads(outputDir, { version: 1, threads: sorted })

      return { added: true, merged: false, current: newEntry }
    }
  })
