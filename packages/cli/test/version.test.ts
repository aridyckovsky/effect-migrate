import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe("CLI Package", () => {
  it.effect("package.json has valid version", () =>
    Effect.gen(function*() {
      const packageJsonPath = join(__dirname, "..", "package.json")
      const content = readFileSync(packageJsonPath, "utf-8")
      const pkg = JSON.parse(content)

      expect(pkg.name).toBe("@effect-migrate/cli")
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/)
    }))

  it.effect("CLI can be imported", () =>
    Effect.gen(function*() {
      const cliModule = yield* Effect.promise(() => import("../src/index.js"))

      expect(cliModule).toBeDefined()
      expect(typeof cliModule).toBe("object")
    }))
})
