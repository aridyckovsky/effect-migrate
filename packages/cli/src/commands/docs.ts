import * as Command from "@effect/cli/Command"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"

export const docsCommand = Command.make("docs", {}, () =>
  Effect.gen(function*() {
    yield* Console.log("📚 Docs command - coming soon")
    yield* Console.log("This will enforce documentation governance rules")
    return 0
  }))
