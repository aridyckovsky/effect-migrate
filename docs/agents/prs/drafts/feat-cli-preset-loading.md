---
created: 2025-11-05
lastUpdated: 2025-11-05
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-6d1b44b5-1e73-4465-9d49-9761d3555b66
audience: Development team and reviewers
tags: [pr-draft, preset-loading, cli, preset-basic, feature]
---

# feat(cli,preset-basic): implement first-class preset support

## What

Implements first-class preset support in effect-migrate, enabling users to load opinionated rule collections from npm packages. The `@effect-migrate/preset-basic` package now ships with complete boundary and pattern rules for Effect-TS migration guidance.

## Why

Currently, `config.presets` exists in the schema but isn't loaded or used by the CLI. This feature enables:
- Out-of-the-box migration guidance without manual rule configuration
- Shareable, opinionated rule sets across projects
- Separation of concerns: users configure presets, presets define rules
- Extensibility: user rules combine with preset rules

## Scope

**Packages affected:**

- `@effect-migrate/cli` - Added preset loading and rule construction infrastructure
- `@effect-migrate/preset-basic` - Completed with 13 pattern rules + 4 boundary rules
- Root docs - Updated README and example config

## Changes

### New Files

**CLI Loaders (`packages/cli/src/loaders/`):**
- `presets.ts` - Preset loading with dynamic imports and error handling
- `rules.ts` - Unified rule construction from presets + user config
- `config.ts` - Config loading and merging (extracted from commands)
- `__tests__/presets.test.ts` - Preset loading tests
- `__tests__/config.test.ts` - Config merging tests

**Preset Tests (`packages/preset-basic/src/__tests__/`):**
- `boundaries.test.ts` - Boundary rule tests with fixtures
- `patterns.test.ts` - Pattern rule tests with fixtures
- `fixtures/` - Test fixtures for rule validation

### Modified Files

**CLI Commands:**
- `packages/cli/src/commands/audit.ts` - Refactored to use `loadRulesAndConfig` helper
- `packages/cli/src/commands/metrics.ts` - Refactored to use `loadRulesAndConfig` helper

**Preset Package:**
- `packages/preset-basic/src/boundaries.ts` - Implemented 4 boundary rules
- `packages/preset-basic/src/patterns.ts` - Added 8 new pattern rules (13 total)
- `packages/preset-basic/src/index.ts` - Exported complete preset with defaults

**Documentation:**
- `README.md` - Added preset usage examples and quick start guide
- `packages/cli/README.md` - Documented preset loading behavior
- `packages/preset-basic/README.md` - Comprehensive rule documentation with examples
- `effect-migrate.config.ts` - Updated example config with preset

### Key Implementation Details

**Preset Loading Architecture:**

1. **Dynamic Imports**: Presets loaded via `import()` with proper error handling
2. **Config Merging**: Preset defaults merged with user config (user config wins)
3. **Rule Deduplication**: Preset rules + user rules combined without conflicts
4. **Graceful Degradation**: Failed preset loads warn but don't fail the command

**Deviations from Plan:**

- Created separate `config.ts`, `presets.ts`, and `rules.ts` loaders instead of single `presets.ts`
- Extracted config loading logic from commands for better separation of concerns
- Added `loadRulesAndConfig` helper to simplify command code
- Implemented more comprehensive error messages and logging

**Preset Rules Summary:**

*Pattern Rules (13):*
- `no-async-await` - Detect async/await in Effect code
- `no-try-catch` - Detect try/catch blocks
- `no-new-promise` - Detect raw Promise construction
- `no-barrel-import-effect` - Detect barrel imports from 'effect'
- `no-fs-promises` - Detect fs/promises usage
- `no-unhandled-effect` - Detect ignored Effect values
- `no-runpromise-toplevel` - Detect runPromise at module level
- `no-any-type` - Detect `any` type usage
- `no-effect-catchall-success` - Detect Effect.succeed in catchAll
- `no-effect-gen-trycatch` - Detect try/catch inside Effect.gen
- `prefer-tagged-error` - Suggest Data.TaggedError over Error
- `no-mixed-promise-effect` - Detect Promise in Effect.gen
- `no-console-log` - Detect console.log (use Console service)

*Boundary Rules (4):*
- `no-node-in-services` - Prevent Node.js built-ins in services
- `no-platform-node-in-core` - Prevent platform-node in core logic
- `no-fs-promises` - Prevent fs/promises usage (boundary enforcement)
- `no-node-path` - Prevent node:path usage (use @effect/platform Path)

## Testing

**All tests passing:**

```bash
pnpm build:types  # ✅ No type errors
pnpm typecheck    # ✅ Strict mode passes
pnpm lint         # ✅ ESLint passes
pnpm build        # ✅ All packages build
pnpm test         # ✅ All tests pass
```

**New test files:**
- `packages/cli/src/loaders/__tests__/presets.test.ts` (8 test cases)
- `packages/cli/src/loaders/__tests__/config.test.ts` (6 test cases)
- `packages/preset-basic/src/__tests__/boundaries.test.ts` (3 rule suites)
- `packages/preset-basic/src/__tests__/patterns.test.ts` (13 rule suites)

**Test Coverage:**
- Preset loading (valid/invalid exports, missing modules, merge logic)
- Config merging (user overrides, deep merge, empty presets)
- Each preset rule validated against positive and negative fixtures
- Integration: audit/metrics commands with preset-loaded rules

## Changeset

- [x] Changeset added

**Changeset summary:**

> Implement first-class preset support. CLI now loads and merges rules from configured presets. `@effect-migrate/preset-basic` ships with 13 pattern rules and 3 boundary rules for Effect-TS migration guidance.

## Checklist

- [x] Code follows Effect-TS best practices
- [x] TypeScript strict mode passes
- [x] All tests pass
- [x] Linter passes
- [x] Build succeeds
- [x] Changeset created
- [x] Documentation updated (README, package READMEs)

## Agent Context (for AI agents)

**Implementation approach:**

- Used Effect.gen for async preset loading with proper error handling
- Extracted loader logic into separate modules (config, presets, rules) for maintainability
- Created `loadRulesAndConfig` unified helper to simplify command code
- Implemented comprehensive test coverage with vitest and @effect/vitest
- Used makePatternRule and makeBoundaryRule helpers for consistent rule construction

**Amp Thread(s):**

- https://ampcode.com/threads/T-6d1b44b5-1e73-4465-9d49-9761d3555b66 (Initial implementation)
- https://ampcode.com/threads/T-c6ce0016-b671-4509-aecc-688aa3602c42 (Refactoring and tests)
- https://ampcode.com/threads/T-e9999780-8d6a-49b9-8890-a1fda9aea689 (Fixes and completion)

**Related docs:**

- @docs/agents/plans/preset-loading.md (Implementation plan)
