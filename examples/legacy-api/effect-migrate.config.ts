export default {
  version: 1,
  paths: {
    root: "src",
    include: ["**/*.ts"],
    exclude: ["node_modules/**", "dist/**"]
  },
  // For now, define rules inline - later we'll load from presets
  patterns: [
    {
      id: "no-async-await",
      pattern: "\\basync\\s+(function\\s+\\w+|(\\([^)]*\\)|[\\w]+)\\s*=>)",
      files: "**/*.ts",
      message: "Replace async/await with Effect.gen for composable async operations",
      severity: "warning"
    },
    {
      id: "no-promise-constructor",
      pattern: "new\\s+Promise\\s*<",
      files: "**/*.ts",
      message: "Replace new Promise() with Effect.async or Effect.tryPromise",
      severity: "warning"
    },
    {
      id: "no-try-catch",
      pattern: "\\btry\\s*\\{",
      files: "**/*.ts",
      message: "Replace try/catch with Effect.catchAll or Effect.tryPromise",
      severity: "warning"
    }
  ],
  concurrency: 4
}
