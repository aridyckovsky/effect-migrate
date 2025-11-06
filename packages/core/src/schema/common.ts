/**
 * Common schema components shared across packages.
 *
 * @module @effect-migrate/core/schema/common
 * @since 0.3.0
 */

import * as Schema from "effect/Schema"

/**
 * Semantic version validator (x.y.z format).
 *
 * Validates semver format for schema versioning across all artifacts.
 *
 * @example
 * ```typescript
 * const version = Schema.decodeSync(Semver)("1.2.3") // ✅ Valid
 * const invalid = Schema.decodeSync(Semver)("1.2") // ❌ ParseError
 * ```
 */
export const Semver = Schema.String.pipe(Schema.pattern(/^\d+\.\d+\.\d+$/))

/**
 * Semver type extracted from schema.
 */
export type Semver = Schema.Schema.Type<typeof Semver>
