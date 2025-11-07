import { helper } from "./utils/helper.js"
import * as Effect from "effect/Effect"

export async function fetchData() {
  const data = await fetch("/api/data")
  return data.json()
}

export const processData = Effect.gen(function* () {
  const result = yield* helper()
  return result
})
