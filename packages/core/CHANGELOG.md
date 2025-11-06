# @effect-migrate/core

## 0.3.0

### Minor Changes

- [#40](https://github.com/aridyckovsky/effect-migrate/pull/40) [`255240b`](https://github.com/aridyckovsky/effect-migrate/commit/255240b133c6975e34467fc4d0c2d19089d92306) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add unified schema versioning and amp utilities to core package
  - Add `SCHEMA_VERSION` constant - single version for all artifacts (simplicity over complexity)
  - Add Semver schema validator with subpath export `@effect-migrate/core/schema`
  - Move amp utilities (context-writer, metrics-writer, thread-manager) from CLI to core
  - Add `schemaVersion` field to index.json and audit.json schemas
  - Add `revision` counter field to audit.json (increments on each write)
  - Export amp utilities via `@effect-migrate/core/amp` subpath
  - All artifacts share same schema version for clearer versioning semantics

### Patch Changes

- [#31](https://github.com/aridyckovsky/effect-migrate/pull/31) [`eeb0290`](https://github.com/aridyckovsky/effect-migrate/commit/eeb02904f29c98a4b5ecf0f7b338932e3450773a) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Fix boundary rule glob pattern handling for module specifiers. Patterns like `react*internals` now correctly match `react/internals`.

- [#31](https://github.com/aridyckovsky/effect-migrate/pull/31) [`eeb0290`](https://github.com/aridyckovsky/effect-migrate/commit/eeb02904f29c98a4b5ecf0f7b338932e3450773a) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Fix `defineConfig` to accept encoded input types. Users can now pass pattern strings directly instead of RegExp objects, avoiding TypeScript errors.

- [#40](https://github.com/aridyckovsky/effect-migrate/pull/40) [`b8c540a`](https://github.com/aridyckovsky/effect-migrate/commit/b8c540a297030e4dc275301e1cbc09f5a19e90ea) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Upgrade `effect` packages and fix dependency versions
  - Upgrade `effect` from 3.18.4 to 3.19.2
  - Upgrade `@effect/platform` from 0.92.1 to 0.93.0
  - Upgrade `@effect/platform-node` from 0.98.4 to 0.100.0
  - Upgrade `@effect/cli` from 0.71.0 to 0.72.0
  - Upgrade `@effect/vitest` from 0.26.0 to 0.27.0
  - Replace "latest" with specific versions for `@types/node` (^24.10.0) and `typescript` (^5.9.3)

## 0.2.1

### Patch Changes

- [#29](https://github.com/aridyckovsky/effect-migrate/pull/29) [`c1277e5`](https://github.com/aridyckovsky/effect-migrate/commit/c1277e5605df7c5450eca9be34c7590b83efb424) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Correctly prune nested directories using exclude globs in FileDiscovery. Exclude patterns are now matched against directory paths (absolute and relative) and support trailing "/\*\*". Adds tests for absolute and relative nested directory exclusions.

## 0.2.0

### Minor Changes

- [#9](https://github.com/aridyckovsky/effect-migrate/pull/9) [`37d8888`](https://github.com/aridyckovsky/effect-migrate/commit/37d8888efd02b6f8d8493444097c6558e03881da) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Thread command feature and project improvements

  **CLI:**
  - Add `thread add` command to track Amp thread references with tags/scope metadata
  - Add `thread list` command with human-readable and JSON output modes
  - Integrate thread tracking into audit context output (threads.json → audit.json)
  - Remove redundant NodeFileSystem.layer provision from commands

  **Core:**
  - Improve error messages with underlying causes in ConfigLoadError
  - Normalize result file paths to be relative to project root
  - Skip recursion into excluded directories for better performance

  **Project:**
  - Migrate to ESM-only builds (remove CommonJS support)
  - Convert examples to standalone projects outside workspace
  - Add effect-migrate.config.ts for self-auditing

## 0.1.0

### Patch Changes

- Initial release with core migration engine
