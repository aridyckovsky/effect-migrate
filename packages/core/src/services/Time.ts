/**
 * Time Service - Centralized time abstraction for testability
 *
 * Wraps Clock service to provide:
 * - Consistent timestamp generation (DateTime)
 * - UTC zoned datetime for checkpoint IDs
 * - Formatted checkpoint IDs (ISO with colons replaced)
 * - TestClock compatibility for deterministic testing
 *
 * ## Design Pattern
 *
 * This service captures Clock ONCE during layer construction (like FileDiscovery
 * captures FileSystem), then returns methods that close over the captured Clock.
 * This prevents Clock from leaking into consumer type requirements.
 *
 * ## Usage
 *
 * ```typescript
 * import { Time } from "@effect-migrate/core"
 *
 * const program = Effect.gen(function* () {
 *   const timestamp = yield* Time.now
 *   const checkpointId = yield* Time.checkpointId
 *   // ...
 * })
 * ```
 *
 * ## Testing
 *
 * ```typescript
 * import { Time } from "@effect-migrate/core"
 * import * as TestClock from "effect/TestClock"
 *
 * it.effect("should use controlled time", () =>
 *   Effect.gen(function* () {
 *     yield* TestClock.adjust("1 seconds")
 *     const ts = yield* Time.now
 *     // ...
 *   }).pipe(Effect.provide(Time.Default))
 * )
 * ```
 *
 * @module @effect-migrate/core/services/Time
 * @since 0.5.0
 */

import * as Clock from "effect/Clock"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

/**
 * Time service interface.
 *
 * Provides time-related operations that can be tested with TestClock.
 * Methods return Effects with no additional requirements beyond Time.
 *
 * @category Service
 * @since 0.3.0
 */
export interface TimeService {
  /**
   * Get current time in milliseconds since epoch.
   */
  readonly nowMillis: Effect.Effect<number>

  /**
   * Get current time as DateTime (generic, not timezone-aware).
   */
  readonly now: Effect.Effect<DateTime.DateTime>

  /**
   * Get current time as UTC DateTime.
   *
   * Returns DateTimeUtc compatible with Schema.DateTimeUtc.
   */
  readonly nowUtc: Effect.Effect<DateTime.Utc>

  /**
   * Generate checkpoint ID from current UTC time.
   *
   * Format: ISO string with colons replaced by hyphens.
   * Example: "2025-11-08T15-30-45.123Z"
   */
  readonly checkpointId: Effect.Effect<string>

  /**
   * Format DateTime as checkpoint ID.
   *
   * Pure function for reuse in testing or manual formatting.
   */
  readonly formatCheckpointId: (dt: DateTime.DateTime) => string
}

/**
 * Format DateTime as checkpoint ID.
 *
 * Converts ISO string to checkpoint-safe format by replacing colons.
 *
 * @param dt - DateTime to format
 * @returns Checkpoint ID string (ISO with colons replaced)
 *
 * @category Pure Function
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * const dt = DateTime.unsafeMake(Date.now())
 * const id = formatCheckpointId(dt)
 * // => "2025-11-08T15-30-45.123Z"
 * ```
 */
export const formatCheckpointId = (dt: DateTime.DateTime): string =>
  DateTime.formatIso(dt).replace(/:/g, "-")

/**
 * Time service tag.
 *
 * Uses Effect.Service pattern for clean dependency injection.
 * Clock dependency is captured ONCE during layer construction and
 * does NOT leak to consumers.
 *
 * @category Service
 * @since 0.3.0
 */
export class Time extends Effect.Service<Time>()("Time", {
  effect: Effect.gen(function*() {
    // Capture Clock ONCE during service construction
    const clock = yield* Clock.Clock

    // Helper to safely create DateTime.Utc from milliseconds
    const decodeUtc = Schema.decodeUnknownSync(Schema.DateTimeUtc)
    const makeUtc = (ms: number): DateTime.Utc =>
      decodeUtc(DateTime.formatIso(DateTime.unsafeMake(ms)))

    // Helper to get current time in millis
    const currentTimeMillis = (): number => clock.unsafeCurrentTimeMillis()

    // Build Effects that close over the captured clock
    const nowMillis = Effect.sync(currentTimeMillis)
    const now = Effect.map(nowMillis, DateTime.unsafeMake)
    const nowUtc = Effect.map(nowMillis, makeUtc)
    const checkpointIdEffect = Effect.map(nowUtc, formatCheckpointId)

    // Return service implementation
    // These Effects have NO additional requirements (R = never)
    return {
      nowMillis,
      now,
      nowUtc,
      checkpointId: checkpointIdEffect,
      formatCheckpointId
    }
  })
}) {}

/**
 * Alias for Time.Default layer for backward compatibility.
 *
 * @category Layer
 * @since 0.5.0
 * @deprecated Use Time.Default instead
 */
export const layerLive = Time.Default

/**
 * Get current time in milliseconds since epoch.
 *
 * Ergonomic helper for accessing Time.nowMillis.
 *
 * @category Effect
 * @since 0.5.0
 */
export const nowMillis: Effect.Effect<number, never, Time> = Effect.flatMap(
  Time,
  _ => _.nowMillis
)

/**
 * Get current time as DateTime.
 *
 * Ergonomic helper for accessing Time.now.
 *
 * @category Effect
 * @since 0.5.0
 */
export const now: Effect.Effect<DateTime.DateTime, never, Time> = Effect.flatMap(
  Time,
  _ => _.now
)

/**
 * Get current time as UTC ZonedDateTime.
 *
 * Ergonomic helper for accessing Time.nowUtc.
 *
 * @category Effect
 * @since 0.5.0
 */
export const nowUtc: Effect.Effect<DateTime.Utc, never, Time> = Effect.flatMap(
  Time,
  _ => _.nowUtc
)

/**
 * Generate checkpoint ID from current UTC time.
 *
 * Ergonomic helper for accessing Time.checkpointId.
 *
 * @category Effect
 * @since 0.5.0
 */
export const checkpointId: Effect.Effect<string, never, Time> = Effect.flatMap(
  Time,
  _ => _.checkpointId
)
