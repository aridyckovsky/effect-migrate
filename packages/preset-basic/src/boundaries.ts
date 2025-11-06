/**
 * Boundary Rules - Enforce architectural constraints
 *
 * This module provides boundary-based rules that enforce proper separation of
 * concerns by restricting imports based on file location in the codebase.
 *
 * @module @effect-migrate/preset-basic/boundaries
 * @since 0.3.0
 */

import type { Rule } from "@effect-migrate/core"
import { makeBoundaryRule } from "@effect-migrate/core"

/**
 * Disallow Node.js built-in imports in service layer.
 *
 * Services should use @effect/platform abstractions (FileSystem, Path, Command)
 * instead of Node.js built-ins for cross-platform compatibility and resource safety.
 *
 * @category Boundary Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - Direct Node.js imports in services
 * import { readFile } from "node:fs/promises"
 * import { join } from "node:path"
 *
 * // ✅ Good - @effect/platform abstractions
 * import { FileSystem, Path } from "@effect/platform"
 * ```
 *
 * @see https://effect.website/docs/guides/platform/overview
 */
export const noNodeInServices = makeBoundaryRule({
  id: "no-node-in-services",
  from: "**/services/**/*.ts",
  disallow: ["node:*"],
  message: "Don't import Node.js built-ins in service layer. Use @effect/platform instead.",
  severity: "error",
  docsUrl: "https://effect.website/docs/guides/platform/overview",
  tags: ["platform", "architecture"]
})

/**
 * Disallow platform-node imports in core logic.
 *
 * Core modules should be platform-agnostic and depend on @effect/platform only.
 * Platform-specific implementations (@effect/platform-node, @effect/platform-bun)
 * should only be used at application entry points.
 *
 * @category Boundary Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - Platform-specific import in core
 * import { NodeFileSystem } from "@effect/platform-node"
 *
 * // ✅ Good - Platform-agnostic interface
 * import { FileSystem } from "@effect/platform"
 * ```
 *
 * @see https://effect.website/docs/guides/platform/platform-specific
 */
export const noPlatformNodeInCore = makeBoundaryRule({
  id: "no-platform-node-in-core",
  from: "**/core/**/*.ts",
  disallow: ["@effect/platform-node*"],
  message: "Core modules should use @effect/platform, not @effect/platform-node",
  severity: "error",
  docsUrl: "https://effect.website/docs/guides/platform/platform-specific",
  tags: ["platform", "architecture"]
})

/**
 * Disallow direct Node.js filesystem imports.
 *
 * Use @effect/platform FileSystem service for resource safety, composability,
 * and cross-platform support. FileSystem provides Effect-based APIs with
 * automatic resource cleanup via Effect.scoped.
 *
 * @category Boundary Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - Direct fs imports
 * import { readFile } from "fs/promises"
 * import * as fs from "node:fs"
 *
 * // ✅ Good - @effect/platform FileSystem
 * import { FileSystem } from "@effect/platform"
 * ```
 *
 * @see https://effect.website/docs/guides/platform/file-system
 */
export const noFsPromises = makeBoundaryRule({
  id: "no-fs-promises",
  from: "**/*.ts",
  disallow: ["fs/promises", "node:fs/promises", "node:fs"],
  message: "Use @effect/platform FileSystem service instead of fs/promises",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/platform/file-system",
  tags: ["platform", "filesystem"]
})

/**
 * Disallow direct Node.js path imports.
 *
 * Use @effect/platform Path service for cross-platform path handling.
 * The Path service provides the same API across all platforms with
 * platform-specific implementations injected via Layers.
 *
 * @category Boundary Rule
 * @since 0.3.0
 *
 * @example
 * ```typescript
 * // ❌ Bad - Direct path imports
 * import { join, resolve } from "path"
 * import * as path from "node:path"
 *
 * // ✅ Good - @effect/platform Path
 * import { Path } from "@effect/platform"
 * ```
 *
 * @see https://effect.website/docs/guides/platform/path
 */
export const noNodePath = makeBoundaryRule({
  id: "no-node-path",
  from: "**/*.ts",
  disallow: ["path", "node:path"],
  message: "Use @effect/platform Path service instead of node:path",
  severity: "warning",
  docsUrl: "https://effect.website/docs/guides/platform/path",
  tags: ["platform", "filesystem"]
})

/**
 * All boundary rules for enforcing architectural constraints.
 *
 * These rules ensure proper separation of concerns by restricting imports
 * based on file location in the codebase.
 *
 * @category Boundary Rules
 * @since 0.3.0
 *
 * @see {@link noNodeInServices} for Node.js built-in restrictions in services
 * @see {@link noPlatformNodeInCore} for platform-specific import restrictions
 * @see {@link noFsPromises} for filesystem abstraction enforcement
 * @see {@link noNodePath} for path abstraction enforcement
 */
export const boundaryRules: Rule[] = [
  noNodeInServices,
  noPlatformNodeInCore,
  noFsPromises,
  noNodePath
]
