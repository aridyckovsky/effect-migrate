---
created: 2025-11-05T20:35:00Z
lastUpdated: 2025-11-05T20:35:00Z
author: amp
status: draft
thread: https://ampcode.com/threads/T-abcdff21-df31-4f79-b079-f746a7450035
audience: developers
tags:
  - core
  - bug
  - file-discovery
  - glob
  - performance
---

# PR Draft: fix(core): glob exclusion matching for nested directories

## What

Fixed directory exclusion logic in FileDiscovery service to properly match exclude patterns against actual directory paths instead of synthetic pattern strings. This resolves issue #14 where nested directories weren't being properly excluded during traversal.

## Why

**Root Cause:** The directory recursion pruning was comparing exclude patterns against synthesized pattern strings like `"**/entry/**"` instead of actual directory paths. When excludes were absolute (e.g., `/path/to/project/**/services/**`), they never matched the synthetic patterns, causing unnecessary traversal into excluded directories.

**Impact:**
- Incorrect behavior: Excluded directories were still traversed (files filtered at the end)
- Performance degradation: Unnecessary file system operations on large repos
- Memory issues: Could lead to OOM on repos with many files in excluded directories

## Scope

**Packages affected:**
- `@effect-migrate/core`

**Changes:**
- Modified `FileDiscovery.ts` directory exclusion logic (lines 201-222)
- Added 3 new tests in `FileDiscovery.test.ts`

## Changeset

- [x] Changeset added

**Changeset summary:**
> Fix: Correctly prune nested directories using exclude globs in FileDiscovery. Exclude patterns are now matched against directory paths (absolute and relative) and support trailing "/**". Adds tests for absolute and relative nested directory exclusions.

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
1. `should exclude nested directories with absolute pattern (/**)`
2. `should exclude nested directories with relative pattern (/**)`
3. `should exclude nested directories when exclude omits trailing /**`

**Test results:**
- All 78 core tests pass
- New tests verify both absolute and relative exclude patterns
- Validates trailing `/**` support

## Checklist

- [x] Code follows Effect-TS best practices
- [x] TypeScript strict mode passes
- [x] All tests pass (78/78 core tests)
- [x] Linter passes
- [x] Build succeeds
- [x] Changeset created
- [x] Documentation updated (N/A - internal fix)

## Agent Context (for AI agents)

**Implementation approach:**

Replaced pattern-vs-pattern matching with path-vs-pattern matching:

1. **Before:** Matched exclude patterns against synthetic patterns like `["${relDir}/**", "**/entry/**"]`
2. **After:** Match exclude patterns against actual paths (both absolute `full` and relative `relDir`)
3. **Enhancement:** Added `stripTrailingGlobDir()` helper to support patterns ending in `/**` matching the directory itself

**Key changes:**
- Used Effect.gen pattern for async directory traversal
- Maintained lazy loading and caching behavior
- Improved performance by avoiding recursion into excluded directories

**Amp Thread:**
- https://ampcode.com/threads/T-abcdff21-df31-4f79-b079-f746a7450035

**Related issue:**
- Fixes #14

**Effect patterns used:**
- `Effect.gen` for sequential operations
- Platform-agnostic `FileSystem` and `Path` services
- Proper error handling with typed errors

**Performance benefit:**
- Reduces unnecessary file system traversal
- Prevents OOM on large repos with many excluded files
- Early exit during directory walk
