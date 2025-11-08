---
created: 2025-11-08
lastUpdated: 2025-11-08
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-3cdeac4e-ff15-4d90-bb85-0426185e695c
audience: Development team and reviewers
tags: [pr-draft, bug-fix, cli, development-workflow, documentation]
---

# PR Draft: fix(cli): use dynamic version from package.json and improve dev workflow

## What

Fixes CLI version display bug, adds development workflow improvement, and updates documentation to match current architecture.

## Why

**Issue 1: CLI version bug**

- CLI was displaying hardcoded version "0.1.0" instead of actual package version "0.4.0" from package.json

**Issue 2: Development friction**

- Developers had to rebuild CLI (`pnpm build`) after every change to test, slowing iteration

**Issue 3: Outdated documentation**

- AGENTS.md files referenced incorrect directory structures and patterns

## Scope

**Packages affected:**

- `@effect-migrate/core` - Added `getPackageMeta` service
- `@effect-migrate/cli` - Updated to use dynamic version
- Root workspace - Added `pnpm cli` script

**Files changed:**

- `packages/core/src/amp/package-meta.ts` - New getPackageMeta service
- `packages/core/src/index.ts` - Export getPackageMeta and PackageMeta
- `packages/cli/src/index.ts` - Use dynamic version, enhance CLI config
- `package.json` - Add 'cli' script
- `AGENTS.md` - Update development workflow and directory structure
- `packages/cli/AGENTS.md` - Update CLI patterns and directory structure

## Changes

### 1. Added `getPackageMeta` Effect service to core

Created `packages/core/src/amp/package-meta.ts` with:

- `PackageMeta` interface exposing `toolVersion` and `schemaVersion`
- `getPackageMeta` Effect that reads package.json at runtime
- Intelligent path resolution for both production (built) and development (tsx) environments
- Fallback to safe defaults when package.json not found

**Key features:**

```typescript
export const getPackageMeta = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  // Try production path (build/esm) first, then dev path (src)
  const packageJsonPath = // ... path resolution

  const pkg = yield* /* read and parse package.json */

  return {
    toolVersion: pkg.version,
    schemaVersion: pkg.effectMigrate?.schemaVersion ?? "1.0.0"
  }
})
```

### 2. Exported from core public API

Updated `packages/core/src/index.ts`:

```typescript
export { getPackageMeta } from "./amp/package-meta.js"
export type { PackageMeta } from "./amp/package-meta.js"
```

### 3. Updated CLI to use dynamic version with Effect composition

Changed `packages/cli/src/index.ts` from imperative style to proper Effect composition:

**Before:**

```typescript
const toolVersion = "0.1.0" // hardcoded

Command.run(cli, {
  name: "effect-migrate",
  version: toolVersion
})(process.argv).pipe(/* ... */)
```

**After:**

```typescript
const program = Effect.gen(function* () {
  const { toolVersion } = yield* getPackageMeta

  return yield* Command.run(cli, {
    name: "effect-migrate",
    version: toolVersion,
    executable: "effect-migrate",
    summary: Span.text("TypeScript migration toolkit using Effect patterns"),
    footer: HelpDoc.p(
      "Documentation: https://github.com/aridyckovsky/effect-migrate\n" +
        "Report issues: https://github.com/aridyckovsky/effect-migrate/issues"
    )
  })(argv)
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Effect.logError(`Fatal error: ${error}`)
      return 1
    })
  )
)

program.pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
```

**Improvements:**

- ✅ Version read from package.json dynamically
- ✅ Enhanced CLI config with executable, summary, and footer
- ✅ Proper error handling with Effect.catchAll (exits with code 1 on fatal errors)
- ✅ Effect.gen composition instead of imperative style

### 4. Added 'pnpm cli' development script

Added to root `package.json`:

```json
{
  "scripts": {
    "cli": "tsx packages/cli/src/index.ts"
  }
}
```

**Benefits:**

- Run CLI from TypeScript source without rebuilding
- Faster iteration during development
- Consistent with Effect-first development patterns

### 5. Updated AGENTS.md documentation

**Root AGENTS.md:**

- Updated "CLI Development" section to mandate `pnpm cli` usage
- Updated directory structure to show current commands: audit, docs, init, metrics, thread
- Added explicit "NEVER build the CLI to test it" rule

**packages/cli/AGENTS.md:**

- Updated directory structure with actual commands list
- Updated CLI Architecture section with actual implementation from index.ts
- Updated Entry Point Pattern to show Effect.gen composition
- Added proper error handling examples

## Testing

**Version display verification:**

```bash
pnpm cli --version
# ✓ Shows: 0.4.0 (correct, from package.json)
```

**Development workflow:**

```bash
# Edit packages/cli/src/commands/audit.ts
pnpm cli audit
# ✓ Changes reflected immediately, no rebuild needed
```

**All checks passing:**

```bash
pnpm build:types  ✓
pnpm typecheck    ✓
pnpm lint         ✓
pnpm build        ✓
pnpm test         ✓
```

## Backward Compatibility

- ✅ No breaking changes to CLI behavior
- ✅ Version now correctly displays package version (previously showed wrong version)
- ✅ All existing commands work unchanged
- ✅ `getPackageMeta` is additive to core public API

## Changeset

```markdown
---
"@effect-migrate/core": minor
"@effect-migrate/cli": patch
---

Add getPackageMeta service to core for dynamic version reading. Update CLI to use dynamic version from package.json instead of hardcoded value, and enhance CLI configuration with executable, summary, and footer. Add 'pnpm cli' script for running CLI from source during development.
```

## Checklist

- [x] Code follows Effect-TS best practices
- [x] TypeScript strict mode passes
- [x] All tests pass
- [x] Linter passes
- [x] Build succeeds
- [x] Changeset created
- [x] Manual testing completed
- [x] Backward compatibility maintained
- [x] Documentation updated (AGENTS.md files)

## Agent Context (for AI agents)

**Implementation approach:**

- Created Effect service for package metadata reading with dual path resolution
- Used Effect.gen composition for CLI main program (Effect-first pattern)
- Exported getPackageMeta from core public API following export boundary rules
- Added proper error handling with Effect.catchAll returning exit code 1
- Used tsx for development script to avoid build step

**Effect patterns used:**

- `Effect.gen` for sequential operations with dependencies
- `FileSystem.FileSystem` and `Path.Path` services from @effect/platform
- `Effect.catchAll` for top-level error handling
- Proper layer provision with `NodeContext.layer`

**Commit structure (6 granular commits):**

1. `feat(core): add getPackageMeta service for dynamic version loading`
2. `feat(cli): use dynamic version from package.json and add CLI config options`
3. `chore: add 'cli' script for local development`
4. `docs: update development workflow to use 'pnpm cli' command`
5. `chore: fix formatting`
6. `docs: update AGENTS.md directory structure and CLI patterns`

**Amp Thread(s):**

- Main thread: https://ampcode.com/threads/T-3cdeac4e-ff15-4d90-bb85-0426185e695c
- CLI version bug fix: https://ampcode.com/threads/T-a5d9be1b-8981-4498-8762-0f15acaa30c4
- AGENTS.md updates: https://ampcode.com/threads/T-c6fbd260-bc84-44a2-b4c6-a6e976db2a34

## Estimated Review Time

Medium (15-30 minutes) - Multiple packages affected, documentation updates
