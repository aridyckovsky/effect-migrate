/**
 * Tests for config merging
 *
 * @module @effect-migrate/core/config/merge.test
 */

import { describe, expect, it } from "vitest"
import { mergeConfig } from "../../src/config/merge.js"
import type { Config } from "../../src/schema/Config.js"

describe("mergeConfig", () => {
  it("should preserve user config when defaults are empty", () => {
    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd(), exclude: [] },
      patterns: []
    }
    const defaults = {}
    const result = mergeConfig(defaults, userConfig)

    expect(result).toEqual(userConfig)
  })

  it("should add defaults for undefined fields", () => {
    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd(), exclude: [] },
      patterns: []
    }
    const defaults = {
      concurrency: 4,
      tags: ["preset-basic"]
    }
    const result = mergeConfig(defaults, userConfig)

    expect(result).toEqual({
      version: 1,
      paths: { root: process.cwd(), exclude: [] },
      patterns: [],
      concurrency: 4,
      tags: ["preset-basic"]
    })
  })

  it("should not override user-specified values", () => {
    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd(), exclude: [] },
      patterns: [],
      concurrency: 8
    }
    const defaults = {
      concurrency: 4
    }
    const result = mergeConfig(defaults, userConfig)

    expect(result.concurrency).toBe(8)
  })

  it("should deep merge nested objects", () => {
    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd(), exclude: ["dist/**"] },
      patterns: []
    }
    const defaults = {
      paths: {
        exclude: ["node_modules/**", ".git/**"],
        include: ["src/**"]
      }
    }
    const result = mergeConfig(defaults, userConfig)

    expect(result.paths).toEqual({
      root: process.cwd(),
      exclude: ["dist/**"], // User value wins
      include: ["src/**"] // Added from defaults
    })
  })

  it("should handle preset defaults with user overrides", () => {
    const userConfig: Config = {
      version: 1,
      paths: {
        root: "/project",
        exclude: ["custom/**"]
      },
      patterns: [
        {
          id: "user-rule",
          pattern: /test/g,
          files: "**/*.ts",
          message: "User rule",
          severity: "warning"
        }
      ]
    }
    const defaults = {
      paths: {
        exclude: ["node_modules/**", "dist/**"],
        include: ["src/**", "lib/**"]
      },
      concurrency: 4,
      report: {
        failOn: ["error"]
      }
    }
    const result = mergeConfig(defaults, userConfig)

    expect(result).toEqual({
      version: 1,
      paths: {
        root: "/project",
        exclude: ["custom/**"], // User wins
        include: ["src/**", "lib/**"] // From defaults
      },
      patterns: [
        {
          id: "user-rule",
          pattern: /test/g,
          files: "**/*.ts",
          message: "User rule",
          severity: "warning"
        }
      ],
      concurrency: 4, // From defaults
      report: {
        failOn: ["error"]
      }
    })
  })

  it("should handle empty preset defaults", () => {
    const userConfig: Config = {
      version: 1,
      paths: { root: ".", exclude: [] },
      patterns: []
    }
    const defaults = {}
    const result = mergeConfig(defaults, userConfig)

    expect(result).toEqual(userConfig)
  })

  it("should replace arrays, not merge them", () => {
    const userConfig: Config = {
      version: 1,
      paths: { root: ".", exclude: ["user-exclude/**"] },
      patterns: []
    }
    const defaults = {
      paths: {
        exclude: ["default-exclude/**", "node_modules/**"]
      }
    }
    const result = mergeConfig(defaults, userConfig)

    // User's exclude array should win completely
    expect(result.paths?.exclude).toEqual(["user-exclude/**"])
  })

  it("should handle nested config with migrations tracking", () => {
    const userConfig: Config = {
      version: 1,
      paths: { root: ".", exclude: [] },
      patterns: [],
      migrations: [
        {
          id: "effect-migration",
          description: "Migrate to Effect",
          globs: ["src/**/*.ts"],
          marker: "MIGRATE",
          statuses: { todo: "TODO", done: "DONE" },
          goal: {
            type: "percentage",
            target: 80
          }
        }
      ]
    }
    const defaults = {
      migrations: [
        {
          id: "effect-migration",
          description: "Migrate to Effect",
          globs: ["src/**/*.ts"],
          marker: "MIGRATE",
          statuses: { todo: "TODO", done: "DONE" },
          goal: {
            type: "percentage",
            target: 100
          }
        }
      ]
    }
    const result = mergeConfig(defaults, userConfig)

    // User config should override defaults entirely
    expect(result.migrations?.length).toBe(1)
    expect(result.migrations?.[0]?.goal?.target).toBe(80)
  })

  it("should maintain type safety", () => {
    const userConfig: Config = {
      version: 1,
      paths: { root: ".", exclude: [] },
      patterns: []
    }
    const defaults = {
      concurrency: 4
    }
    const result = mergeConfig(defaults, userConfig)

    // TypeScript should infer this as Config
    const _typeCheck: Config = result
    expect(_typeCheck.version).toBe(1)
  })
})
