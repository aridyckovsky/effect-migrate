/**
 * Init Command - Generate default configuration file
 *
 * This module provides the `init` CLI command that creates a starter
 * effect-migrate.config.ts file with example patterns, boundaries,
 * and sensible defaults for TypeScript projects.
 *
 * ## Usage
 *
 * ```bash
 * # Create config file (fails if exists)
 * effect-migrate init
 *
 * # Overwrite existing config
 * effect-migrate init --force
 * ```
 *
 * @module @effect-migrate/cli/commands/init
 * @since 0.1.0
 */

import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"

/**
 * Default configuration template with examples.
 *
 * Includes starter patterns, boundaries, presets, and path configuration
 * suitable for TypeScript projects migrating to Effect.
 *
 * @category Constant
 * @since 0.1.0
 */
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

/**
 * CLI command to initialize a new effect-migrate config file.
 *
 * Creates effect-migrate.config.ts with default configuration including
 * example pattern rules, boundary rules, preset references, and path settings.
 *
 * By default, fails if config file already exists. Use --force to overwrite.
 *
 * Exit codes:
 * - 0: Config file created successfully
 * - 1: Config file exists (without --force) or filesystem error
 *
 * @category CLI Command
 * @since 0.1.0
 *
 * @example
 * ```bash
 * # Create new config file
 * effect-migrate init
 * # => ✅ Created effect-migrate.config.ts
 * # => Next steps: ...
 *
 * # Force overwrite existing config
 * effect-migrate init --force
 * # => ✅ Created effect-migrate.config.ts (overwrote existing)
 * ```
 */
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
