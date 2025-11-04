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
      message: "Replace async/await with Effect.gen",
      severity: "warning"
    }
  ],
  concurrency: 4
}
