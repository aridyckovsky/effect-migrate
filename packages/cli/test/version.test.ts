import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe("CLI Package", () => {
  it.effect("package.json has valid version", () =>
  Effect.gen(function* () {
    const packageJsonPath = join(__dirname, "..", "package.json")
    const content = readFileSync(packageJsonPath, "utf-8")
    const pkg = JSON.parse(content)

    expect(pkg.name).toBe("@effect-migrate/cli")
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/)
  }))

it.effect("CLI exports main command", () =>
  Effect.gen(function* () {
    const { command } = yield* Effect.promise(() => import("../src/index.js"))

    expect(command).toBeDefined()
    expect(typeof command).toBe("object")
  }))
})
