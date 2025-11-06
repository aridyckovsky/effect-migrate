---
"@effect-migrate/cli": minor
---

Add tri-state --amp-out option with Effect patterns

- Add `normalizeArgs.ts` for handling bare --amp-out flag (converts to sentinel value)
- Add Effect-based helpers in `amp/options.ts`:
  - `resolveAmpOut()`: converts Option<string> to tri-state AmpOutMode
  - `withAmpOut()`: conditionally executes Effect when output requested
  - `getAmpOutPathWithDefault()`: for commands that always write output
- Refactor audit, metrics, and thread commands to use helpers (no switch statements)
- Support three modes:
  - Omitted flag: no file output
  - Bare flag `--amp-out`: writes to default path `.amp/effect-migrate`
  - Flag with value `--amp-out=path`: writes to custom path
