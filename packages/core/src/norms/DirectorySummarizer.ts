/**
 * DirectorySummarizer Service - Orchestrate directory-level norm detection from audit checkpoints
 *
 * This module provides a service for analyzing migration progress at the directory level.
 * It loads audit checkpoints, detects established norms (extinct violations), and generates
 * comprehensive directory summaries with migration status.
 *
 * **Key Features:**
 * - Load and process audit checkpoints from .amp directory
 * - Detect extinct norms using lookback window algorithm
 * - Convert plain data to Schema-validated types (DateTimeUtc)
 * - Generate directory summaries with stats and status
 * - Concurrent checkpoint loading with configurable limits
 *
 * **Error Handling:**
 * - NoCheckpointsError: When no checkpoints exist in manifest
 * - NormDetectionError: When Schema validation or detection fails
 * - PlatformError: For file system operations
 * - ParseResult.ParseError: For Schema decoding failures
 *
 * @module @effect-migrate/core/norms/DirectorySummarizer
 * @since 0.6.0
 */

import type { PlatformError } from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import { readCheckpoint, readManifest } from "../amp/checkpoint-manager.js"
import type { AuditCheckpoint } from "../schema/amp.js"
import { NoCheckpointsError, NormDetectionError } from "./errors.js"
import * as Pure from "./pure.js"
import type { DirectorySummary, Norm } from "./types.js"

/**
 * DirectorySummarizer service interface.
 *
 * Provides high-level API for generating directory summaries with norm detection
 * by analyzing historical audit checkpoints. The service orchestrates checkpoint
 * loading, norm detection, and summary generation with proper error handling.
 *
 * @category Service
 * @since 0.6.0
 */
export interface DirectorySummarizerService {
  /**
   * Generate comprehensive directory summary with norm detection.
   *
   * Analyzes audit checkpoint history to detect extinct norms (violations that
   * have been resolved and stayed resolved), compute directory statistics, and
   * determine migration status.
   *
   * **Process:**
   * 1. Load checkpoint manifest from .amp directory
   * 2. Load recent checkpoints (sorted by timestamp, limited to checkpointLimit)
   * 3. Run pure norm detection algorithm (lookback window for extinction)
   * 4. Convert plain data to Schema-validated types (DateTimeUtc)
   * 5. Compute directory stats (total files, current violations)
   * 6. Determine status (clean, in-progress, or not-started)
   * 7. Find clean timestamp if directory is violation-free
   *
   * @param outputDir - Path to .amp directory containing checkpoints and manifest
   * @param directory - Directory path to analyze (e.g., "src/services", "packages/core")
   * @param lookbackWindow - Number of consecutive zero-violation checkpoints required to confirm norm extinction (default 5)
   * @param checkpointLimit - Maximum number of checkpoints to load from history (default 50, sorted ascending by timestamp)
   * @returns Effect resolving to DirectorySummary with norms, stats, status, and metadata
   * @throws {NoCheckpointsError} When manifest exists but contains no checkpoints
   * @throws {NormDetectionError} When Schema validation fails or detection encounters unexpected errors
   * @throws {PlatformError} When file system operations fail (manifest/checkpoint read)
   * @throws {ParseResult.ParseError} When Schema decoding fails for DateTimeUtc conversion
   *
   * @example
   * ```typescript
   * import { DirectorySummarizer, DirectorySummarizerLive } from "@effect-migrate/core"
   * import { NodeContext } from "@effect/platform-node"
   *
   * const program = Effect.gen(function*() {
   *   const summarizer = yield* DirectorySummarizer
   *
   *   // Analyze src/services directory with default settings
   *   const summary = yield* summarizer.summarize(
   *     ".amp",
   *     "src/services"
   *   )
   *
   *   console.log(`Status: ${summary.status}`)
   *   console.log(`Norms detected: ${summary.norms.length}`)
   *   console.log(`Files: ${summary.files.totalFiles}`)
   *
   *   return summary
   * }).pipe(
   *   Effect.provide(DirectorySummarizerLive),
   *   Effect.provide(NodeContext.layer)
   * )
   * ```
   *
   * @example
   * ```typescript
   * // Custom lookback window and checkpoint limit
   * const summary = yield* summarizer.summarize(
   *   ".amp",
   *   "packages/core",
   *   10,  // Require 10 consecutive clean checkpoints for norm extinction
   *   100  // Load up to 100 most recent checkpoints
   * )
   * ```
   */
  readonly summarize: (
    outputDir: string,
    directory: string,
    lookbackWindow?: number,
    checkpointLimit?: number
  ) => Effect.Effect<
    DirectorySummary,
    NoCheckpointsError | NormDetectionError | PlatformError | ParseResult.ParseError
  >
}

