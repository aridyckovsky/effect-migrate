export default {
  version: 1,
  paths: {
    root: "src",
    include: ["**/*.ts"],
    exclude: ["node_modules/**", "dist/**"]
  },
  patterns: [
    {
      id: "no-async-await",
      pattern: "\\basync\\s+(function\\s+\\w+|(\\([^)]*\\)|[\\w]+)\\s*=>)",
      files: "**/*.ts",
      message: "Replace async/await with Effect.gen for composable async operations",
      severity: "warning",
      docsUrl: "https://effect.website/docs/essentials/effect-type"
    },
    {
      id: "no-promise-constructor",
      pattern: "new\\s+Promise\\s*<",
      files: "**/*.ts",
      message: "Replace new Promise() with Effect.async or Effect.tryPromise",
      severity: "warning",
      docsUrl: "https://effect.website/docs/guides/observability/logging"
    },
    {
      id: "no-try-catch",
      pattern: "\\btry\\s*\\{",
      files: "**/*.ts",
      message: "Replace try/catch with Effect.catchAll or Effect.catchTag for typed errors",
      severity: "warning",
      docsUrl: "https://effect.website/docs/essentials/error-management"
    },
    {
      id: "no-promise-all",
      pattern: "Promise\\.all\\s*\\(",
      files: "**/*.ts",
      message: "Replace Promise.all with Effect.forEach for concurrent Effect execution",
      severity: "warning",
      docsUrl: "https://effect.website/docs/guides/concurrency"
    },
    {
      id: "no-promise-chaining",
      pattern: "\\.then\\s*\\(",
      files: "**/*.ts",
      message: "Replace Promise.then chaining with Effect.gen or pipe for better composition",
      severity: "warning",
      docsUrl: "https://effect.website/docs/essentials/pipeline"
    },
    {
      id: "console-log",
      pattern: "console\\.(log|error|warn)\\s*\\(",
      files: "**/*.ts",
      message: "Replace console.* with Effect Console service for testable logging",
      severity: "warning",
      docsUrl: "https://effect.website/docs/guides/observability/logging"
    }
  ],
  concurrency: 4
}
