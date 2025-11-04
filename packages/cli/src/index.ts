#!/usr/bin/env node

import * as Command from "@effect/cli/Command"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
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

const program = Command.run(cli, {
  name: "effect-migrate",
  version: "0.1.0"
})(process.argv)

program.pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
