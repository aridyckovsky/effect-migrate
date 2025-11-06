# @effect-migrate/cli

## 0.3.0

### Minor Changes

- [#40](https://github.com/aridyckovsky/effect-migrate/pull/40) [`4fc03b9`](https://github.com/aridyckovsky/effect-migrate/commit/4fc03b96a64d1615b8ff7bc631f668f72e671c31) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add tri-state --amp-out option with Effect patterns
  - Add `normalizeArgs.ts` for handling bare --amp-out flag (converts to sentinel value)
  - Add Effect-based helpers in `amp/options.ts`:
    - `resolveAmpOut()`: converts Option<string> to tri-state AmpOutMode
    - `withAmpOut()`: conditionally executes Effect when output requested
    - `getAmpOutPathWithDefault()`: for commands that always write output
  - Refactor audit, metrics, and thread commands to use helpers (no switch statements)
  - Support three modes:
    - Omitted flag: no file output
    - Bare flag `--amp-out`: writes to default path `.amp/effect-migrate`
    - Flag with value `--amp-out=path`: writes to custom path

- [#31](https://github.com/aridyckovsky/effect-migrate/pull/31) [`54905e7`](https://github.com/aridyckovsky/effect-migrate/commit/54905e757a5f2035c71f92cc32d0e7e8f900b41e) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add preset loading infrastructure with dynamic imports, config merging, and unified rule construction

### Patch Changes

- [#40](https://github.com/aridyckovsky/effect-migrate/pull/40) [`255240b`](https://github.com/aridyckovsky/effect-migrate/commit/255240b133c6975e34467fc4d0c2d19089d92306) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Refactor CLI to use amp utilities from core package
  - Import amp utilities from `@effect-migrate/core/amp` instead of local modules
  - Create `amp/options.ts` for CLI-specific amp options
  - Update audit, metrics, and thread commands to use core schemas
  - Remove duplicate amp utility code from CLI package

- [#31](https://github.com/aridyckovsky/effect-migrate/pull/31) [`faaf291`](https://github.com/aridyckovsky/effect-migrate/commit/faaf2919dcfab9d9665824241af7004cda7500b4) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Refactor audit and metrics commands to use loadRulesAndConfig helper, simplifying rule construction logic

- [#40](https://github.com/aridyckovsky/effect-migrate/pull/40) [`b8c540a`](https://github.com/aridyckovsky/effect-migrate/commit/b8c540a297030e4dc275301e1cbc09f5a19e90ea) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Upgrade `effect` packages and fix dependency versions
  - Upgrade `effect` from 3.18.4 to 3.19.2
  - Upgrade `@effect/platform` from 0.92.1 to 0.93.0
  - Upgrade `@effect/platform-node` from 0.98.4 to 0.100.0
  - Upgrade `@effect/cli` from 0.71.0 to 0.72.0
  - Upgrade `@effect/vitest` from 0.26.0 to 0.27.0
  - Replace "latest" with specific versions for `@types/node` (^24.10.0) and `typescript` (^5.9.3)

- Updated dependencies [[`eeb0290`](https://github.com/aridyckovsky/effect-migrate/commit/eeb02904f29c98a4b5ecf0f7b338932e3450773a), [`eeb0290`](https://github.com/aridyckovsky/effect-migrate/commit/eeb02904f29c98a4b5ecf0f7b338932e3450773a), [`255240b`](https://github.com/aridyckovsky/effect-migrate/commit/255240b133c6975e34467fc4d0c2d19089d92306), [`b8c540a`](https://github.com/aridyckovsky/effect-migrate/commit/b8c540a297030e4dc275301e1cbc09f5a19e90ea)]:
  - @effect-migrate/core@0.3.0

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
