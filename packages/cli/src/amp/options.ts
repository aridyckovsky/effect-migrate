/**
 * CLI options for Amp context output
 *
 * @module @effect-migrate/cli/amp/options
 * @since 0.2.0
 */

import { AMP_OUT_DEFAULT } from "@effect-migrate/core"
import * as Options from "@effect/cli/Options"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"

/**
 * Tri-state mode for --amp-out option
 *
 * - None: flag omitted, no file output
 * - Default: bare flag or empty string, write to default path
 * - Custom: value provided, write to custom path (after validation)
 *
 * @category CLI
 * @since 0.2.0
 */
export type AmpOutMode =
  | { readonly _tag: "None" }
  | { readonly _tag: "Default"; readonly path: string }
  | { readonly _tag: "Custom"; readonly path: string }

/**
 * CLI option for Amp output directory.
 *
 * When provided, outputs Amp context to the specified directory.
 * When omitted, no Amp context is generated.
 *
 * Use `resolveAmpOut` to interpret the parsed option into tri-state mode.
 *
 * @returns CLI Options instance for --amp-out flag returning Option<string>
 *
 * @category CLI
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const command = Command.make("audit", {
 *   ampOut: ampOutOption()
 * }, ({ ampOut }) => {
 *   const mode = resolveAmpOut(ampOut)
 *   switch (mode._tag) {
 *     case "None":
 *       break
 *     case "Default":
 *     case "Custom":
 *       yield* writeAmpContext(mode.path, ...)
 *   }
 * })
 * ```
 */
export const ampOutOption = () =>
  Options.text("amp-out").pipe(
    Options.optional,
    Options.withDescription(`Directory for Amp context output (suggested: "${AMP_OUT_DEFAULT}")`)
  )

/**
 * Resolves the parsed --amp-out option into tri-state mode
 *
 * @param opt - Parsed option value from ampOutOption
 * @returns AmpOutMode indicating whether and where to write output
 *
 * @throws Error if path ends with file extension
 *
 * @category CLI
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const mode = resolveAmpOut(ampOut)
 * if (mode._tag !== "None") {
 *   yield* writeAmpContext(mode.path, results, config)
 * }
 * ```
 */
export const resolveAmpOut = (opt: Option.Option<string>): AmpOutMode =>
  Option.match(opt, {
    onNone: () => ({ _tag: "None" as const }),
    onSome: raw => {
      const path = (raw ?? "").trim()
      // Handle sentinel value from normalizeAmpOutFlag
      if (path === "" || path === "__DEFAULT__") {
        return { _tag: "Default" as const, path: AMP_OUT_DEFAULT }
      }
      if (/\.(json|md|txt|yaml|yml|xml)$/i.test(path)) {
        throw new Error(
          `--amp-out must be a directory path, not a filename. Remove the file extension (e.g., use '.amp/output' instead of '.amp/output.json')`
        )
      }
      return { _tag: "Custom" as const, path }
    }
  })

/**
 * Extract output path from AmpOutMode, returning None if no output requested
 *
 * @param mode - Resolved AmpOutMode from resolveAmpOut
 * @returns Option containing path if output should be written, None otherwise
 *
 * @category Helper
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const mode = resolveAmpOut(ampOut)
 * const maybePath = getAmpOutPath(mode)
 * yield* Option.match(maybePath, {
 *   onNone: () => Effect.void,
 *   onSome: path => writeAmpContext(path, results, config)
 * })
 * ```
 */
export const getAmpOutPath = (mode: AmpOutMode): Option.Option<string> =>
  mode._tag === "None" ? Option.none() : Option.some(mode.path)

/**
 * Conditionally execute an Effect if Amp output is requested
 *
 * Combines resolveAmpOut and conditional execution into a single helper.
 * Only runs the provided effect if mode is Default or Custom, passing the resolved path.
 *
 * @param opt - Parsed option value from ampOutOption
 * @param f - Effect to run with resolved path if output requested
 * @returns Effect that executes conditionally based on mode
 *
 * @category Helper
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * yield* withAmpOut(ampOut, outDir =>
 *   Effect.gen(function* () {
 *     yield* writeAmpContext(outDir, results, config)
 *     yield* Console.log(`✓ Wrote Amp context to ${outDir}`)
 *   })
 * )
 * ```
 */
export const withAmpOut = <A, E, R>(
  opt: Option.Option<string>,
  f: (path: string) => Effect.Effect<A, E, R>
): Effect.Effect<void, E, R> =>
  Option.match(getAmpOutPath(resolveAmpOut(opt)), {
    onNone: () => Effect.void,
    onSome: f
  })

/**
 * Get output directory path with fallback default
 *
 * Used by commands that always write output (e.g., thread management).
 * Returns custom path if provided, or default path if omitted.
 *
 * @param opt - Parsed option value from ampOutOption
 * @param defaultPath - Default path to use if option omitted
 * @returns Resolved output directory path
 *
 * @category Helper
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const outputDir = getAmpOutPathWithDefault(ampOut, ".amp/effect-migrate")
 * yield* writeThreads(outputDir, threads)
 * ```
 */
export const getAmpOutPathWithDefault = (
  opt: Option.Option<string>,
  defaultPath: string
): string => {
  const mode = resolveAmpOut(opt)
  return mode._tag === "None" ? defaultPath : mode.path
}
