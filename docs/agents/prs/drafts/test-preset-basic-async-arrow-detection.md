---
created: 2025-11-05
lastUpdated: 2025-11-05
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-e2499da8-64c6-4c71-ac28-d29ef976a0df
audience: Development team and reviewers
tags: [pr-draft, preset-basic, testing, async-arrow, issue-7]
---

# PR Draft: test(preset-basic): add async arrow function tests to noAsyncAwait rule

## What

Added comprehensive test coverage for async arrow function detection in the `noAsyncAwait` rule. The rule's regex pattern already supported arrow functions, but tests only covered `async function` declarations.

## Why

Issue #7 identified that while the `noAsyncAwait` rule was documented to detect arrow function syntax, there was no test coverage verifying this behavior. This created a risk that future refactoring could break arrow function detection without being caught.

## Scope

**Packages affected:**

- `@effect-migrate/preset-basic`

**Changes:**

- Added 3 new tests in `packages/preset-basic/test/patterns.test.ts`

## Changeset

- [x] Changeset added

**Changeset summary:**

> Add comprehensive tests for async arrow function detection in noAsyncAwait rule. The rule already supported arrow functions, but tests only covered `async function` declarations.

## Testing

```bash
pnpm build:types
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

**All checks passed ✅**

**New tests added:**

1. `noAsyncAwait detects async arrow functions`
2. `noAsyncAwait detects async arrow functions with parameters`
3. `noAsyncAwait detects async arrow functions with single parameter`

**Test results:**

- All 6 tests in `packages/preset-basic/test/patterns.test.ts` pass
- New tests verify arrow function detection works correctly
- Existing tests continue to pass (no regressions)

## Checklist

- [x] Code follows Effect-TS best practices
- [x] TypeScript strict mode passes
- [x] All tests pass (6/6 in patterns.test.ts)
- [x] Linter passes
- [x] Build succeeds
- [x] Changeset created
- [x] Documentation updated (N/A - test-only change)

## Agent Context (for AI agents)

**Implementation approach:**

Discovered the rule already supported arrow functions via regex pattern on line 14 of `patterns.ts`:

- Pattern: `/\basync\s+(function\s+\w+|(\([^)]*\)|[\w]+)\s*=>)/g`
- Added three test cases using existing mock context pattern
- Each test verifies a different arrow function syntax variant
- Used `Effect.gen` pattern consistent with existing tests

**Amp Thread:**

- https://ampcode.com/threads/T-e2499da8-64c6-4c71-ac28-d29ef976a0df

**Related issue:**

- Resolves #7

**Effect patterns used:**

- `Effect.gen` for test execution
- Mock `RuleContext` following existing test patterns
- Proper assertions for rule results
