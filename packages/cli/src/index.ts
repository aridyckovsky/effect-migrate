#!/usr/bin/env node

import { getPackageMeta, ProcessInfoLive, Time } from "@effect-migrate/core"
import * as Command from "@effect/cli/Command"
import * as HelpDoc from "@effect/cli/HelpDoc"
import * as Span from "@effect/cli/HelpDoc/Span"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { normalizeAmpOutFlag } from "./amp/normalizeArgs.js"
import { auditCommand } from "./commands/audit.js"
import { checkpointsCommand } from "./commands/checkpoints.js"
import { initCommand } from "./commands/init.js"
import { metricsCommand } from "./commands/metrics.js"
import { normsCommand } from "./commands/norms.js"
import { threadCommand } from "./commands/thread.js"

const mainCommand = Command.make("effect-migrate", {}, () =>
  Effect.gen(function*() {
    yield* Effect.log("effect-migrate - Effect migration toolkit")
    yield* Effect.log("Run with --help for usage information")
    return 0
  }))

const cli = mainCommand.pipe(
  Command.withSubcommands([
    auditCommand,
    checkpointsCommand,
    initCommand,
    metricsCommand,
    normsCommand,
    threadCommand
  ])
)

// Normalize --amp-out bare flag to --amp-out= for parser compatibility
const argv = normalizeAmpOutFlag(process.argv)

// Main program with proper Effect composition
const main = Effect.gen(function*() {
  // Get package version from package.json
  const { toolVersion } = yield* getPackageMeta

  // Run CLI with full configuration
  return yield* Command.run(cli, {
    name: "effect-migrate",
    version: toolVersion,
    executable: "effect-migrate",
    summary: Span.text("TypeScript migration toolkit using Effect patterns"),
    footer: HelpDoc.p(
      "Documentation: https://github.com/aridyckovsky/effect-migrate\n" +
        "Report issues: https://github.com/aridyckovsky/effect-migrate/issues"
    )
  })(argv)
}).pipe(
  Effect.catchAll(error =>
    Effect.gen(function*() {
      yield* Effect.logError(`Fatal error: ${error}`)
      return 1
    })
  )
)

// Build application layer with all dependencies
// Time.Default requires Clock - provide it explicitly
// ProcessInfoLive has no requirements
// NodeContext.layer provides FileSystem, Path, Terminal, etc.
const AppLayer = Layer.mergeAll(
  NodeContext.layer,
  ProcessInfoLive,
  Time.Default
).pipe(Layer.provideMerge(Layer.succeed(Clock.Clock, Clock.make())))

NodeRuntime.runMain(main.pipe(Effect.provide(AppLayer)))

// ============================================================================
// Public Exports (for library usage)
// ============================================================================

/**
 * Workspace-aware PresetLoader layer for CLI.
 *
 * Attempts to resolve presets from local workspace (monorepo) first,
 * then falls back to npm resolution.
 */
export { PresetLoaderWorkspaceLive } from "./layers/PresetLoaderWorkspace.js"
