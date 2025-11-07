/**
 * Schema Version Registry - Single source of truth for artifact schema version.
 *
 * ## Version Policy
 *
 * **All artifacts share the same schema version:**
 * - MAJOR: Breaking changes to any artifact structure
 * - MINOR: Additive changes (new optional fields, new artifact types)
 * - PATCH: Clarifications, bug fixes, no structural changes
 *
 * **Package versions (managed by changesets):**
 * - Independent of schema version
 * - CLI/core can evolve without forcing schema changes
 *
 * **Rationale for single version:**
 * - All artifacts (index.json, audit.json, metrics.json, threads.json) are generated together
 * - They represent a unified context output for the same tool version
 * - Separate versions would create confusion about compatibility
 * - Simpler mental model: one tool version = one schema version
 *
 * @module @effect-migrate/core/schema/versions
 * @since 0.3.0
 */

/**
 * Current schema version for all effect-migrate artifacts.
 *
 * This version applies to:
 * - index.json (navigation index)
 * - audit.json (audit findings)
 * - metrics.json (migration metrics)
 * - threads.json (thread references)
 *
 * **IMPORTANT:** When updating this version:
 * - Update all schema definitions if structures change
 * - Add migration guide in docs/ for breaking changes
 * - Tests will fail if schemas don't match
 */
export const SCHEMA_VERSION = "0.2.0"

/**
 * Type alias for schema version.
 */
export type SchemaVersion = typeof SCHEMA_VERSION
