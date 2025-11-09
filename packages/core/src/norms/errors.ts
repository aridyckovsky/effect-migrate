/**
 * Norms Errors - Tagged errors for norm capture operations.
 *
 * This module defines domain-specific errors for the norms capture feature.
 * All errors extend Data.TaggedError to provide discriminated unions and
 * pattern matching with Effect.catchTag.
 *
 * Following Effect best practices:
 * - Use Data.TaggedError for domain errors
 * - Include context for debugging (paths, IDs, causes)
 * - Avoid generic PlatformError in public APIs
 *
 * @module @effect-migrate/core/norms/errors
 * @since 0.6.0
 */

import * as Data from "effect/Data"

/**
 * Error thrown when no checkpoints are found in the specified directory.
 *
 * This typically occurs when:
 * - The `--amp-out` directory doesn't exist
 * - The directory exists but contains no checkpoint files
 * - The directory is empty or checkpoints are in a different location
 *
 * @category Error
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { NoCheckpointsError } from "@effect-migrate/core"
 * import * as Effect from "effect/Effect"
 *
 * const program = loadCheckpoints("./invalid-path").pipe(
 *   Effect.catchTag("NoCheckpointsError", (error) =>
 *     Effect.gen(function*() {
 *       yield* Console.error(`No checkpoints in ${error.ampOut}`)
 *       yield* Console.error(`Reason: ${error.reason}`)
 *       return []
 *     })
 *   )
 * )
 * ```
 */
export class NoCheckpointsError extends Data.TaggedError("NoCheckpointsError")<{
  /** Path to the --amp-out directory that was searched */
  readonly ampOut: string

  /** Optional human-readable reason for the failure */
  readonly reason?: string
}> {}

/**
 * Error thrown when an invalid directory path is provided.
 *
 * This occurs when:
 * - Directory path is malformed
 * - Directory doesn't exist
 * - Path is not a directory (it's a file)
 * - Directory is outside the project root
 *
 * @category Error
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { InvalidDirectoryError } from "@effect-migrate/core"
 * import * as Effect from "effect/Effect"
 *
 * const program = analyzeDirectory("not/a/directory").pipe(
 *   Effect.catchTag("InvalidDirectoryError", (error) =>
 *     Effect.gen(function*() {
 *       yield* Console.error(`Invalid directory: ${error.directory}`)
 *       if (error.reason) {
 *         yield* Console.error(`Reason: ${error.reason}`)
 *       }
 *       return defaultSummary
 *     })
 *   )
 * )
 * ```
 */
export class InvalidDirectoryError extends Data.TaggedError("InvalidDirectoryError")<{
  /** The invalid directory path that was provided */
  readonly directory: string

  /** Optional human-readable reason for the failure */
  readonly reason?: string
}> {}

/**
 * Error thrown during the norm detection algorithm.
 *
 * This can occur when:
 * - Checkpoint data is malformed or corrupted
 * - Time series analysis fails
 * - Unexpected data structure in checkpoint findings
 *
 * @category Error
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { NormDetectionError } from "@effect-migrate/core"
 * import * as Effect from "effect/Effect"
 *
 * const program = detectNorms(checkpoints, "src/services").pipe(
 *   Effect.catchTag("NormDetectionError", (error) =>
 *     Effect.gen(function*() {
 *       yield* Console.error(`Norm detection failed: ${error.message}`)
 *       if (error.directory) {
 *         yield* Console.error(`Directory: ${error.directory}`)
 *       }
 *       if (error.cause) {
 *         yield* Console.error(`Cause: ${error.cause}`)
 *       }
 *       return []
 *     })
 *   )
 * )
 * ```
 */
export class NormDetectionError extends Data.TaggedError("NormDetectionError")<{
  /** Optional directory being analyzed when error occurred */
  readonly directory?: string

  /** Human-readable error message */
  readonly message: string

  /** Optional underlying cause (e.g., parse error, validation failure) */
  readonly cause?: unknown
}> {}

/**
 * Error thrown when writing norm summary to the filesystem fails.
 *
 * This occurs when:
 * - File write permissions are denied
 * - Disk is full
 * - Parent directory doesn't exist
 * - Path is invalid
 *
 * @category Error
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { SummaryWriteError } from "@effect-migrate/core"
 * import * as Effect from "effect/Effect"
 *
 * const program = writeSummary(summary, "/invalid/path").pipe(
 *   Effect.catchTag("SummaryWriteError", (error) =>
 *     Effect.gen(function*() {
 *       yield* Console.error(`Failed to write summary to ${error.path}`)
 *       yield* Console.error(`Cause: ${error.cause}`)
 *       return Effect.void
 *     })
 *   )
 * )
 * ```
 */
export class SummaryWriteError extends Data.TaggedError("SummaryWriteError")<{
  /** File path where write was attempted */
  readonly path: string

  /** Underlying error from filesystem operation */
  readonly cause: unknown
}> {}

/**
 * Union of all norm capture errors.
 *
 * Use this type for Effect error channels that can throw any norm-related error.
 * Enables exhaustive error handling with Effect.catchTags.
 *
 * @category Type
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import type { NormCaptureError } from "@effect-migrate/core"
 * import * as Effect from "effect/Effect"
 *
 * const analyzeNorms = (
 *   directory: string
 * ): Effect.Effect<DirectorySummary, NormCaptureError> =>
 *   Effect.gen(function*() {
 *     // May throw any NormCaptureError variant
 *     const checkpoints = yield* loadCheckpoints()
 *     const norms = yield* detectNorms(checkpoints, directory)
 *     const summary = yield* buildSummary(norms, directory)
 *     yield* writeSummary(summary)
 *     return summary
 *   })
 * ```
 */
export type NormCaptureError =
  | NoCheckpointsError
  | InvalidDirectoryError
  | NormDetectionError
  | SummaryWriteError
