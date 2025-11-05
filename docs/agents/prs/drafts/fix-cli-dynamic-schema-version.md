---
created: 2025-11-05
lastUpdated: 2025-11-05
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-e20aa8e6-d2d0-431c-a091-2fa128684617
audience: Development team and reviewers
tags: [pr-draft, bug-fix, cli, schema, amp-context]
---

# PR Draft: fix(cli): make schemaVersion dynamic from package.json

## Title
```
fix(cli): make schemaVersion dynamic from package.json
```

## Description

### What

Implements dynamic `schemaVersion` loading from `package.json` to replace hardcoded value in Amp context output.

### Why

Fixes [#20](https://github.com/aridyckovsky/effect-migrate/issues/20).

The CLI was writing `index.json` with a hardcoded `schemaVersion: "1.0.0"` that could become stale as the context schema evolves. This change ensures schema version metadata stays in sync with package configuration, enabling downstream tools to make decisions based on accurate schema version information.

### Scope

**Packages affected:**
- `@effect-migrate/cli`

**Files changed:**
- `packages/cli/package.json` - Added `effectMigrate.schemaVersion` field
- `packages/cli/src/amp/context-writer.ts` - Implemented dynamic version loading
- `packages/cli/test/amp/context-writer.test.ts` - Added comprehensive tests

### Changes

#### 1. Added `effectMigrate.schemaVersion` to package.json

```json
{
  "effectMigrate": {
    "schemaVersion": "1.0.0"
  }
}
```

#### 2. Implemented `getPackageMeta()` helper

Replaced `getToolVersion()` with a more comprehensive `getPackageMeta()` that reads both `version` and `effectMigrate.schemaVersion` from package.json. Includes intelligent path resolution for both production (built) and test (tsx) environments.

**Key features:**
- Reads both `toolVersion` and `schemaVersion` in one call
- Falls back to `"1.0.0"` when `effectMigrate.schemaVersion` is missing
- Handles path resolution for dev/test vs production builds
- Properly typed with exported `PackageMeta` interface

#### 3. Updated `writeAmpContext()` to use dynamic schemaVersion

Changed from:
```typescript
const toolVersion = yield* getToolVersion
// ...
schemaVersion: "1.0.0",  // hardcoded
```

To:
```typescript
const { toolVersion, schemaVersion } = yield* getPackageMeta
// ...
schemaVersion,  // dynamic
```

#### 4. Added comprehensive tests

Created `packages/cli/test/amp/context-writer.test.ts` with tests covering:
- ✅ Dynamic schemaVersion loading from package.json
- ✅ Valid semver format validation
- ✅ All required index.json fields present
- ✅ Proper file creation (audit.json, index.json, badges.md)
- ✅ Empty results handling

### Testing

**All checks passing:**

```bash
pnpm --filter @effect-migrate/cli typecheck  ✓
pnpm --filter @effect-migrate/cli lint       ✓
pnpm --filter @effect-migrate/cli build      ✓
pnpm --filter @effect-migrate/cli test       ✓
```

**Manual verification:**

1. **With `effectMigrate.schemaVersion` field:**
   ```bash
   node packages/cli/build/esm/index.js audit --amp-out .amp/test-output
   cat .amp/test-output/index.json
   # ✓ schemaVersion: "1.0.0" (from package.json)
   ```

2. **Without field (fallback test):**
   ```bash
   # Temporarily removed effectMigrate field from package.json
   node packages/cli/build/esm/index.js audit --amp-out .amp/test-fallback
   cat .amp/test-fallback/index.json
   # ✓ schemaVersion: "1.0.0" (fallback default)
   ```

**Test results:**
- 48 tests passing across all CLI test suites
- 3 new tests in context-writer.test.ts
- No regressions in existing tests

### Backward Compatibility

- ✅ No breaking changes to existing outputs
- ✅ `schemaVersion` remains a string (semver format)
- ✅ Fallback to `"1.0.0"` ensures consistent behavior
- ✅ Future `schemaVersion` bumps only require updating package.json

### Changeset

```markdown
---
"@effect-migrate/cli": patch
---

Read schemaVersion from package.json effectMigrate.schemaVersion instead of hardcoding it, ensuring schema version stays in sync with package configuration. Falls back to "1.0.0" when field is missing.
```

### Checklist

- [x] Code follows Effect-TS best practices
- [x] TypeScript strict mode passes
- [x] All tests pass (48/48)
- [x] Linter passes
- [x] Build succeeds
- [x] Changeset created
- [x] Manual testing completed
- [x] Backward compatibility maintained
- [x] Fallback behavior tested

### Agent Context (for AI agents)

**Implementation approach:**
- Created `PackageMeta` interface to encapsulate both toolVersion and schemaVersion
- Implemented `getPackageMeta()` Effect with dual path resolution (build vs test)
- Used optional chaining with nullish coalescing for safe fallback: `packageJson.effectMigrate?.schemaVersion ?? "1.0.0"`
- Removed now-unused `getToolVersion()` function to avoid duplication
- Used `it.scoped()` for tests requiring temporary directories

**Effect patterns used:**
- `Effect.gen` for sequential operations
- `FileSystem.FileSystem` and `Path.Path` services
- `fs.exists()` for conditional path resolution
- Scoped effects for resource cleanup in tests

**Amp Thread:**
- https://ampcode.com/threads/T-e20aa8e6-d2d0-431c-a091-2fa128684617

**Related issue:**
- Closes #20

### Estimated Review Time
Small (<15 minutes)
