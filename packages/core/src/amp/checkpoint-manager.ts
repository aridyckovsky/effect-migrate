import type { PlatformError } from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Effect from "effect/Effect"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import {
  AuditCheckpoint,
  CheckpointManifest,
  CheckpointMetadata,
  CheckpointSummary,
  DeltaStats,
  FindingsSummary
} from "../schema/amp.js"
import type { ConfigSchema } from "../schema/Config.js"
import { SCHEMA_VERSION } from "../schema/versions.js"
import * as Time from "../services/Time.js"
import { getPackageMeta } from "./package-meta.js"

/**
 * Generate checkpoint ID from DateTime.
 *
 * Re-exported from Time service for backward compatibility.
 *
 * @deprecated Use Time.formatCheckpointId directly
 */
export const generateCheckpointId = Time.formatCheckpointId

// Removed: detectThreadId - threadId should be passed from context-writer
// to avoid Node.js API usage and maintain separation of concerns

export const computeDelta = (
  prev: typeof FindingsSummary.Type,
  curr: typeof FindingsSummary.Type
): typeof DeltaStats.Type => {
  const errorDelta = curr.errors - prev.errors
  const warningDelta = curr.warnings - prev.warnings
  const infoDelta = curr.info - prev.info
  const totalDelta = curr.totalFindings - prev.totalFindings

  return {
    errors: errorDelta,
    warnings: warningDelta,
    info: infoDelta,
    totalFindings: totalDelta
  }
}

// Helper to build checkpoint file path using Path service
const getCheckpointPath = (path: Path.Path, outputDir: string, id: string): string => {
  return path.join(outputDir, "checkpoints", `${id}.json`)
}

export const readManifest = (
  outputDir: string
): Effect.Effect<
  typeof CheckpointManifest.Type,
  PlatformError | ParseResult.ParseError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const manifestPath = path.join(outputDir, "checkpoints", "manifest.json")

    const exists = yield* fs.exists(manifestPath)
    if (!exists) {
      return {
        schemaVersion: SCHEMA_VERSION,
        projectRoot: ".",
        checkpoints: []
      }
    }

    const content = yield* fs.readFileString(manifestPath)
    return yield* Schema.decodeUnknown(CheckpointManifest)(JSON.parse(content))
  })

export const writeManifest = (
  outputDir: string,
  manifest: typeof CheckpointManifest.Type
): Effect.Effect<void, PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const checkpointsDir = path.join(outputDir, "checkpoints")
    const manifestPath = path.join(checkpointsDir, "manifest.json")

    // Ensure checkpoints directory exists
    yield* fs.makeDirectory(checkpointsDir, { recursive: true })

    const encoded = Schema.encodeSync(CheckpointManifest)(manifest)
    const content = JSON.stringify(encoded, null, 2)

    yield* fs.writeFileString(manifestPath, content)
  })

/**
 * Convert CheckpointMetadata to CheckpointSummary for index navigation.
 *
 * Extracts lightweight summary fields, omitting path, versions, description, and tags.
 */
const toCheckpointSummary = (
  metadata: typeof CheckpointMetadata.Type
): typeof CheckpointSummary.Type => ({
  id: metadata.id,
  timestamp: metadata.timestamp,
  ...(metadata.thread && { thread: metadata.thread }),
  summary: metadata.summary,
  ...(metadata.delta && { delta: metadata.delta })
})

export const listCheckpoints = (
  outputDir: string,
  limit = 10
): Effect.Effect<
  ReadonlyArray<typeof CheckpointSummary.Type>,
  PlatformError | ParseResult.ParseError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    const manifest = yield* readManifest(outputDir)
    return manifest.checkpoints.slice(0, limit).map(toCheckpointSummary)
  })

export const readCheckpoint = (
  outputDir: string,
  id: string
): Effect.Effect<
  typeof AuditCheckpoint.Type,
  PlatformError | ParseResult.ParseError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const checkpointPath = getCheckpointPath(path, outputDir, id)

    const content = yield* fs.readFileString(checkpointPath)
    const data: unknown = JSON.parse(content)
    return yield* Schema.decodeUnknown(AuditCheckpoint)(data)
  })

export const createCheckpoint = (
  outputDir: string,
  findings: typeof AuditCheckpoint.Type.findings,
  config: typeof ConfigSchema.Type,
  revision: number,
  threadId?: string
): Effect.Effect<
  typeof CheckpointManifest.Type.checkpoints[number],
  PlatformError | ParseResult.ParseError,
  FileSystem.FileSystem | Path.Path | Time.Time
> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const checkpointsDir = path.join(outputDir, "checkpoints")
    yield* fs.makeDirectory(outputDir, { recursive: true })
    yield* fs.makeDirectory(checkpointsDir, { recursive: true })

    const timestamp = yield* Time.nowUtc
    const id = Time.formatCheckpointId(timestamp)

    const { toolVersion } = yield* getPackageMeta

    const allRules = [
      ...(config.patterns ?? []),
      ...(config.boundaries ?? [])
    ]

    const checkpoint: typeof AuditCheckpoint.Type = {
      schemaVersion: SCHEMA_VERSION,
      revision,
      checkpointId: id,
      toolVersion,
      projectRoot: ".",
      timestamp,
      ...(threadId && { thread: threadId }),
      findings,
      config: {
        rulesEnabled: allRules.map(r => r.id),
        failOn: [...(config.report?.failOn ?? ["error"])]
      }
    }

    const encoded = Schema.encodeSync(AuditCheckpoint)(checkpoint)
    const checkpointPath = getCheckpointPath(path, outputDir, id)
    yield* fs.writeFileString(checkpointPath, JSON.stringify(encoded, null, 2))

    const manifest = yield* readManifest(outputDir)

    // Sort checkpoints before computing delta
    const sortedCheckpoints = [...manifest.checkpoints].sort(
      (a, b) => b.timestamp.epochMillis - a.timestamp.epochMillis
    )

    const previousCheckpoint = sortedCheckpoints[0]
    const delta = previousCheckpoint
      ? computeDelta(previousCheckpoint.summary, findings.summary)
      : undefined

    const metadata: typeof CheckpointManifest.Type.checkpoints[number] = {
      id,
      timestamp,
      path: path.join(".", "checkpoints", `${id}.json`),
      schemaVersion: SCHEMA_VERSION,
      toolVersion,
      summary: findings.summary,
      ...(delta && { delta }),
      ...(threadId && { thread: threadId })
    }

    const updatedManifest: typeof CheckpointManifest.Type = {
      schemaVersion: SCHEMA_VERSION,
      projectRoot: ".",
      checkpoints: [metadata, ...sortedCheckpoints]
    }

    yield* writeManifest(outputDir, updatedManifest)

    // Note: audit.json is managed by context-writer, not checkpoint-manager
    // Removed symlink/copy logic to avoid schema confusion (AuditCheckpoint vs AmpAuditContext)

    return metadata
  })
