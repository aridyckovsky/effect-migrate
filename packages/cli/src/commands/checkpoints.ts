import { deriveResultKeys, listCheckpoints, readCheckpoint } from "@effect-migrate/core"
import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Console from "effect/Console"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"

const ampOutOption = Options.text("amp-out").pipe(
  Options.withDefault(".amp/effect-migrate"),
  Options.withDescription("Path to Amp context directory")
)

const jsonOption = Options.boolean("json").pipe(
  Options.withDefault(false),
  Options.withDescription("Output as JSON")
)

const limitOption = Options.integer("limit").pipe(
  Options.withDefault(10),
  Options.withDescription("Maximum number of checkpoints to list")
)

/**
 * List checkpoints with summary information.
 *
 * Usage: effect-migrate checkpoints list [--limit <n>] [--json]
 */
const checkpointsListCommand = Command.make(
  "list",
  { ampOut: ampOutOption, json: jsonOption, limit: limitOption },
  ({ ampOut, json, limit }) =>
    Effect.gen(function*() {
      const checkpoints = yield* listCheckpoints(ampOut, limit)

      if (json) {
        yield* Console.log(JSON.stringify(checkpoints, null, 2))
        return 0
      }

      if (checkpoints.length === 0) {
        yield* Console.log("No checkpoints found")
        return 0
      }

      // Table header
      yield* Console.log(
        "ID                                   | Timestamp           | Thread                               | Errors | Warnings | Info  | Total | Delta"
      )
      yield* Console.log(
        "-------------------------------------+---------------------+--------------------------------------+--------+----------+-------+-------+-------"
      )

      // Table rows
      for (const cp of checkpoints) {
        const deltaStr = cp.delta
          ? `${cp.delta.totalFindings >= 0 ? "+" : ""}${cp.delta.totalFindings}`
          : "-"
        const timestampStr = DateTime.formatIso(cp.timestamp)
        const threadStr = cp.thread ?? "-"

        yield* Console.log(
          `${cp.id.padEnd(36)} | ${timestampStr.padEnd(19)} | ${threadStr.padEnd(36)} | ${
            String(
              cp.summary.errors
            ).padStart(6)
          } | ${String(cp.summary.warnings).padStart(8)} | ${
            String(
              cp.summary.info
            ).padStart(5)
          } | ${String(cp.summary.totalFindings).padStart(5)} | ${
            deltaStr.padStart(
              5
            )
          }`
        )
      }

      return 0
    })
)

/**
 * Show the latest checkpoint.
 *
 * Usage: effect-migrate checkpoints latest
 */
const checkpointsLatestCommand = Command.make(
  "latest",
  { ampOut: ampOutOption },
  ({ ampOut }) =>
    Effect.gen(function*() {
      const checkpoints = yield* listCheckpoints(ampOut, 1)

      if (checkpoints.length === 0) {
        yield* Console.error("No checkpoints found")
        return 1
      }

      const latest = checkpoints[0]
      yield* Console.log(`Latest checkpoint: ${latest.id}`)
      yield* Console.log(`Timestamp: ${DateTime.formatIso(latest.timestamp)}`)
      yield* Console.log(
        `Errors: ${latest.summary.errors}, Warnings: ${latest.summary.warnings}, Info: ${latest.summary.info}`
      )
      yield* Console.log(`Total findings: ${latest.summary.totalFindings}`)

      if (latest.delta) {
        const deltaStr = latest.delta.totalFindings >= 0 ? "+" : ""
        yield* Console.log(`Delta: ${deltaStr}${latest.delta.totalFindings}`)
      }

      return 0
    })
)

/**
 * Show details of a specific checkpoint.
 *
 * Usage: effect-migrate checkpoints show <id>
 */
