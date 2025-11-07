/**
 * Deep Merge Utilities
 *
 * Pure functions for merging nested objects with type safety.
 * Used by config merging and preset composition.
 *
 * @module @effect-migrate/core/utils/merge
 * @since 0.3.0
 */

/**
 * Check if value is a plain object.
 *
 * Returns true for objects created with `{}` or `new Object()`,
 * false for arrays, null, primitives, and class instances.
 *
 * @param value - Value to check
 * @returns Type predicate for plain object
 *
 * @category Type Guards
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * isPlainObject({})              // => true
 * isPlainObject({ a: 1 })        // => true
 * isPlainObject([])              // => false
 * isPlainObject(null)            // => false
 * isPlainObject(new Date())      // => false
 * ```
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

/**
 * Deep merge two objects, with source taking precedence.
 *
 * Recursively merges nested plain objects. **Arrays are replaced, not concatenated.**
 * This ensures predictable behavior: when merging configs, source arrays completely
 * override target arrays rather than appending elements.
 *
 * Properties in 'source' override properties in 'target'.
 *
 * @param target - Base object (lower priority)
 * @param source - Override object (higher priority)
 * @returns New merged object (does not mutate inputs)
 *
 * @category Utilities
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * deepMerge(
 *   { paths: { exclude: ["node_modules"] }, tags: ["a"] },
 *   { paths: { root: "src" }, tags: ["b"] }
 * )
 * // => { paths: { exclude: ["node_modules"], root: "src" }, tags: ["b"] }
 * // Note: tags array is replaced, not concatenated
 * ```
 *
 * @example
 * ```typescript
 * deepMerge(
 *   { a: { b: 1, c: 2 } },
 *   { a: { c: 3, d: 4 } }
 * )
 * // => { a: { b: 1, c: 3, d: 4 } }
 * ```
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target }

  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      const sourceValue = source[key]
      const targetValue = result[key]

      if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        )
      } else {
        // Source wins (including array replacement)
        result[key] = sourceValue
      }
    }
  }

  return result
}
