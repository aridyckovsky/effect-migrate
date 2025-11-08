/**
 * ProcessInfo Service - Effect-first access to process information
 *
 * Provides safe, testable access to Node.js process globals (cwd, env, etc.)
 * following Effect-first patterns used throughout the codebase.
 *
 * @module @effect-migrate/core/services/ProcessInfo
 * @since 0.4.0
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/**
 * ProcessInfo service interface
 *
 * Provides access to process information in an Effect-first way.
 */
export interface ProcessInfoService {
  /**
   * Get current working directory
   */
  readonly cwd: Effect.Effect<string>

  /**
   * Get environment variable
   */
  readonly getEnv: (key: string) => Effect.Effect<string | undefined>

  /**
   * Get all environment variables
   */
  readonly getAllEnv: Effect.Effect<Record<string, string | undefined>>
}

/**
 * ProcessInfo service tag
 */
export class ProcessInfo extends Context.Tag("ProcessInfo")<
  ProcessInfo,
  ProcessInfoService
>() {}

/**
 * Live implementation using Node.js process globals
 */
export const ProcessInfoLive = Layer.succeed(ProcessInfo, {
  cwd: Effect.sync(() => process.cwd()),
  getEnv: (key: string) => Effect.sync(() => process.env[key]),
  getAllEnv: Effect.sync(() => process.env as Record<string, string | undefined>)
})
