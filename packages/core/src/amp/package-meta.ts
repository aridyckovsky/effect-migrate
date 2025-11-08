/**
 * Package metadata utilities for Amp context generation.
 *
 * Provides shared functionality for reading package.json metadata at runtime,
 * ensuring consistent toolVersion and schemaVersion across all Amp output files.
 *
 * @module @effect-migrate/core/amp/package-meta
 * @since 0.2.0
 */

import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

/**
 * Package JSON schema for validation.
 *
 * @category Schema
 * @since 0.2.0
 */
const PackageJson = Schema.Struct({
  version: Schema.String,
  effectMigrate: Schema.optional(Schema.Struct({ schemaVersion: Schema.String }))
})
type PackageJson = Schema.Schema.Type<typeof PackageJson>

/**
 * Package metadata interface.
 *
 * @category Types
 * @since 0.2.0
 */
export interface PackageMeta {
  readonly toolVersion: string
  readonly schemaVersion: string
}

/**
 * Get package metadata from package.json.
 *
 * Reads both version and schemaVersion from package.json at runtime.
 * Falls back to "1.0.0" for schemaVersion if effectMigrate.schemaVersion is not defined.
 *
 * This function works in both production (built) and development (tsx) environments
 * by trying multiple path resolutions.
 *
 * @returns Effect containing toolVersion and schemaVersion
 * @category Effect
 * @since 0.2.0
 *
 * @example
 * ```typescript
 * const { toolVersion, schemaVersion } = yield* getPackageMeta
 * // toolVersion: "0.3.0"
 * // schemaVersion: "1.0.0"
 * ```
 */
export const getPackageMeta = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  // Resolve path to package.json relative to this file
  // In production (build): build/esm/amp/package-meta.js -> ../../../package.json
  // In test (tsx): src/amp/package-meta.ts (via tsx) -> ../../package.json
  const fileUrl = yield* Effect.try({
    try: () => new URL(import.meta.url),
    catch: e => `Invalid import.meta.url: ${String(e)}`
  })
  const filePath = yield* path.fromFileUrl(fileUrl)
  const dirname = path.dirname(filePath)

  // Try production path first (3 levels up)
  let packageJsonPath = path.join(dirname, "..", "..", "..", "package.json")
  const prodExists = yield* fs.exists(packageJsonPath)

  // If not found, try dev/test path (2 levels up)
  if (!prodExists) {
    packageJsonPath = path.join(dirname, "..", "..", "package.json")
  }

  const content = yield* fs.readFileString(packageJsonPath).pipe(
    Effect.catchAll(() => Effect.fail("package.json not found"))
  )

  const pkg = yield* Effect.try({
    try: () => JSON.parse(content) as unknown,
    catch: e => `Invalid JSON in ${packageJsonPath}: ${String(e)}`
  }).pipe(Effect.flatMap(Schema.decodeUnknown(PackageJson)))

  return {
    toolVersion: pkg.version,
    schemaVersion: pkg.effectMigrate?.schemaVersion ?? "1.0.0"
  }
}).pipe(
  Effect.catchAll(() => Effect.succeed({ toolVersion: "unknown", schemaVersion: "1.0.0" }))
)
