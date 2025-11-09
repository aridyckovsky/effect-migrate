/**
 * Norms Command - Capture and display established migration norms
 *
 * This module provides the `norms` CLI command that analyzes checkpoint history
 * to detect established norms (rules that went to zero and stayed zero) for
 * specific directories.
 *
 * ## Usage
 *
 * ```bash
 * # Capture norms (prepare-only mode, no writes)
 * effect-migrate norms capture
 *
 * # Capture norms for specific directory
 * effect-migrate norms capture --directory src/services
 *
 * # Write norms summaries to disk
 * effect-migrate norms capture --no-prepare-only --overwrite
 *
 * # Filter by migration status
 * effect-migrate norms capture --status migrated
 * ```
 *
 * @module @effect-migrate/cli/commands/norms
 * @since 0.6.0
 */

// TODO: Export norms module from @effect-migrate/core/norms in core's package.json
// For now, using relative import to built files
import { DirectorySummarizer, DirectorySummarizerLive } from "@effect-migrate/core"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Cause from "effect/Cause"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { ampOutOption, getAmpOutPathWithDefault } from "../amp/options.js"

/**
 * CLI option for prepare-only mode.
 *
 * When true (default), prints guidance without writing files.
 * When false, writes norm summaries to disk.
 */
const prepareOnlyOption = Options.boolean("prepare-only").pipe(
  Options.withDefault(true),
  Options.withDescription("Prepare-only mode: print guidance without writing files")
)

/**
 * CLI option for directory filter.
 *
 * When provided, analyzes only the specified directory.
 */
const directoryOption = Options.text("directory").pipe(
  Options.optional,
  Options.withDescription("Single directory to analyze (e.g., src/services)")
)

/**
 * CLI option for lookback window.
 *
 * Number of consecutive zero-violation checkpoints required to establish a norm.
 */
const lookbackOption = Options.integer("lookback").pipe(
  Options.withDefault(5),
  Options.withDescription("Number of checkpoints required to establish norm (K)")
)

/**
 * CLI option for minimum files threshold.
 *
 * Directories with fewer files are excluded from analysis.
 */
const minFilesOption = Options.integer("min-files").pipe(
  Options.withDefault(1),
  Options.withDescription("Minimum files required to include directory")
)

/**
 * CLI option for migration status filter.
 *
 * Filters directories by their migration status.
 */
const statusOption = Options.choice("status", ["migrated", "in-progress", "all"] as const).pipe(
  Options.withDefault("all" as const),
  Options.withDescription("Filter by status: migrated, in-progress, or all")
)

/**
 * CLI option for overwrite mode.
 *
 * When true, overwrites existing norm summary files.
 */
const overwriteOption = Options.boolean("overwrite").pipe(
  Options.withDefault(false),
  Options.withDescription("Overwrite existing norm summaries")
)

/**
 * Capture norms command - analyzes checkpoint history and generates directory summaries.
 *
 * In prepare-only mode (default), displays what would be captured and prints
 * next-step guidance for users.
 *
 * When --no-prepare-only is set, writes JSON summaries using Schema.encodeSync
 * to ensure DateTimeUtc fields serialize correctly.
 *
 * Exit codes:
 * - 0: Success (norms captured or guidance printed)
 * - 1: Error (checkpoint loading, norm detection, or file I/O failure)
 *
 * @category CLI Command
 * @since 0.6.0
 *
 * @example
 * ```bash
 * # Preview norms for all directories
 * effect-migrate norms capture
 *
 * # Capture norms for migrated directories only
 * effect-migrate norms capture --status migrated --no-prepare-only
 * ```
 */
