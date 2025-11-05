/**
 * Tests for config merging functionality.
 *
 * @module @effect-migrate/cli/loaders/__tests__/config
 */

import type { Config } from "@effect-migrate/core"
import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { mergeConfig } from "../config.js"

it.effect("should use user config when no defaults provided", () =>
  Effect.gen(function*() {
    const defaults = {}
    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd(), exclude: ["node_modules/**"] },
      patterns: []
    }

    const merged = mergeConfig(defaults, userConfig)

    expect(merged.version).toBe(1)
    expect(merged.paths.exclude).toEqual(["node_modules/**"])
  }))

it.effect("should override preset defaults with user config", () =>
  Effect.gen(function*() {
    const defaults = {
      paths: {
        exclude: ["node_modules/**", "dist/**"]
      },
      concurrency: 4
    }

    const userConfig: Config = {
      version: 1,
      paths: {
        root: process.cwd(),
        exclude: ["build/**"] // User override
      },
      patterns: []
    }

    const merged = mergeConfig(defaults, userConfig)

    // User's exclude should win
    expect(merged.paths.exclude).toEqual(["build/**"])
    // User didn't specify concurrency, so preset default should apply
    expect((merged as any).concurrency).toBe(4)
  }))

it.effect("should deep merge nested objects - user wins", () =>
  Effect.gen(function*() {
    const defaults = {
      paths: {
        root: "/default/root",
        exclude: ["node_modules/**"]
      },
      report: {
        format: "console",
        groupBy: "severity"
      }
    }

    const userConfig: Config = {
      version: 1,
      paths: {
        root: "/user/root", // Override
        exclude: ["dist/**"] // Override
      },
      report: {
        format: "json" // Override
        // groupBy not specified, should inherit from defaults
      },
      patterns: []
    }

    const merged = mergeConfig(defaults, userConfig)

    // User overrides
    expect(merged.paths.root).toBe("/user/root")
    expect(merged.paths.exclude).toEqual(["dist/**"])
    expect((merged.report as any).format).toBe("json")

    // Inherited from defaults
    expect((merged.report as any).groupBy).toBe("severity")
  }))

it.effect("should apply default for field not set by user", () =>
  Effect.gen(function*() {
    const defaults = {
      concurrency: 4,
      paths: {
        exclude: ["node_modules/**"]
      }
    }

    const userConfig: Config = {
      version: 1,
      paths: {
        root: process.cwd()
        // exclude not specified
      },
      patterns: []
      // concurrency not specified
    }

    const merged = mergeConfig(defaults, userConfig)

    // User didn't specify these, should use defaults
    expect((merged as any).concurrency).toBe(4)
    expect(merged.paths.exclude).toEqual(["node_modules/**"])

    // User specified these
    expect(merged.version).toBe(1)
    expect(merged.paths.root).toBe(process.cwd())
  }))

it.effect("should handle empty presets array in user config", () =>
  Effect.gen(function*() {
    const defaults = {
      paths: { exclude: ["node_modules/**"] }
    }

    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd() },
      presets: [], // Empty presets
      patterns: []
    }

    const merged = mergeConfig(defaults, userConfig)

    expect(merged.presets).toEqual([])
    expect(merged.paths.exclude).toEqual(["node_modules/**"])
  }))

it.effect("should preserve user config arrays without merging", () =>
  Effect.gen(function*() {
    const defaults = {
      paths: {
        exclude: ["node_modules/**", "dist/**", "build/**"]
      }
    }

    const userConfig: Config = {
      version: 1,
      paths: {
        root: process.cwd(),
        exclude: ["custom/**"] // User's array should replace, not merge
      },
      patterns: []
    }

    const merged = mergeConfig(defaults, userConfig)

    // User array replaces preset array, doesn't concatenate
    expect(merged.paths.exclude).toEqual(["custom/**"])
    expect(merged.paths.exclude.length).toBe(1)
  }))

