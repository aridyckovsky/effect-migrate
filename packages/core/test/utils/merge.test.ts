/**
 * Tests for deep merge utilities
 *
 * @module @effect-migrate/core/utils/merge.test
 */

import { describe, expect, it } from "vitest"
import { deepMerge, isPlainObject } from "../../src/utils/merge.js"

describe("isPlainObject", () => {
  it("should return true for plain objects", () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject({ nested: { value: true } })).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
  })

  it("should return false for arrays", () => {
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject([1, 2, 3])).toBe(false)
  })

  it("should return false for null", () => {
    expect(isPlainObject(null)).toBe(false)
  })

  it("should return false for undefined", () => {
    expect(isPlainObject(undefined)).toBe(false)
  })

  it("should return false for primitives", () => {
    expect(isPlainObject(42)).toBe(false)
    expect(isPlainObject("string")).toBe(false)
    expect(isPlainObject(true)).toBe(false)
    expect(isPlainObject(Symbol("test"))).toBe(false)
  })

  it("should return false for functions", () => {
    expect(isPlainObject(() => {})).toBe(false)
    expect(isPlainObject(function named() {})).toBe(false)
  })

  it("should return false for class instances", () => {
    class TestClass {}
    expect(isPlainObject(new TestClass())).toBe(false)
    expect(isPlainObject(new Date())).toBe(false)
    expect(isPlainObject(new Map())).toBe(false)
    expect(isPlainObject(new Set())).toBe(false)
    expect(isPlainObject(/regex/)).toBe(false)
  })
})

describe("deepMerge", () => {
  it("should perform shallow merge for simple objects", () => {
    const target = { a: 1, b: 2 }
    const source = { b: 3, c: 4 }
    const result = deepMerge(target, source)

    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  it("should perform deep merge for nested objects", () => {
    const target = { a: { b: 1, c: 2 }, d: 3 }
    const source = { a: { c: 4, e: 5 }, f: 6 }
    const result = deepMerge(target, source)

    expect(result).toEqual({
      a: { b: 1, c: 4, e: 5 },
      d: 3,
      f: 6
    })
  })

  it("should replace arrays, not merge them", () => {
    const target = { tags: ["a", "b"], values: [1, 2] }
    const source = { tags: ["c"], values: [3, 4, 5] }
    const result = deepMerge(target, source)

    expect(result).toEqual({
      tags: ["c"],
      values: [3, 4, 5]
    })
  })

  it("should handle mixed types (object to primitive)", () => {
    const target = { a: { b: 1 } }
    const source = { a: "string" }
    const result = deepMerge(target, source)

    expect(result).toEqual({ a: "string" })
  })

  it("should handle mixed types (primitive to object)", () => {
    const target = { a: "string" }
    const source = { a: { b: 1 } }
    const result = deepMerge(target, source)

    expect(result).toEqual({ a: { b: 1 } })
  })

  it("should preserve target properties not in source", () => {
    const target = { a: 1, b: 2, c: 3 }
    const source = { b: 4 }
    const result = deepMerge(target, source)

    expect(result).toEqual({ a: 1, b: 4, c: 3 })
  })

  it("should add source properties not in target", () => {
    const target = { a: 1 }
    const source = { b: 2, c: 3 }
    const result = deepMerge(target, source)

    expect(result).toEqual({ a: 1, b: 2, c: 3 })
  })

  it("should handle deeply nested objects", () => {
    const target = {
      level1: {
        level2: {
          level3: {
            value: "target"
          }
        }
      }
    }
    const source = {
      level1: {
        level2: {
          level3: {
            other: "source"
          }
        }
      }
    }
    const result = deepMerge(target, source)

    expect(result).toEqual({
      level1: {
        level2: {
          level3: {
            value: "target",
            other: "source"
          }
        }
      }
    })
  })

  it("should handle empty objects", () => {
    expect(deepMerge({}, {})).toEqual({})
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 })
    expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 })
  })

  it("should handle undefined values", () => {
    const target = { a: 1, b: undefined }
    const source = { c: undefined }
    const result = deepMerge(target, source)

    expect(result).toEqual({ a: 1, b: undefined, c: undefined })
  })

  it("should not mutate input objects", () => {
    const target = { a: { b: 1 } }
    const source = { a: { c: 2 } }
    const targetCopy = JSON.parse(JSON.stringify(target))
    const sourceCopy = JSON.parse(JSON.stringify(source))

    deepMerge(target, source)

    expect(target).toEqual(targetCopy)
    expect(source).toEqual(sourceCopy)
  })

  it("should handle null values", () => {
    const target = { a: { b: 1 } }
    const source = { a: null }
    const result = deepMerge(target, source)

    expect(result).toEqual({ a: null })
  })

  it("should handle complex config-like structures", () => {
    const target = {
      paths: {
        exclude: ["node_modules/**"],
        include: ["src/**"]
      },
      concurrency: 4,
      tags: ["preset"]
    }
    const source = {
      paths: {
        exclude: ["dist/**"],
        root: "."
      },
      tags: ["user"]
    }
    const result = deepMerge(target, source)

    expect(result).toEqual({
      paths: {
        exclude: ["dist/**"],
        include: ["src/**"],
        root: "."
      },
      concurrency: 4,
      tags: ["user"]
    })
  })

  it("should handle source taking precedence in all cases", () => {
    const target = {
      a: 1,
      b: { c: 2 },
      d: [1, 2],
      e: "target"
    }
    const source = {
      a: 10,
      b: { c: 20, f: 30 },
      d: [3, 4, 5],
      e: "source"
    }
    const result = deepMerge(target, source)

    expect(result).toEqual({
      a: 10,
      b: { c: 20, f: 30 },
      d: [3, 4, 5],
      e: "source"
    })
  })
})
