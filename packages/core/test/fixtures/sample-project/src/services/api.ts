import * as Effect from "effect/Effect"
import { helper } from "../utils/helper"

export const apiService = Effect.gen(function* () {
  const result = yield* helper()
  return result
})
