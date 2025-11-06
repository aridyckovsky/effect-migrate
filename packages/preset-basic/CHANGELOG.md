# @effect-migrate/preset-basic

## 0.3.0

### Minor Changes

- [#31](https://github.com/aridyckovsky/effect-migrate/pull/31) [`fc74df3`](https://github.com/aridyckovsky/effect-migrate/commit/fc74df31f132cc7af7a3bb146b2015e44477f199) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Export complete preset with 17 rules (13 pattern + 4 boundary) and default configuration

### Patch Changes

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

- [#30](https://github.com/aridyckovsky/effect-migrate/pull/30) [`c34b8f0`](https://github.com/aridyckovsky/effect-migrate/commit/c34b8f0c0bcb91a234cf44b9e4458b4edb90eb37) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add comprehensive tests for async arrow function detection in noAsyncAwait rule. The rule already supported arrow functions, but tests only covered `async function` declarations. Now includes tests for:
  - Arrow functions without parameters: `async () => {}`
  - Arrow functions with multiple parameters: `async (id, name) => {}`
  - Arrow functions with single parameter: `async x => {}`
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
