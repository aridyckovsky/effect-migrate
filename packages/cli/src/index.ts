#!/usr/bin/env node

import * as Command from "@effect/cli/Command"
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

const program = Command.run(cli, {
  name: "effect-migrate",
  version: "0.1.0"
})(argv)

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