/**
 * DirectorySummarizer service tag for dependency injection.
 *
 * Use this tag to access the DirectorySummarizer service in Effect programs.
 * Provide DirectorySummarizerLive layer to satisfy the dependency.
 *
 * @category Service
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function*() {
 *   const summarizer = yield* DirectorySummarizer
 *   const summary = yield* summarizer.summarize(".amp", "src")
 *   return summary
 * })
 * ```
 */
export class DirectorySummarizer extends Context.Tag("DirectorySummarizer")<
  DirectorySummarizer,
  DirectorySummarizerService
>() {}

/**
 * Convert plain NormData to Schema-validated Norm.
 *
 * Transforms norm data from pure detection functions into Schema-validated
 * Norm types. The primary transformation is converting ISO timestamp strings
 * to DateTimeUtc Schema types for type safety.
 *
 * @param normData - Plain norm data from pure detection algorithm
 * @returns Effect resolving to Schema-validated Norm
 * @throws {ParseResult.ParseError} When DateTimeUtc decoding fails
 *
 * @category Internal
 * @since 0.6.0
 *
 * @internal
 */
const normDataToNorm = (normData: Pure.NormData): Effect.Effect<Norm, ParseResult.ParseError> =>
  Effect.gen(function*() {
    const establishedAt = yield* Schema.decodeUnknown(Schema.DateTimeUtc)(normData.establishedAt)

    // exactOptionalPropertyTypes-safe: build with conditional spread
    const norm: Norm = {
      ruleId: normData.ruleId,
      ruleKind: normData.ruleKind,
      severity: normData.severity,
      establishedAt,
      violationsFixed: normData.violationsFixed,
      ...(normData.docsUrl !== undefined && { docsUrl: normData.docsUrl })
    }

    return norm
  })

/**
 * Convert AuditCheckpoint to CheckpointData for pure functions.
 *
 * Transforms Schema-validated AuditCheckpoint into plain CheckpointData objects
 * that can be processed by pure norm detection functions. This conversion:
 * - Converts DateTimeUtc to ISO timestamp strings
 * - Strips Schema type information
 * - Handles optional properties safely (exactOptionalPropertyTypes)
 *
 * @param checkpoint - Schema-validated audit checkpoint
 * @returns Plain CheckpointData object for pure algorithms
 *
 * @category Internal
 * @since 0.6.0
 *
 * @internal
 */
const auditCheckpointToData = (checkpoint: typeof AuditCheckpoint.Type): Pure.CheckpointData => ({
  checkpointId: checkpoint.checkpointId,
  timestamp: DateTime.formatIso(checkpoint.timestamp),
  findings: {
    rules: checkpoint.findings.rules.map(r => ({
      id: r.id,
      kind: r.kind,
      severity: r.severity,
      message: r.message,
      ...(r.docsUrl !== undefined && { docsUrl: r.docsUrl })
    })),
    files: checkpoint.findings.files,
    results: checkpoint.findings.results.map(r => ({
      rule: r.rule,
      ...(r.file !== undefined && { file: r.file }),
      ...(r.range !== undefined && { range: r.range })
    }))
  }
})

/**
 * Live implementation of DirectorySummarizer service.
 *
 * Provides the complete DirectorySummarizer implementation with platform-agnostic
 * file system access. This layer orchestrates:
 * - Loading checkpoint manifest and checkpoint data from .amp directory
 * - Running pure norm detection algorithms
 * - Converting between Schema types and plain data
 * - Building comprehensive directory summaries
 *
 * **Dependencies:**
 * - FileSystem.FileSystem (from @effect/platform) - For reading checkpoints
 * - Path.Path (from @effect/platform) - For path operations
 *
 * These dependencies are typically provided via NodeContext.layer in Node.js
 * applications, making this implementation platform-agnostic.
 *
 * @category Layer
 * @since 0.6.0
 *
 * @example
 * ```typescript
 * import { DirectorySummarizer, DirectorySummarizerLive } from "@effect-migrate/core"
 * import { NodeContext } from "@effect/platform-node"
 *
 * const program = Effect.gen(function*() {
 *   const summarizer = yield* DirectorySummarizer
 *   const summary = yield* summarizer.summarize(".amp", "src/services")
 *   return summary
 * }).pipe(
 *   Effect.provide(DirectorySummarizerLive),
 *   Effect.provide(NodeContext.layer)
 * )
 * ```
 */
