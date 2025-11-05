# @effect-migrate/cli

## 0.2.1

### Patch Changes

- [#26](https://github.com/aridyckovsky/effect-migrate/pull/26) [`9c4f294`](https://github.com/aridyckovsky/effect-migrate/commit/9c4f2947ef2339c679b7df5636b1f7f03d03fdb0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Read schemaVersion from package.json effectMigrate.schemaVersion instead of hardcoding it, ensuring schema version stays in sync with package configuration. Falls back to "1.0.0" when field is missing.

- [#28](https://github.com/aridyckovsky/effect-migrate/pull/28) [`ecabb12`](https://github.com/aridyckovsky/effect-migrate/commit/ecabb120ae2da2d66f9cff540e27984b56c62235) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Include threads.json reference in index.json when threads exist, making thread tracking discoverable through the Amp context index file.

- Updated dependencies [[`c1277e5`](https://github.com/aridyckovsky/effect-migrate/commit/c1277e5605df7c5450eca9be34c7590b83efb424)]:
  - @effect-migrate/core@0.2.1

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

### Patch Changes

- Updated dependencies [[`37d8888`](https://github.com/aridyckovsky/effect-migrate/commit/37d8888efd02b6f8d8493444097c6558e03881da)]:
  - @effect-migrate/core@0.2.0

## 0.1.0

### Patch Changes

- Initial release with core migration engine
- Depends on @effect-migrate/core@0.1.0
