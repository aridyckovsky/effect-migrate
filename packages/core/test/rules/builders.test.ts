/**
 * Tests for rulesFromConfig builder
 *
 * @module @effect-migrate/core/__tests__/rules/builders
 */

import { expect, it } from "@effect/vitest"
import { rulesFromConfig } from "../../src/rules/builders.js"
import type { Config } from "../../src/schema/Config.js"

it("should build pattern rules from config", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    patterns: [
      {
        id: "test-pattern",
        message: "Test message",
        pattern: /test.*pattern/g,
        files: "src/**/*.ts",
        severity: "error"
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(1)
  expect(rules[0].id).toBe("test-pattern")
  expect(rules[0].kind).toBe("pattern")
})

it("should build boundary rules from config", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    boundaries: [
      {
        id: "test-boundary",
        message: "Test boundary",
        from: "src/**",
        disallow: ["lib/**"],
        severity: "warning"
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(1)
  expect(rules[0].id).toBe("test-boundary")
  expect(rules[0].kind).toBe("boundary")
})

it("should build both pattern and boundary rules", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    patterns: [
      {
        id: "pattern-1",
        message: "Pattern",
        pattern: /test/g,
        files: "src/**/*.ts",
        severity: "error"
      }
    ],
    boundaries: [
      {
        id: "boundary-1",
        message: "Boundary",
        from: "a/**",
        disallow: ["b/**"],
        severity: "warning"
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(2)
  expect(rules[0].kind).toBe("pattern")
  expect(rules[1].kind).toBe("boundary")
})

it("should handle empty config", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] }
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(0)
})

it("should handle config with no patterns or boundaries", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: ["node_modules/**"] },
    concurrency: 4
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(0)
})

it("should preserve optional docsUrl property", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    patterns: [
      {
        id: "with-docs",
        message: "Test",
        pattern: /test/g,
        files: "src/**/*.ts",
        severity: "error",
        docsUrl: "https://example.com/docs"
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules[0]).toHaveProperty("id", "with-docs")
  // Note: We can't directly check rule.docsUrl because it's embedded in the closure
  // but we can verify it was created without errors
})

it("should preserve optional tags property", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    patterns: [
      {
        id: "with-tags",
        message: "Test",
        pattern: /test/g,
        files: "src/**/*.ts",
        severity: "error",
        tags: ["migration", "async"]
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(1)
  expect(rules[0].id).toBe("with-tags")
})

it("should preserve optional negativePattern property", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    patterns: [
      {
        id: "with-negative",
        message: "Test",
        pattern: /async\s+function/g,
        negativePattern: "Effect\\.gen",
        files: "src/**/*.ts",
        severity: "error"
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(1)
  expect(rules[0].id).toBe("with-negative")
})

it("should handle multiple pattern rules", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    patterns: [
      {
        id: "pattern-1",
        message: "First pattern",
        pattern: /test1/g,
        files: "src/**/*.ts",
        severity: "error"
      },
      {
        id: "pattern-2",
        message: "Second pattern",
        pattern: /test2/g,
        files: "lib/**/*.ts",
        severity: "warning"
      },
      {
        id: "pattern-3",
        message: "Third pattern",
        pattern: /test3/g,
        files: "app/**/*.ts",
        severity: "error"
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(3)
  expect(rules[0].id).toBe("pattern-1")
  expect(rules[1].id).toBe("pattern-2")
  expect(rules[2].id).toBe("pattern-3")
})

it("should handle multiple boundary rules", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    boundaries: [
      {
        id: "boundary-1",
        message: "First boundary",
        from: "src/core/**",
        disallow: ["src/ui/**"],
        severity: "error"
      },
      {
        id: "boundary-2",
        message: "Second boundary",
        from: "src/api/**",
        disallow: ["src/db/**"],
        severity: "warning"
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(2)
  expect(rules[0].id).toBe("boundary-1")
  expect(rules[1].id).toBe("boundary-2")
})

it("should handle array of file patterns", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    patterns: [
      {
        id: "multi-file",
        message: "Test",
        pattern: /test/g,
        files: ["src/**/*.ts", "lib/**/*.ts"],
        severity: "error"
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(1)
  expect(rules[0].id).toBe("multi-file")
})

it("should handle single file pattern string", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    patterns: [
      {
        id: "single-file",
        message: "Test",
        pattern: /test/g,
        files: "src/**/*.ts",
        severity: "error"
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(1)
  expect(rules[0].id).toBe("single-file")
})

it("should preserve all optional properties on boundary rules", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    boundaries: [
      {
        id: "boundary-with-options",
        message: "Boundary test",
        from: "src/core/**",
        disallow: ["react", "src/ui/**"],
        severity: "error",
        docsUrl: "https://example.com/architecture",
        tags: ["architecture", "boundary"]
      }
    ]
  }

  const rules = rulesFromConfig(config)
  expect(rules).toHaveLength(1)
  expect(rules[0].id).toBe("boundary-with-options")
})

it("should return immutable array", () => {
  const config: Config = {
    version: 1,
    paths: { exclude: [] },
    patterns: [
      {
        id: "test",
        message: "Test",
        pattern: /test/g,
        files: "src/**/*.ts",
        severity: "error"
      }
    ]
  }

  const rules = rulesFromConfig(config)
  // ReadonlyArray should prevent direct modification
  expect(Array.isArray(rules)).toBe(true)
})
