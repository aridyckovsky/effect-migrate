import * as Effect from "effect/Effect"

export const helper = () =>
  Effect.succeed({ data: "test" })

async function legacyHelper() {
  return Promise.resolve("legacy")
}

export { legacyHelper }
