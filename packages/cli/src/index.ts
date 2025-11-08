#!/usr/bin/env node

import { getPackageMeta } from "@effect-migrate/core"
import * as Command from "@effect/cli/Command"
import * as HelpDoc from "@effect/cli/HelpDoc"
import * as Span from "@effect/cli/HelpDoc/Span"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import { normalizeAmpOutFlag } from "./amp/normalizeArgs.js"
import { auditCommand } from "./commands/audit.js"
import { initCommand } from "./commands/init.js"
import { metricsCommand } from "./commands/metrics.js"
import { threadCommand } from "./commands/thread.js"

const mainCommand = Command.make("effect-migrate", {}, () =>
  Effect.gen(function*() {
    yield* Effect.log("effect-migrate - Effect migration toolkit")
    yield* Effect.log("Run with --help for usage information")
    return 0
  }))

const cli = mainCommand.pipe(
  Command.withSubcommands([auditCommand, initCommand, metricsCommand, threadCommand])
)

// Normalize --amp-out bare flag to --amp-out= for parser compatibility
const argv = normalizeAmpOutFlag(process.argv)

// Main program with proper Effect composition
const program = Effect.gen(function*() {
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

program.pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)

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
