import { defineConfig } from "@effect-migrate/core"

/**
 * effect-migrate configuration
 *
 * This config demonstrates:
 * - Loading presets (enabled for testing, may fail in monorepo due to workspace resolution)
 * - Custom pattern rules specific to this monorepo
 * - Boundary rules for package architecture
 *
 * Preset behavior:
 * - Preset rules combine with your custom patterns/boundaries
 * - Preset defaults (like paths.exclude) are merged with your config
 * - Your config values always override preset defaults
 * - Failed preset loading gracefully degrades (warns but continues with user rules)
 *
 * Note: In monorepo development, preset loading via dynamic import() may fail
 * due to workspace resolution. This is expected and the CLI handles it gracefully.
 * When published to npm, preset loading works correctly.
 */
export default defineConfig({
  version: 1,

  // Preset loading:
  presets: ["@effect-migrate/preset-basic"],
  // The preset provides:
  // - Pattern rules: no-async-await, no-new-promise, no-try-catch, etc.
  // - Boundary rules: no-node-in-services, no-platform-node-in-core, etc.
  // - Default excludes: node_modules, dist, build artifacts

  paths: {
    root: "packages",
    // Focus dogfooding on actual source code (not preset examples/fixtures)
    include: [
      "packages/**/src/**/*.ts",
      "packages/**/bin/**/*.ts" // CLI entrypoints if needed
    ],
    exclude: [
      // Build artifacts and generated files
      "**/node_modules/**",
      "**/{dist,build,lib,out,coverage}/**",
      "**/*.d.ts",

      // Tests and fixtures
      "**/*.{test,spec}.ts",
      "**/__tests__/**",
      "**/{test,tests}/**",
      "**/{__fixtures__,fixtures}/**",

      // Examples (intentionally show anti-patterns)
      "**/{examples,example}/**",

      // Preset packages (intentionally contain anti-pattern examples in strings/comments)
      "packages/preset-*/**"
    ]
  },

  // Custom pattern rules specific to this monorepo
  patterns: [
    {
      id: "no-async-await",
      pattern: "\\basync\\s+(function\\s+\\w+|(\\([^)]*\\)|[\\w]+)\\s*=>)",
      files: "packages/**/src/**/*.ts",
      message: "Replace async/await with Effect.gen - we should be using Effect patterns",
      severity: "error",
      docsUrl: "https://effect.website/docs/essentials/effect-type"
    },
    {
      id: "no-barrel-imports",
      pattern: 'import\\s+{[^}]+}\\s+from\\s+["\']effect["\']',
      files: "packages/**/src/**/*.ts",
      message: "Import from specific modules (e.g., 'effect/Effect') to improve tree-shaking",
      severity: "warning",
      docsUrl: "https://effect.website/docs/guides/style/importing"
    },
    {
      id: "no-promise-run",
      pattern: "Effect\\.runPromise",
      files: "packages/**/src/**/*.ts",
      message: "Avoid runPromise in library code - only use in CLI entry points",
      severity: "warning"
    }
  ],

  // Boundary rules for package architecture
  boundaries: [
    {
      id: "core-no-cli-deps",
      from: "packages/core/src/**/*.ts",
      disallow: ["@effect/cli", "@effect-migrate/cli"],
      message: "Core package should not depend on CLI - maintain clean separation",
      severity: "error"
    },
    {
      id: "core-no-preset-deps",
      from: "packages/core/src/**/*.ts",
      disallow: ["@effect-migrate/preset-*"],
      message: "Core should be agnostic to presets",
      severity: "error"
    }
  ],

  // Performance: number of concurrent file operations
  concurrency: 4
})
