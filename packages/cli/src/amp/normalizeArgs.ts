/**
 * Normalize CLI arguments to support --amp-out bare flag
 *
 * @effect/cli doesn't natively support options with optional values.
 * This normalizer converts bare --amp-out into --amp-out= (empty value)
 * so the parser can handle it and resolveAmpOut treats it as Default mode.
 *
 * @module @effect-migrate/cli/amp/normalizeArgs
 * @since 0.2.0
 */

/**
 * Normalize --amp-out bare flag to --amp-out= for parser compatibility
 *
 * Rewrites argv to convert:
 * - `--amp-out` (bare) → `--amp-out=` (empty value → Default mode)
 * - `--amp-out path` (space-separated) → preserved as-is
 * - `--amp-out=path` (equals-separated) → preserved as-is
 *
 * @param argv - Raw CLI arguments (typically process.argv.slice(2))
 * @returns Normalized arguments with bare --amp-out converted to --amp-out=
 *
 * @category Utility
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * normalizeAmpOutFlag(["audit", "--amp-out"])
 * // => ["audit", "--amp-out="]
 *
 * normalizeAmpOutFlag(["audit", "--amp-out", "path"])
 * // => ["audit", "--amp-out", "path"] (preserved)
 *
 * normalizeAmpOutFlag(["audit", "--amp-out=custom"])
 * // => ["audit", "--amp-out=custom"] (preserved)
 * ```
 */
export const normalizeAmpOutFlag = (argv: readonly string[]): readonly string[] => {
  const out: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--amp-out") {
      const next = argv[i + 1]
      // Bare flag (no value or next arg is another flag)
      if (next === undefined || next.startsWith("-")) {
        // Use a sentinel value that will be recognized as "default"
        out.push("--amp-out=__DEFAULT__")
      } else {
        // Space-separated value (preserve both tokens)
        out.push(arg)
      }
    } else {
      out.push(arg)
    }
  }
  return out
}