it.effect("should handle preset with patterns field", () =>
  Effect.gen(function*() {
    const defaults = {
      patterns: [
        {
          id: "preset-pattern-1",
          pattern: "test-pattern",
          message: "Test message"
        }
      ]
    }

    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd() },
      patterns: [
        {
          id: "user-pattern-1",
          pattern: "user-pattern",
          message: "User message"
        }
      ]
    }

    const merged = mergeConfig(defaults, userConfig)

    // User patterns should win
    expect(merged.patterns).toBeDefined()
    expect(merged.patterns?.length).toBe(1)
    expect(merged.patterns?.[0].id).toBe("user-pattern-1")
  }))

it.effect("should handle preset with boundaries field", () =>
  Effect.gen(function*() {
    const defaults = {
      boundaries: [
        {
          id: "preset-boundary-1",
          from: "src/**",
          disallow: ["node:*"]
        }
      ]
    }

    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd() },
      patterns: []
      // No boundaries specified by user
    }

    const merged = mergeConfig(defaults, userConfig)

    // Should inherit preset boundaries
    expect((merged as any).boundaries).toBeDefined()
    expect((merged as any).boundaries.length).toBe(1)
    expect((merged as any).boundaries[0].id).toBe("preset-boundary-1")
  }))

it.effect("should handle complex nested merge", () =>
  Effect.gen(function*() {
    const defaults = {
      paths: {
        root: "/preset/root",
        exclude: ["node_modules/**"]
      },
      report: {
        format: "console",
        groupBy: "severity",
        verbose: true
      },
      concurrency: 4
    }

    const userConfig: Config = {
      version: 1,
      paths: {
        root: "/user/root",
        exclude: ["dist/**"]
      },
      report: {
        format: "json"
        // groupBy and verbose not specified
      },
      patterns: []
      // concurrency not specified
    }

    const merged = mergeConfig(defaults, userConfig)

    // User overrides
    expect(merged.paths.root).toBe("/user/root")
    expect(merged.paths.exclude).toEqual(["dist/**"])
    expect((merged.report as any).format).toBe("json")

    // Defaults applied where user didn't specify
    expect((merged.report as any).groupBy).toBe("severity")
    expect((merged.report as any).verbose).toBe(true)
    expect((merged as any).concurrency).toBe(4)
  }))

it.effect("should handle undefined user fields", () =>
  Effect.gen(function*() {
    const defaults = {
      paths: { exclude: ["node_modules/**"] },
      concurrency: 4,
      report: { format: "console" }
    }

    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd() },
      patterns: []
    }

    const merged = mergeConfig(defaults, userConfig)

    // Defaults should be applied for missing fields
    expect((merged as any).concurrency).toBe(4)
    expect((merged as any).report).toBeDefined()
    expect((merged as any).report.format).toBe("console")
    expect(merged.paths.exclude).toEqual(["node_modules/**"])
  }))

it.effect("should handle user config with presets field", () =>
  Effect.gen(function*() {
    const defaults = {
      paths: { exclude: ["node_modules/**"] }
    }

    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd() },
      presets: ["@effect-migrate/preset-basic"],
      patterns: []
    }

    const merged = mergeConfig(defaults, userConfig)

    expect(merged.presets).toEqual(["@effect-migrate/preset-basic"])
    expect(merged.paths.exclude).toEqual(["node_modules/**"])
  }))

it.effect("should not mutate original user config", () =>
  Effect.gen(function*() {
    const defaults = {
      paths: { exclude: ["node_modules/**"] },
      concurrency: 4
    }

    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd() },
      patterns: []
    }

    const originalPaths = userConfig.paths
    const merged = mergeConfig(defaults, userConfig)

    // Original should be unchanged
    expect(userConfig.paths.exclude).toBeUndefined()
    expect((userConfig as any).concurrency).toBeUndefined()

    // Merged should have defaults
    expect((merged as any).concurrency).toBe(4)
    expect(merged.paths.exclude).toEqual(["node_modules/**"])
  }))

it.effect("should handle null vs undefined values", () =>
  Effect.gen(function*() {
    const defaults = {
      paths: { exclude: ["node_modules/**"] },
      report: { format: "console" }
    }

    const userConfig: Config = {
      version: 1,
      paths: { root: process.cwd() },
      patterns: []
      // report is undefined (not set)
    }

    const merged = mergeConfig(defaults, userConfig)

    // Should apply default for undefined field
    expect((merged as any).report).toBeDefined()
    expect((merged as any).report.format).toBe("console")
  }))
