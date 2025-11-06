/**
 * Schema Version Registry - Single source of truth for all artifact versions.
 *
 * ## Version Policy
 *
 * **Artifact schemas use semver (string):**
 * - MAJOR: Breaking changes to structure (consumers must update parsers)
 * - MINOR: Additive changes (new optional fields, backwards compatible)
 * - PATCH: Clarifications, typos, no structural changes
 *
 * **Package versions (managed by changesets):**
 * - Independent of schema versions
 * - CLI/core can evolve without forcing schema changes
 *
 * @module @effect-migrate/core/schema/versions
 * @since 0.3.0
 */

/**
 * Current schema versions for all artifacts.
 *
 * **IMPORTANT:** When updating versions here, also update:
 * - Related schema definitions
 * - Migration guides in docs/
 * - Tests will fail if types mismatch
 */
export const SCHEMA_VERSIONS = {
  /** index.json format version */
  index: "0.1.0",

  /** audit.json format version */
  audit: "0.1.0",

  /** metrics.json format version */
  metrics: "0.1.0",

  /** threads.json format version */
  threads: "0.1.0"
} as const

/**
 * Type-safe schema version accessor.
 */
export type SchemaVersions = typeof SCHEMA_VERSIONS

/**
 * Individual schema version type.
 */
export type SchemaVersion = SchemaVersions[keyof SchemaVersions]
