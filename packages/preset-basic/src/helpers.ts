/**
 * Shared helper utilities for pattern rules.
 *
 * This module provides common utility functions used across pattern rule implementations
 * to reduce code duplication and maintain consistency in location tracking and parsing.
 *
 * @module @effect-migrate/preset-basic/helpers
 * @since 0.3.0
 */

/**
 * Calculate line and column numbers from a character index in a string.
 *
 * Converts absolute character positions to line/column coordinates for error reporting.
 * Both line and column are 1-indexed to match editor conventions.
 *
 * @param content - Full file content string
 * @param index - Character index (0-based) in the content
 * @returns Object with 1-indexed line and column numbers
 *
 * @category Helper Utility
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * const content = "line 1\nline 2\nline 3"
 * const index = 10 // Points to 'i' in "line 2"
 * const { line, column } = getLineColumn(content, index)
 * // { line: 2, column: 5 }
 * ```
 */
export function getLineColumn(content: string, index: number): { line: number; column: number } {
  const beforeMatch = content.substring(0, index)
  const line = beforeMatch.split("\n").length
  const column = index - beforeMatch.lastIndexOf("\n")
  return { line, column }
}

/**
 * Find the matching closing brace for an opening brace.
 *
 * Uses depth tracking to handle nested braces correctly. Returns the absolute
 * position immediately after the matching closing brace.
 *
 * @param text - Text to search in (should start at or after the opening brace)
 * @param startPos - Absolute position in original content where search begins
 * @returns Absolute position immediately after the matching closing brace
 *
 * @category Helper Utility
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * const code = "Effect.gen(function* () { yield* log() })"
 * const genStart = 0
 * const afterGen = code.substring(genStart)
 * const genEnd = findMatchingBrace(afterGen, genStart)
 * const genBlock = code.substring(genStart, genEnd)
 * // genBlock = "Effect.gen(function* () { yield* log() }"
 * ```
 */
export function findMatchingBrace(text: string, startPos: number): number {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      depth++
    } else if (text[i] === "}") {
      depth--
      if (depth === 0) {
        return startPos + i + 1 // Return position AFTER closing brace
      }
    }
  }
  return startPos + text.length
}