export const DirectorySummarizerLive = Layer.effect(
  DirectorySummarizer,
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    return {
      summarize: (
        outputDir: string,
        directory: string,
        lookbackWindow: number = 5,
        checkpointLimit: number = 50
      ): Effect.Effect<
        DirectorySummary,
        NoCheckpointsError | NormDetectionError | PlatformError | ParseResult.ParseError
      > =>
        Effect.gen(function*() {
          // 1. Read manifest
          const manifest = yield* readManifest(outputDir).pipe(
            Effect.provide(Layer.succeedContext(Context.make(FileSystem.FileSystem, fs))),
            Effect.provide(Layer.succeedContext(Context.make(Path.Path, path)))
          )

          if (manifest.checkpoints.length === 0) {
            return yield* Effect.fail(
              new NoCheckpointsError({
                ampOut: outputDir,
                reason: "No checkpoints found in manifest"
              })
            )
          }

          // 2. Sort checkpoints ascending by timestamp and limit
          const sortedMetadata = [...manifest.checkpoints].sort(
            (a, b) => a.timestamp.epochMillis - b.timestamp.epochMillis
          )
          const checkpointsToLoad = sortedMetadata.slice(-checkpointLimit)

          // 3. Load checkpoint data
          const checkpointData: Pure.CheckpointData[] = yield* Effect.forEach(
            checkpointsToLoad,
            metadata =>
              Effect.gen(function*() {
                const checkpoint = yield* readCheckpoint(outputDir, metadata.id).pipe(
                  Effect.provide(Layer.succeedContext(Context.make(FileSystem.FileSystem, fs))),
                  Effect.provide(Layer.succeedContext(Context.make(Path.Path, path)))
                )
                return auditCheckpointToData(checkpoint)
              }),
            { concurrency: 4 }
          )

          // 4. Run pure norm detection
          const normDataList = Pure.detectExtinctNorms(checkpointData, directory, lookbackWindow)

          // 5. Convert NormData to Norm (Schema types)
          const norms = yield* Effect.forEach(normDataList, normDataToNorm).pipe(
            Effect.catchAll(error =>
              Effect.fail(
                new NormDetectionError({
                  directory,
                  message: "Failed to convert NormData to Norm Schema",
                  cause: error
                })
              )
            )
          )

          // 6. Compute directory stats
          const stats = Pure.computeDirectoryStats(checkpointData, directory)

          // 7. Determine status
          const status = Pure.determineStatus(stats, normDataList)

          // 8. Find clean timestamp (if migrated)
          const cleanTimestampOption = Pure.findCleanTimestamp(checkpointData, directory)
          const cleanSince = cleanTimestampOption._tag === "Some"
            ? yield* Schema.decodeUnknown(Schema.DateTimeUtc)(cleanTimestampOption.value)
            : undefined

          // 9. Get latest checkpoint summary
          const latestMetadata = sortedMetadata[sortedMetadata.length - 1]
          if (!latestMetadata) {
            return yield* Effect.fail(
              new NoCheckpointsError({
                ampOut: outputDir,
                reason: "No checkpoint metadata available"
              })
            )
          }

          // 10. Build DirectorySummary
          const summary: DirectorySummary = {
            directory,
            status,
            files: stats,
            norms,
            threads: [], // TODO: Thread association in Phase 5
            latestCheckpoint: {
              id: latestMetadata.id,
              timestamp: latestMetadata.timestamp,
              ...(latestMetadata.thread && { thread: latestMetadata.thread }),
              summary: latestMetadata.summary,
              ...(latestMetadata.delta && { delta: latestMetadata.delta })
            },
            ...(cleanSince !== undefined && { cleanSince })
          }

          return summary
        }).pipe(
          Effect.catchTag("NoCheckpointsError", error => Effect.fail(error)),
          Effect.catchTag("NormDetectionError", error => Effect.fail(error)),
          Effect.catchAll(error =>
            Effect.fail(
              new NormDetectionError({
                directory,
                message: "Unexpected error during summarization",
                cause: error
              })
            )
          )
        )
    }
  })
)
