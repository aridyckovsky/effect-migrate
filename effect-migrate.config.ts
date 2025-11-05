import type { Config } from "@effect-migrate/core"

/**
 * effect-migrate configuration
 *
 * This config demonstrates:
 * - Loading presets (commented out to avoid self-detection)
 * - Custom pattern rules specific to this monorepo
 * - Boundary rules for package architecture
 *
 * Preset behavior:
 * - Preset rules combine with your custom patterns/boundaries
 * - Preset defaults (like paths.exclude) are merged with your config
 * - Your config values always override preset defaults
 */
export default {
  version: 1,

  // Preset loading example (uncomment to enable):
  // presets: ["@effect-migrate/preset-basic"],
  // The preset provides:
  // - Pattern rules: no-async-await, no-new-promise, no-try-catch, etc.
  // - Boundary rules: no-node-in-services, no-platform-node-in-core, etc.
  // - Default excludes: node_modules, dist, build artifacts

  paths: {
    root: "packages",
    include: ["**/*.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.test.ts",
      "**/examples/**",
      "**/test/fixtures/**"
    ]
  },

  // Custom pattern rules specific to this monorepo
  patterns: [
    {
      id: "no-async-await",
      pattern: "\\basync\\s+(function\\s+\\w+|(\\([^)]*\\)|[\\w]+)\\s*=>)",
      files: "**/*.ts",
      message: "Replace async/await with Effect.gen - we should be using Effect patterns",
      severity: "error",
      docsUrl: "https://effect.website/docs/essentials/effect-type"
    },
    {
      id: "no-barrel-imports",
      pattern: 'import\\s+{[^}]+}\\s+from\\s+["\']effect["\']',
      files: "**/*.ts",
      message: "Import from specific modules (e.g., 'effect/Effect') to improve tree-shaking",
      severity: "warning",
      docsUrl: "https://effect.website/docs/guides/style/importing"
    },
    {
      id: "no-promise-run",
      pattern: "Effect\\.runPromise",
      files: "**/*.ts",
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
} satisfies Config