const checkpointsShowCommand = Command.make(
  "show",
  { ampOut: ampOutOption, json: jsonOption, id: Args.text({ name: "id" }) },
  ({ ampOut, json, id }) =>
    Effect.gen(function*() {
      const checkpoint = yield* readCheckpoint(ampOut, id).pipe(
        Effect.catchAll(error =>
          Effect.gen(function*() {
            yield* Console.error(`Failed to read checkpoint ${id}: ${error}`)
            return yield* Effect.fail(error)
          })
        )
      )

      if (json) {
        yield* Console.log(JSON.stringify(checkpoint, null, 2))
      } else {
        yield* Console.log(`Checkpoint: ${checkpoint.checkpointId}`)
        yield* Console.log(`Revision: ${checkpoint.revision}`)
        yield* Console.log(`Timestamp: ${DateTime.formatIso(checkpoint.timestamp)}`)

        if (checkpoint.thread) {
          yield* Console.log(`Thread: ${checkpoint.thread}`)
        }

        yield* Console.log(`Errors: ${checkpoint.findings.summary.errors}`)
        yield* Console.log(`Warnings: ${checkpoint.findings.summary.warnings}`)
        yield* Console.log(`Info: ${checkpoint.findings.summary.info}`)
        yield* Console.log(`Total findings: ${checkpoint.findings.summary.totalFindings}`)
      }

      return 0
    })
)

/**
 * Compare two checkpoints and show the delta.
 *
 * Usage: effect-migrate checkpoints diff <id1> <id2>
 */
const checkpointsDiffCommand = Command.make(
  "diff",
  { ampOut: ampOutOption, id1: Args.text({ name: "id1" }), id2: Args.text({ name: "id2" }) },
  ({ ampOut, id1, id2 }) =>
    Effect.gen(function*() {
      const cpA = yield* readCheckpoint(ampOut, id1).pipe(
        Effect.catchAll(error =>
          Effect.gen(function*() {
            yield* Console.error(`Failed to read checkpoint ${id1}: ${error}`)
            return yield* Effect.fail(error)
          })
        )
      )

      const cpB = yield* readCheckpoint(ampOut, id2).pipe(
        Effect.catchAll(error =>
          Effect.gen(function*() {
            yield* Console.error(`Failed to read checkpoint ${id2}: ${error}`)
            return yield* Effect.fail(error)
          })
        )
      )

      const keysA = deriveResultKeys(cpA.findings)
      const keysB = deriveResultKeys(cpB.findings)

      const setA = new Set(Array.from(keysA.values()))
      const setB = new Set(Array.from(keysB.values()))

      const added = Array.from(setB).filter(k => !setA.has(k)).length
      const removed = Array.from(setA).filter(k => !setB.has(k)).length

      const deltaErrors = cpB.findings.summary.errors - cpA.findings.summary.errors
      const deltaWarnings = cpB.findings.summary.warnings - cpA.findings.summary.warnings
      const deltaInfo = cpB.findings.summary.info - cpA.findings.summary.info
      const deltaTotal = cpB.findings.summary.totalFindings - cpA.findings.summary.totalFindings

      yield* Console.log(`Comparing ${id1} → ${id2}`)
      yield* Console.log(`Errors: ${deltaErrors >= 0 ? "+" : ""}${deltaErrors}`)
      yield* Console.log(`Warnings: ${deltaWarnings >= 0 ? "+" : ""}${deltaWarnings}`)
      yield* Console.log(`Info: ${deltaInfo >= 0 ? "+" : ""}${deltaInfo}`)
      yield* Console.log(`Total: ${deltaTotal >= 0 ? "+" : ""}${deltaTotal}`)
      yield* Console.log(`Added findings: ${added}`)
      yield* Console.log(`Removed findings: ${removed}`)

      return 0
    })
)

/**
 * Main checkpoints command with subcommands.
 *
 * Usage: effect-migrate checkpoints <subcommand>
 */
export const checkpointsCommand = Command.make("checkpoints", {}, () =>
  Effect.gen(function*() {
    yield* Console.log(
      "Use 'checkpoints list', 'checkpoints latest', 'checkpoints show <id>', or 'checkpoints diff <id1> <id2>'"
    )
    return 0
  })).pipe(
    Command.withSubcommands([
      checkpointsListCommand,
      checkpointsLatestCommand,
      checkpointsShowCommand,
      checkpointsDiffCommand
    ])
  )
