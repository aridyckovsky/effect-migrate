import type { Preset } from "@effect-migrate/core"
import { boundaryRules } from "./boundaries.js"
import { patternRules } from "./patterns.js"

export const presetBasic: Preset = {
  rules: [...patternRules, ...boundaryRules],
  defaults: {
    paths: {
      exclude: ["node_modules/**", "dist/**", ".next/**", "coverage/**", ".git/**", "build/**"]
    }
  }
}

export { boundaryRules } from "./boundaries.js"
export { noAsyncAwait, patternRules } from "./patterns.js"
