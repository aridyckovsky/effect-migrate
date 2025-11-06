import { defineConfig } from "@effect-migrate/core"

/**
 * Legacy API example configuration
 *
 * This example shows a legacy codebase with async/await patterns
 * that need to be migrated to Effect patterns.
 *
 * Demonstrates:
 * - Using preset-basic for common migration rules
 * - Custom patterns for specific API patterns
 * - Proper path configuration for TypeScript projects
 */
export default defineConfig({
  version: 1,

  // Load preset-basic for common Effect migration rules
  presets: ["@effect-migrate/preset-basic"],

  paths: {
    root: "src",
    include: ["**/*.ts"],
    exclude: ["node_modules/**", "dist/**", "**/*.test.ts"]
  },

  // Additional custom rules specific to this API
  patterns: [
    {
      id: "no-express-middleware",
      pattern: "\\(req:\\s*Request,\\s*res:\\s*Response",
      files: "**/*.ts",
      message: "Consider migrating Express middleware to @effect/platform HttpServer",
      severity: "warning",
      docsUrl: "https://effect.website/docs/guides/http-server"
    }
  ],

  concurrency: 4
})