const normsCaptureCommand = Command.make(
  "capture",
  {
    prepareOnly: prepareOnlyOption,
    directory: directoryOption,
    lookback: lookbackOption,
    minFiles: minFilesOption,
    status: statusOption,
    overwrite: overwriteOption,
    ampOut: ampOutOption()
  },
  ({ prepareOnly, directory, lookback, minFiles, status, overwrite, ampOut }) =>
    Effect.gen(function*() {
      const outputDir = getAmpOutPathWithDefault(ampOut, ".amp/effect-migrate")
      const summarizer = yield* DirectorySummarizer

      // TODO: Implement directory discovery from checkpoints
      // For now, use provided directory or fail with guidance
      const directoryPath = Option.getOrNull(directory)
      if (!directoryPath) {
        yield* Console.error("❌ --directory option is required in this implementation")
        yield* Console.log("\nExample: effect-migrate norms capture --directory src/services")
        return 1
      }

      if (prepareOnly) {
        yield* Console.log("🔍 Prepare-only mode: analyzing checkpoint history...")
        yield* Console.log(`   Directory: ${directoryPath}`)
        yield* Console.log(`   Lookback window: ${lookback} checkpoints`)
        yield* Console.log(`   Output directory: ${outputDir}`)
        yield* Console.log("")
      }

      // Generate directory summary
      const summary = yield* summarizer.summarize(outputDir, directoryPath, lookback).pipe(
        Effect.catchAll(error =>
          Effect.gen(function*() {
            yield* Console.error(`❌ Failed to generate summary for ${directoryPath}:`)
            yield* Console.error(Cause.pretty(Cause.fail(error)))
            return yield* Effect.fail(error)
          })
        )
      )

      // Filter by status if requested
      if (status !== "all" && summary.status !== status) {
        if (prepareOnly) {
          yield* Console.log(
            `⊘ Skipping ${directoryPath}: status is "${summary.status}", filter is "${status}"`
          )
        }
        return 0
      }

      // Filter by min files threshold
      if (summary.files.total < minFiles) {
        if (prepareOnly) {
          yield* Console.log(
            `⊘ Skipping ${directoryPath}: only ${summary.files.total} files (min: ${minFiles})`
          )
        }
        return 0
      }

      if (prepareOnly) {
        // Print summary without writing
        yield* Console.log(`✓ ${directoryPath}`)
        yield* Console.log(`  Status: ${summary.status}`)
        yield* Console.log(
          `  Files: ${summary.files.total} (${summary.files.clean} clean, ${summary.files.withViolations} with violations)`
        )
        yield* Console.log(`  Norms: ${summary.norms.length}`)

        for (const norm of summary.norms) {
          yield* Console.log(
            `    - ${norm.ruleId} (${norm.severity}): ${norm.violationsFixed} violations fixed`
          )
        }

        yield* Console.log("")
        yield* Console.log("📝 Next steps:")
        yield* Console.log("  1. Review the detected norms above")
        yield* Console.log("  2. Verify they match your expectations")
        yield* Console.log("  3. Run with --no-prepare-only to write summaries to disk")
        yield* Console.log("")
        yield* Console.log("Example:")
        yield* Console.log(
          `  effect-migrate norms capture --directory ${directoryPath} --no-prepare-only`
        )
      } else {
        // Write summary to disk using Schema.encodeSync for proper DateTimeUtc serialization
        const fs = yield* FileSystem.FileSystem

        const summaryJson = Schema.encodeSync(
          Schema.parseJson(Schema.Struct({ summary: Schema.Unknown }))
        )({ summary })

        const outputPath = `${outputDir}/norms/${directoryPath.replace(/\//g, "_")}.json`

        // Check if file exists and overwrite flag
        const exists = yield* fs.exists(outputPath)
        if (exists && !overwrite) {
          yield* Console.log(
            `⊘ Skipping ${directoryPath}: file exists (use --overwrite to replace)`
          )
          return 0
        }

        yield* fs.makeDirectory(`${outputDir}/norms`, { recursive: true })
        yield* fs.writeFileString(outputPath, summaryJson)

        yield* Console.log(`✓ Wrote norm summary: ${outputPath}`)
      }

      return 0
    }).pipe(
      Effect.catchAll(error =>
        Effect.gen(function*() {
          yield* Console.error("❌ Norms capture failed:")
          yield* Console.error(Cause.pretty(Cause.fail(error)))
          return 1
        })
      ),
      Effect.provide(DirectorySummarizerLive),
      Effect.provide(NodeContext.layer)
    )
)

/**
 * Main norms command with subcommands.
 *
 * Currently provides only the `capture` subcommand.
 *
 * Usage: effect-migrate norms <subcommand>
 *
 * @category CLI Command
 * @since 0.6.0
 */
export const normsCommand = Command.make("norms", {}, () =>
  Effect.gen(function*() {
    yield* Console.log("Use 'norms capture' to analyze and generate norm summaries")
    return 0
  })).pipe(Command.withSubcommands([normsCaptureCommand]))
