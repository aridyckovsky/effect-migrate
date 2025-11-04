import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { ampOutOption } from "../amp/constants.js"
import { addThread, readThreads } from "../amp/thread-manager.js"

// Schema: Comma-separated string to unique array
const CommaSeparated = Schema.String.pipe(
  Schema.transformOrFail(
    Schema.Array(Schema.String),
    {
      strict: true,
      decode: input =>
        Effect.gen(function*() {
          const split = input
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
          const unique = Array.from(new Set(split)).sort()
          return yield* Effect.succeed(unique)
        }),
      encode: arr => Effect.succeed(arr.join(", "))
    }
  )
)

// Helper: Parse comma-separated tags with Option
const parseTags = (
  input: Option.Option<string>
): Effect.Effect<ReadonlyArray<string>> =>
  Option.match(input, {
    onNone: () => Effect.succeed([]),
    onSome: value =>
      Schema.decodeUnknown(CommaSeparated)(value).pipe(
        Effect.catchAll(error =>
          Effect.gen(function*() {
            yield* Console.error(`Invalid tags format: ${error}`)
            return yield* Effect.succeed([])
          })
        )
      )
  })

// Helper: Parse comma-separated scope with Option
const parseScope = (
  input: Option.Option<string>
): Effect.Effect<ReadonlyArray<string>> =>
  Option.match(input, {
    onNone: () => Effect.succeed([]),
    onSome: value =>
      Schema.decodeUnknown(CommaSeparated)(value).pipe(
        Effect.catchAll(error =>
          Effect.gen(function*() {
            yield* Console.error(`Invalid scope format: ${error}`)
            return yield* Effect.succeed([])
          })
        )
      )
  })

// ADD subcommand
const threadAddCommand = Command.make(
  "add",
  {
    url: Options.text("url").pipe(
      Options.withDescription("Thread URL (https://ampcode.com/threads/T-{uuid})")
    ),
    tags: Options.text("tags").pipe(
      Options.optional,
      Options.withDescription("Comma-separated tags (e.g., migration,api)")
    ),
    scope: Options.text("scope").pipe(
      Options.optional,
      Options.withDescription("Comma-separated file globs/paths (e.g., src/api/*)")
    ),
    description: Options.text("description").pipe(
      Options.optional,
      Options.withDescription("Optional description of thread context")
    ),
    ampOut: ampOutOption()
  },
  ({ url, tags, scope, description, ampOut }) =>
    Effect.gen(function*() {
      // Parse comma-separated values using Effect helpers
      const tagsList = yield* parseTags(tags)
      const scopeList = yield* parseScope(scope)
      const desc = Option.getOrUndefined(description)

      // Add thread - build input object with proper optional handling
      const input: { url: string; tags?: string[]; scope?: string[]; description?: string } = {
        url
      }
      if (tagsList.length > 0) input.tags = Array.from(tagsList)
      if (scopeList.length > 0) input.scope = Array.from(scopeList)
      if (desc) input.description = desc

      const result = yield* addThread(ampOut, input)

      // Log result
      if (result.added) {
        yield* Console.log(`✓ Added thread ${result.current.id}`)
        yield* Console.log(`  ${result.current.url}`)
      } else if (result.merged) {
        yield* Console.log(`✓ Updated thread ${result.current.id}: merged tags/scope`)
        yield* Console.log(`  ${result.current.url}`)
        if (tagsList && tagsList.length > 0) {
          yield* Console.log(`  Merged tags: ${result.current.tags?.join(", ") ?? "none"}`)
        }
        if (scopeList && scopeList.length > 0) {
          yield* Console.log(`  Merged scope: ${result.current.scope?.join(", ") ?? "none"}`)
        }
      } else {
        yield* Console.log(`✓ Thread already tracked ${result.current.id}`)
      }

      return 0
    }).pipe(
      Effect.catchAll(error =>
        Effect.gen(function*() {
          yield* Console.error(`❌ Thread add failed: ${error}`)
          return 1
        })
      )
    )
)

// LIST subcommand
const threadListCommand = Command.make(
  "list",
  {
    json: Options.boolean("json").pipe(
      Options.withDefault(false),
      Options.withDescription("Output as JSON")
    ),
    ampOut: ampOutOption()
  },
  ({ json, ampOut }) =>
    Effect.gen(function*() {
      const threadsFile = yield* readThreads(ampOut)

      if (json) {
        // Output as JSON directly
        yield* Console.log(JSON.stringify(threadsFile, null, 2))
      } else {
        // Human-readable format
        if (threadsFile.threads.length === 0) {
          yield* Console.log("No threads tracked")
        } else {
          yield* Console.log(`\nTracked threads (${threadsFile.threads.length}):\n`)

          for (const thread of threadsFile.threads) {
            yield* Console.log(`${thread.id}`)
            yield* Console.log(`  URL: ${thread.url}`)
            yield* Console.log(`  Created: ${new Date(thread.createdAt.epochMillis).toISOString()}`)
            if (thread.tags && thread.tags.length > 0) {
              yield* Console.log(`  Tags: ${thread.tags.join(", ")}`)
            }
            if (thread.scope && thread.scope.length > 0) {
              yield* Console.log(`  Scope: ${thread.scope.join(", ")}`)
            }
            if (thread.description) {
              yield* Console.log(`  Description: ${thread.description}`)
            }
            yield* Console.log("")
          }
        }
      }

      return 0
    }).pipe(
      Effect.catchAll(error =>
        Effect.gen(function*() {
          yield* Console.error(`❌ Thread list failed: ${error}`)
          return 1
        })
      )
    )
)

// Main thread command with subcommands
export const threadCommand = Command.make("thread", {}, () =>
  Effect.gen(function*() {
    yield* Console.log("Use 'thread add' or 'thread list'")
    return 0
  })).pipe(Command.withSubcommands([threadAddCommand, threadListCommand]))
