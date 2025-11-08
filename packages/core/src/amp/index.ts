/**
 * Amp context generation and management utilities.
 *
 * @packageDocumentation
 * @module amp
 */

export { AMP_OUT_DEFAULT } from "./constants.js"
export { updateIndexWithThreads, writeAmpContext } from "./context-writer.js"
export { writeMetricsContext } from "./metrics-writer.js"
export {
  deriveResultKey,
  deriveResultKeys,
  expandResult,
  normalizeResults,
  rebuildGroups
} from "./normalizer.js"
export { getPackageMeta } from "./package-meta.js"
export type { PackageMeta } from "./package-meta.js"
export { addThread, readThreads, validateThreadUrl } from "./thread-manager.js"
export type { ThreadsFile } from "./thread-manager.js"
