/**
 * Thread Command - CLI commands for managing Amp thread references
 *
 * This module provides CLI commands for tracking Amp thread URLs where
 * migration work occurred. Thread tracking enables cross-session context
 * by associating migration changes with specific Amp coding threads.
 *
 * ## Commands
 *
 * - **thread add**: Add or merge a thread reference with tags/scope
 * - **thread list**: List all tracked threads (console or JSON format)
 *
 * ## Usage
 *
 * ```bash
 * # Add a thread with metadata
 * effect-migrate thread add \
 *   --url https://ampcode.com/threads/T-abc123... \
 *   --tags "migration,api" \
 *   --scope "src/api/*" \
 *   --description "API migration work"
 *
 * # List tracked threads
 * effect-migrate thread list
 *
 * # List as JSON
 * effect-migrate thread list --json
 * ```
 *
 * @module @effect-migrate/cli/commands/thread
 * @since 0.2.0
 */

import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import chalk from "chalk"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { ampOutOption } from "../amp/constants.js"
import { updateIndexWithThreads } from "../amp/context-writer.js"
import { addThread, readThreads } from "../amp/thread-manager.js"

/**
 * Schema for parsing comma-separated strings into unique, sorted arrays.
 *
 * Transforms comma-delimited input like "api,migration,effect" into
 * deduplicated and sorted arrays ["api", "effect", "migration"].
 *
 * @category Schema
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const decode = Schema.decodeUnknownSync(CommaSeparated)
 * const result = decode("migration,api,migration") // ["api", "migration"]
 * ```
 */
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

/**
 * Parse optional comma-separated tags into an array.
 *
 * Handles Option<string> input from CLI options, returning an empty array
 * if no tags provided, or parsing the comma-separated string with validation.
 *
 * @param input - Optional comma-separated tags string
 * @returns Effect containing array of unique, sorted tags
 *
 * @category Helper
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const tags = yield* parseTags(Option.some("migration,api"))
 * // tags === ["api", "migration"]
 * ```
 */
const parseTags = (
  input: Option.Option<string>
): Effect.Effect<ReadonlyArray<string>> =>
  Option.match(input, {
    onNone: () => Effect.succeed([]),
    onSome: value =>
      Schema.decodeUnknown(CommaSeparated)(value).pipe(
        Effect.catchAll(error => Console.error(`Invalid tags format: ${error}`).pipe(Effect.as([])))
      )
  })

/**
 * Parse optional comma-separated scope patterns into an array.
 *
 * Handles Option<string> input from CLI options, returning an empty array
 * if no scope provided, or parsing the comma-separated string with validation.
 * Scope patterns are typically file globs (e.g., "src/api/*", "packages/core/**").
 *
 * @param input - Optional comma-separated scope patterns string
 * @returns Effect containing array of unique, sorted scope patterns
 *
 * @category Helper
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const scope = yield* parseScope(Option.some("src/api/*,packages/core/**"))
 * // scope === ["packages/core/**", "src/api/*"]
 * ```
 */
const parseScope = (
  input: Option.Option<string>
): Effect.Effect<ReadonlyArray<string>> =>
  Option.match(input, {
    onNone: () => Effect.succeed([]),
    onSome: value =>
      Schema.decodeUnknown(CommaSeparated)(value).pipe(
        Effect.catchAll(error =>
          Console.error(`Invalid scope format: ${error}`).pipe(Effect.as([]))
        )
      )
  })

/**
 * CLI command to add or merge a thread reference.
 *
 * Adds a new Amp thread URL to threads.json with optional metadata (tags, scope, description).
 * If the thread already exists (matched by ID), merges tags and scope using set union.
 *
 * Returns exit code 0 on success, 1 on error (invalid URL, filesystem error, etc.).
 *
 * @category CLI Command
 * @since 0.2.0
 *
 * @example
 * ```bash
 * # Add thread with tags and scope
 * effect-migrate thread add \
 *   --url https://ampcode.com/threads/T-abc123... \
 *   --tags "migration,api" \
 *   --scope "src/api/*,packages/core/**" \
 *   --description "Migrated API layer to Effect"
 * ```
 */
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
      const input = {
        url,
        ...(tagsList.length > 0 && { tags: Array.from(tagsList) }),
        ...(scopeList.length > 0 && { scope: Array.from(scopeList) }),
        ...(desc && { description: desc })
      }

      const result = yield* addThread(ampOut, input)

      // Update index.json to include threads reference
      yield* updateIndexWithThreads(ampOut)

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
      Effect.catchAll((error: unknown) =>
        Effect.gen(function*() {
          const errorMessage = error instanceof Error ? error.message : String(error)
          yield* Console.error(`❌ Failed to add thread: ${errorMessage}`)
          yield* Console.error(
            `   Check that the URL format is correct and the .amp directory is writable`
          )
          return 1
        })
      )
    )
)

/**
 * CLI command to list all tracked threads.
 *
 * Displays tracked threads in human-readable format (default) or JSON format.
 * Human format shows thread ID, URL, created timestamp, tags, scope, and description.
 *
 * Returns exit code 0 on success, 1 on error (filesystem error, etc.).
 *
 * @category CLI Command
 * @since 0.2.0
 *
 * @example
 * ```bash
 * # List threads in human-readable format
 * effect-migrate thread list
 *
 * # List threads as JSON
 * effect-migrate thread list --json
 * ```
 */
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
          yield* Console.log(chalk.bold(`\nTracked threads (${threadsFile.threads.length}):\n`))

          for (const thread of threadsFile.threads) {
            yield* Console.log(chalk.cyan(thread.id))
            yield* Console.log(`  ${chalk.gray("URL:")} ${thread.url}`)
            yield* Console.log(
              `  ${chalk.gray("Created:")} ${new Date(thread.createdAt.epochMillis).toISOString()}`
            )
            if (thread.tags && thread.tags.length > 0) {
              yield* Console.log(`  ${chalk.gray("Tags:")} ${thread.tags.join(", ")}`)
            }
            if (thread.scope && thread.scope.length > 0) {
              yield* Console.log(`  ${chalk.gray("Scope:")} ${thread.scope.join(", ")}`)
            }
            if (thread.description) {
              yield* Console.log(`  ${chalk.gray("Description:")} ${thread.description}`)
            }
            yield* Console.log("")
          }
        }
      }

      return 0
    }).pipe(
      Effect.catchAll((error: unknown) =>
        Effect.gen(function*() {
          const errorMessage = error instanceof Error ? error.message : String(error)
          yield* Console.error(`❌ Failed to list threads: ${errorMessage}`)
          yield* Console.error(`   Check that the .amp directory exists and is readable`)
          return 1
        })
      )
    )
)

/**
 * Root thread command with subcommands.
 *
 * Parent command for thread management. Use with subcommands:
 * - `thread add`: Add/merge thread reference
 * - `thread list`: List tracked threads
 *
 * Running without subcommands displays usage help.
 *
 * @category CLI Command
 * @since 0.2.0
 *
 * @example
 * ```bash
 * # Show help
 * effect-migrate thread
 *
 * # Use subcommands
 * effect-migrate thread add --url https://...
 * effect-migrate thread list --json
 * ```
 */
export const threadCommand = Command.make("thread", {}, () =>
  Effect.gen(function*() {
    yield* Console.log("Use 'thread add' or 'thread list'")
    return 0
  })).pipe(Command.withSubcommands([threadAddCommand, threadListCommand]))
