import type { Rule } from "@effect-migrate/core"
import * as Effect from "effect/Effect"

// Example boundary rule - will be expanded later
export const boundaryRules: Rule[] = [
  {
    id: "no-promise-in-effect-code",
    kind: "boundary",
    run: ctx =>
      Effect.gen(function*() {
        // TODO: Implement boundary checking
        // Prevent Promise imports in Effect-first code
        return []
      })
  }
]
