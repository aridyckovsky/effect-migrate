/**
 * Rule Builders - Construct rules from config
 *
 * This module provides pure functions to construct Rule instances from
 * user configuration, handling both pattern and boundary rules.
 *
 * @module @effect-migrate/core/rules/builders
 * @since 0.1.0
 */

import type { Config } from "../schema/Config.js"
import { makeBoundaryRule } from "./helpers.js"
import { makePatternRule } from "./helpers.js"
import type { Rule } from "./types.js"

/**
 * Construct rules from config (both pattern and boundary rules).
 *
 * This is a pure function that transforms user configuration into
 * executable Rule instances. It correctly handles TypeScript's
 * `exactOptionalPropertyTypes` by using conditional spread for
 * optional properties.
 *
 * @param config - User configuration with optional patterns and boundaries
 * @returns Array of executable rules
 *
 * @category Rule Factory
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const config: Config = {
 *   version: 1,
 *   paths: { exclude: ["node_modules/**"] },
 *   patterns: [
 *     {
 *       id: "no-async-await",
 *       pattern: /async\s+function/g,
 *       files: "src/**\/*.ts",
 *       message: "Use Effect.gen instead",
 *       severity: "warning"
 *     }
 *   ],
 *   boundaries: [
 *     {
 *       id: "no-ui-in-core",
 *       from: "src/core/**\/*.ts",
 *       disallow: ["react"],
 *       message: "Core cannot import UI",
 *       severity: "error"
 *     }
 *   ]
 * }
 *
 * const rules = rulesFromConfig(config)
 * // rules.length === 2
 * ```
 */
export function rulesFromConfig(config: Config): ReadonlyArray<Rule> {
  const rules: Rule[] = []

  // Build pattern rules from config
  if (config.patterns) {
    for (const patternConfig of config.patterns) {
      // Handle exactOptionalPropertyTypes by conditionally spreading optional properties
      const rule = makePatternRule({
        id: patternConfig.id,
        files: Array.isArray(patternConfig.files) ? patternConfig.files : [patternConfig.files],
        pattern: patternConfig.pattern,
        message: patternConfig.message,
        severity: patternConfig.severity,
        ...(patternConfig.negativePattern !== undefined && {
          negativePattern: patternConfig.negativePattern
        }),
        ...(patternConfig.docsUrl !== undefined && { docsUrl: patternConfig.docsUrl }),
        ...(patternConfig.tags !== undefined && { tags: [...patternConfig.tags] })
      })
      rules.push(rule)
    }
  }

  // Build boundary rules from config
  if (config.boundaries) {
    for (const boundaryConfig of config.boundaries) {
      const rule = makeBoundaryRule({
        id: boundaryConfig.id,
        from: boundaryConfig.from,
        disallow: [...boundaryConfig.disallow],
        message: boundaryConfig.message,
        severity: boundaryConfig.severity,
        ...(boundaryConfig.docsUrl !== undefined && { docsUrl: boundaryConfig.docsUrl }),
        ...(boundaryConfig.tags !== undefined && { tags: [...boundaryConfig.tags] })
      })
      rules.push(rule)
    }
  }

  return rules
}
