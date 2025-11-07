/**
 * Glob Utilities - Pattern matching for file paths
 *
 * This module provides glob pattern matching functionality for filtering files.
 * Implements a subset of glob syntax commonly used in build tools:
 *
 * - `**` (globstar) for matching any number of path segments
 * - `*` for matching within a path segment (excludes `/`)
 * - `?` for single character match
 * - `{a,b}` brace expansion for alternatives
 *
 * Paths are normalized to use forward slashes for cross-platform compatibility.
 *
 * @module @effect-migrate/core/util/glob
 * @since 0.1.0
 * @internal
 */

/**
 * Normalize path separators to forward slashes (POSIX-style).
 *
 * @param p - Path to normalize
 * @returns Normalized path with forward slashes
 *
 * @category Internal
 * @since 0.1.0
 */
const normalize = (p: string) => p.replace(/\\/g, "/")

/**
 * Match a path against a glob pattern.
 *
 * Converts glob pattern to regex and tests the path. Supports common glob
 * syntax including globstar (doublestar), wildcards (star), single char (question),
 * and brace expansion (curly braces).
 *
 * @param pattern - Glob pattern (e.g., "src/*.ts", "src/a,b.js")
 * @param path - File path to test
 * @returns true if path matches pattern, false otherwise
 *
 * @category Glob
 * @since 0.1.0
 * @internal
 *
 * @example
 * ```typescript
 * matchGlob("src/*.ts", "src/index.ts")             // true
 * matchGlob("src/*.ts", "src/index.js")             // false
 * matchGlob("src/{a,b}/*.js", "src/a/test.js")      // true
 * matchGlob("src/{a,b}/*.js", "src/c/test.js")      // false
 * ```
 */
export const matchGlob = (pattern: string, path: string): boolean => {
  const normalizedPattern = normalize(pattern)
  const normalizedPath = normalize(path)

  // Expand braces like {ts,js} -> (ts|js)
  let expandedPattern = normalizedPattern.replace(/\{([^}]+)\}/g, (_match, group) => {
    const options = group.split(",")
    return `(${options.join("|")})`
  })

  const regexPattern = expandedPattern
    .replace(/\*\*\//g, "GLOBSTAR_SLASH") // **/ placeholder
    .replace(/\/\*\*/g, "SLASH_GLOBSTAR") // /** placeholder
    .replace(/\./g, "\\.") // Escape dots
    .replace(/\*/g, "[^/]*") // Single *
    .replace(/\?/g, "[^/]")
    .replace(/GLOBSTAR_SLASH/g, "(.*/)?") // **/ matches zero or more path segments
    .replace(/SLASH_GLOBSTAR/g, "(/.*)?") // /** matches zero or more path segments

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(normalizedPath)
}
