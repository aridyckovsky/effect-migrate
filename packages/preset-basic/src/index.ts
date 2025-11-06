/**
 * Preset Basic - Default migration preset for Effect-TS
 *
 * This module provides a curated set of opinionated rules for detecting common
 * anti-patterns (async/await, Promise, try/catch) and enforcing platform
 * abstractions during Effect-TS migration.
 *
 * @module @effect-migrate/preset-basic
 * @since 0.3.0
 */

import type { Preset } from "@effect-migrate/core"
import { boundaryRules } from "./boundaries.js"
import { patternRules } from "./patterns.js"

/**
 * Basic preset for Effect migration.
 *
 * Includes pattern rules (async/await, Promise, try/catch detection) and
 * boundary rules (platform abstraction enforcement).
 *
 * @category Preset
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // effect-migrate.config.ts
 * export default {
 *   version: 1,
 *   presets: ["@effect-migrate/preset-basic"]
 * }
 * ```
 *
 * @see {@link patternRules} for pattern-based detection rules
 * @see {@link boundaryRules} for architectural boundary rules
 */
export const presetBasic: Preset = {
  rules: [
    // Filter out no-unhandled-effect: regex-based detection has too many false positives
    // Use @effect/language-service for proper type-based Effect detection instead
    // See: https://github.com/aridyckovsky/effect-migrate/issues/38
    ...patternRules.filter(rule => rule.id !== "no-unhandled-effect"),
    ...boundaryRules
  ],
  defaults: {
    paths: {
      exclude: ["node_modules/**", "dist/**", ".next/**", "coverage/**", ".git/**", "build/**"]
    }
  }
}

export { boundaryRules, noNodeInServices, noNodePath, noPlatformNodeInCore } from "./boundaries.js"
export {
  noAsyncAwait,
  noBarrelImport,
  noFsPromises,
  noNewPromise,
  noTryCatch,
  patternRules
} from "./patterns.js"
