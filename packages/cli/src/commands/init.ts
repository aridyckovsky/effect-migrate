import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"

const DEFAULT_CONFIG = `import { ConfigSchema } from "@effect-migrate/core"

export default {
  version: 1,
  
  paths: {
    root: ".",
    exclude: [
      "node_modules/**",
      "dist/**",
      ".next/**",
      "coverage/**",
      ".git/**"
    ],
    include: ["src/**/*.ts", "src/**/*.tsx"]
  },
  
  // Example pattern rules
  patterns: [
    {
      id: "effect-promise-usage",
      pattern: "new Promise",
      files: "src/**/*.ts",
      message: "Consider using Effect instead of Promise",
      severity: "warning",
      tags: ["migration", "effect"]
    }
  ],
  
  // Example boundary rules
  boundaries: [
    {
      id: "no-direct-promises",
      from: "src/**/*.ts",
      disallow: ["promise"],
      message: "Avoid mixing Promises with Effect code",
      severity: "warning"
    }
  ],
  
  // Presets
  presets: [
    "@effect-migrate/preset-basic"
  ],
  
  // Reporting
  report: {
    failOn: ["error"],
    warnOn: ["warning"]
  },
  
  concurrency: 4
}
`

export const initCommand = Command.make(
  "init",
  {
    force: Options.boolean("force").pipe(Options.withAlias("f"), Options.withDefault(false))
  },
  ({ force }) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const configPath = "effect-migrate.config.ts"

      // Check if config already exists
      const exists = yield* fs.exists(configPath).pipe(Effect.catchAll(() => Effect.succeed(false)))

      if (exists && !force) {
        yield* Console.error(`❌ Config file already exists: ${configPath}`)
        yield* Console.error(`   Use --force to overwrite`)
        return 1
      }

      // Write config file
      yield* fs.writeFileString(configPath, DEFAULT_CONFIG)

      yield* Console.log(`✅ Created ${configPath}`)
      yield* Console.log(``)
      yield* Console.log(`Next steps:`)
      yield* Console.log(`  1. Install dependencies:`)
      yield* Console.log(`     npm install -D @effect-migrate/cli @effect-migrate/preset-basic`)
      yield* Console.log(``)
      yield* Console.log(`  2. Customize the config for your project`)
      yield* Console.log(``)
      yield* Console.log(`  3. Run audit:`)
      yield* Console.log(`     npx effect-migrate audit`)

      return 0
    })
)
