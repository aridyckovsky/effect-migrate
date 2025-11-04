import * as Options from "@effect/cli/Options"

export const AMP_OUT_DEFAULT = ".amp/effect-migrate"

export const ampOutOption = () =>
  Options.text("amp-out").pipe(
    Options.withDefault(AMP_OUT_DEFAULT),
    Options.withDescription("Directory for Amp context output")
  )
