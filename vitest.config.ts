import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    fileParallelism: true,
    testTimeout: 30000,
    projects: [
      {
        test: {
          name: "@effect-migrate/core",
          root: "./packages/core",
          environment: "node",
          globals: true,
          include: ["src/**/*.{test,spec}.ts", "test/**/*.{test,spec}.ts"]
        }
      },
      {
        test: {
          name: "@effect-migrate/cli",
          root: "./packages/cli",
          environment: "node",
          globals: true,
          include: ["src/**/*.{test,spec}.ts", "test/**/*.{test,spec}.ts"]
        }
      },
      {
        test: {
          name: "@effect-migrate/preset-basic",
          root: "./packages/preset-basic",
          environment: "node",
          globals: true,
          include: ["src/**/*.{test,spec}.ts", "test/**/*.{test,spec}.ts"]
        }
      }
    ]
  }
})
