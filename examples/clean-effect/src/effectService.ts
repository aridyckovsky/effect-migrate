// Already migrated to Effect - should have no violations
import { Effect } from "effect"
import * as FileSystem from "@effect/platform/FileSystem"

export const readConfig = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(path)
    return JSON.parse(content)
  })

export const processData = (input: string) =>
  Effect.gen(function* () {
    const result = input.toUpperCase()
    return result
  })
