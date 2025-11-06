/**
 * CLI options for Amp context output
 *
 * @module @effect-migrate/cli/amp/options
 * @since 0.2.0
 */

import { AMP_OUT_DEFAULT } from "@effect-migrate/core"
import * as Options from "@effect/cli/Options"

/**
 * CLI option for Amp output directory.
 *
 * Returns a text option with default value and description for use
 * in command definitions.
 *
 * @returns CLI Options instance for --amp-out flag
 *
 * @category CLI
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const command = Command.make("audit", {
 *   ampOut: ampOutOption()
 * }, handler)
 * ```
 */
export const ampOutOption = () =>
  Options.text("amp-out").pipe(
    Options.withDefault(AMP_OUT_DEFAULT),
    Options.withDescription("Directory for Amp context output")
  )
