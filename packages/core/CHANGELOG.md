# @effect-migrate/core

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
