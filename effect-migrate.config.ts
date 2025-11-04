import type { Config } from "@effect-migrate/core"

export default {
  version: 1,
  paths: {
    root: "packages",
    include: ["**/*.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.test.ts", "**/examples/**", "**/test/fixtures/**"]
  },
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
  concurrency: 4
} satisfies Config
