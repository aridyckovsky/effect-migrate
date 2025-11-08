---
created: 2025-11-08
lastUpdated: 2025-11-08
author: Generated via Amp
status: ready
thread: https://ampcode.com/threads/T-87dcdcf4-6297-4e14-9f79-594d31e1c727
audience: Development team and AI coding agents
related: ../concepts/amp-integration.md
---

# @since Tag Automation Implementation Plan

## Goal

Establish a systematic, automated approach for managing `@since x.y.z` TSDoc tags throughout the TypeScript codebase, ensuring accuracy and consistency with Changesets-based version releases.

**Estimated Effort:** 4-6 hours coding + 2 hours testing

---

## Overview

Currently, the codebase has scattered and often inaccurate `@since` tags (183+ instances). Manual maintenance leads to:

- Incorrect version numbers
- Missing tags on new exports
- No validation in CI
- Inconsistent application across packages

**Solution:** Implement a three-part system:

1. **Convention:** Use `@since NEXT` placeholder for new/changed exports
2. **Automation:** Script replaces `NEXT` with actual versions during changeset version bumps
3. **Validation:** ESLint rule + CI checks enforce presence of `@since` tags on public exports

---

## Implementation Order

### Phase 1: Core Automation Script (2-3 hours)

#### File: scripts/update-since-tags.ts

**Purpose:** Post-changeset script that replaces `@since NEXT` with actual package versions.

**Code:**

```typescript
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import * as Array from "effect/Array"
import { FileSystem } from "@effect/platform"
import { Path } from "@effect/platform"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"

interface PackageVersion {
  readonly name: string
  readonly version: string
  readonly path: string
}

/**
 * Read package.json and extract name/version
 * @since NEXT
 */
const readPackageVersion = (pkgPath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(pkgPath)
    const pkg = JSON.parse(content)
    return {
      name: pkg.name,
      version: pkg.version,
      path: pkgPath.replace("/package.json", "")
    } as PackageVersion
  })

/**
 * Find all package.json files in workspace
 * @since NEXT
 */
const findWorkspacePackages = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const packagesDir = path.join(process.cwd(), "packages")
  const entries = yield* fs.readDirectory(packagesDir)

  const pkgPaths = entries
    .filter((entry) => entry.type === "Directory")
    .map((entry) => path.join(packagesDir, entry.name, "package.json"))

  return yield* Effect.forEach(pkgPaths, readPackageVersion, { concurrency: 4 })
})

/**
 * Find all TypeScript files in a package
 * @since NEXT
 */
const findTypeScriptFiles = (pkgPath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const srcPath = path.join(pkgPath, "src")
    const exists = yield* fs.exists(srcPath)

    if (!exists) return []

    // Recursively find all .ts files (excluding .d.ts)
    const findFiles = (
      dir: string
    ): Effect.Effect<string[], never, FileSystem.FileSystem | Path.Path> =>
      Effect.gen(function* () {
        const entries = yield* fs.readDirectory(dir)
        const results = yield* Effect.forEach(
          entries,
          (entry) => {
            const fullPath = path.join(dir, entry.name)
            if (entry.type === "Directory") {
              return findFiles(fullPath)
            } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
              return Effect.succeed([fullPath])
            }
            return Effect.succeed([])
          },
          { concurrency: 4 }
        )
        return results.flat()
      })

    return yield* findFiles(srcPath)
  })

/**
 * Replace @since NEXT with actual version in file
 * @since NEXT
 */
const updateSinceTagsInFile = (filePath: string, version: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(filePath)

    // Pattern: @since NEXT (with optional whitespace)
    const pattern = /@since\s+NEXT/g
    const matches = content.match(pattern)

    if (!matches || matches.length === 0) {
      return { file: filePath, updated: false, count: 0 }
    }

    const updatedContent = content.replace(pattern, `@since ${version}`)
    yield* fs.writeFileString(filePath, updatedContent)

    return { file: filePath, updated: true, count: matches.length }
  })

/**
 * Process all packages and update @since tags
 * @since NEXT
 */
const updateAllSinceTags = Effect.gen(function* () {
  yield* Console.log("🔍 Finding workspace packages...")
  const packages = yield* findWorkspacePackages

  yield* Console.log(`📦 Found ${packages.length} packages`)

  const results = yield* Effect.forEach(
    packages,
    (pkg) =>
      Effect.gen(function* () {
        yield* Console.log(`\n📝 Processing ${pkg.name} v${pkg.version}`)

        const files = yield* findTypeScriptFiles(pkg.path)
        yield* Console.log(`   Found ${files.length} TypeScript files`)

        const fileResults = yield* Effect.forEach(
          files,
          (file) => updateSinceTagsInFile(file, pkg.version),
          { concurrency: 4 }
        )

        const updated = fileResults.filter((r) => r.updated)
        const totalTags = updated.reduce((sum, r) => sum + r.count, 0)

        if (updated.length > 0) {
          yield* Console.log(`   ✅ Updated ${totalTags} tags in ${updated.length} files`)
        }

        return { pkg: pkg.name, filesUpdated: updated.length, tagsUpdated: totalTags }
      }),
    { concurrency: 1 } // Sequential to avoid log interleaving
  )

  const totalFiles = results.reduce((sum, r) => sum + r.filesUpdated, 0)
  const totalTags = results.reduce((sum, r) => sum + r.tagsUpdated, 0)

  yield* Console.log(`\n✨ Complete! Updated ${totalTags} tags in ${totalFiles} files`)
})

// Run the program
updateAllSinceTags.pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
```

**Testing:**

```bash
# Test script without changeset
pnpm tsx scripts/update-since-tags.ts

# Verify it finds packages and files correctly
# Should report "0 tags updated" if no @since NEXT exists
```

---

### Phase 2: ESLint Rule for Validation (1-2 hours)

#### File: scripts/eslint-rules/require-since-tag.mjs

**Purpose:** Custom ESLint rule to enforce `@since` tags on exported declarations.

**Code:**

```javascript
import * as tsutils from "tsutils"
import ts from "typescript"

/**
 * ESLint rule: require-since-tag
 * Enforces @since tag on all exported declarations
 * @since NEXT
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require @since tag on exported declarations",
      category: "Best Practices",
      recommended: true
    },
    messages: {
      missingSince: "Exported {{ type }} '{{ name }}' is missing @since tag",
      usePlaceholder: "New exports should use '@since NEXT' placeholder"
    },
    schema: []
  },

  create(context) {
    const sourceCode = context.getSourceCode()

    /**
     * Check if node has @since tag in JSDoc
     */
    function hasSinceTag(node) {
      const comments = sourceCode.getCommentsBefore?.(node) || []
      const jsDocComments = comments.filter((c) => c.type === "Block" && c.value.startsWith("*"))

      return jsDocComments.some((comment) => /@since\s+/.test(comment.value))
    }

    /**
     * Check if node is exported
     */
    function isExported(node) {
      // Direct export keyword
      if (node.parent?.type === "ExportNamedDeclaration") return true

      // Has export modifier
      const modifiers = node.modifiers || []
      return modifiers.some((m) => m.type === "TSExportKeyword")
    }

    /**
     * Report missing @since tag
     */
    function checkNode(node, type) {
      if (!isExported(node)) return

      if (!hasSinceTag(node)) {
        context.report({
          node,
          messageId: "missingSince",
          data: {
            type,
            name: node.id?.name || node.key?.name || "anonymous"
          }
        })
      }
    }

    return {
      FunctionDeclaration(node) {
        checkNode(node, "function")
      },

      ClassDeclaration(node) {
        checkNode(node, "class")
      },

      TSInterfaceDeclaration(node) {
        checkNode(node, "interface")
      },

      TSTypeAliasDeclaration(node) {
        checkNode(node, "type alias")
      },

      VariableDeclaration(node) {
        if (isExported(node)) {
          node.declarations.forEach((declarator) => {
            if (!hasSinceTag(node)) {
              context.report({
                node: declarator,
                messageId: "missingSince",
                data: {
                  type: "variable",
                  name: declarator.id.name
                }
              })
            }
          })
        }
      }
    }
  }
}
```

#### File: eslint.config.mjs (modification)

**Changes:**

```typescript
import requireSinceTag from "./scripts/eslint-rules/require-since-tag.mjs"

export default tseslint.config(
  // ... existing config ...
  {
    files: ["**/packages/*/src/**/*.ts"],
    plugins: {
      local: {
        rules: {
          "require-since-tag": requireSinceTag
        }
      }
    },
    rules: {
      // ... existing rules ...
      "local/require-since-tag": "error"
    }
  }
)
```

---

### Phase 3: CI Integration & Workflow (1 hour)

#### File: .github/workflows/validate-since-tags.yml

**Purpose:** CI check to ensure no `@since NEXT` tags exist in main branch.

**Code:**

```yaml
name: Validate @since Tags

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check-since-tags:
    name: Check for @since NEXT placeholders
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Check for NEXT placeholders
        run: |
          # Allow @since NEXT in non-main branches (feature development)
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            if grep -r "@since NEXT" packages/*/src/; then
              echo "❌ Found @since NEXT tags in main branch"
              echo "These should have been replaced during version bump"
              exit 1
            fi
            echo "✅ No @since NEXT placeholders found"
          else
            echo "ℹ️  Skipping check for feature branch"
          fi

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint @since validation
        run: pnpm lint
```

#### File: package.json (modification)

**Changes:**

```json
{
  "scripts": {
    "version": "changeset version && pnpm run update-since-tags && pnpm run lint:fix",
    "update-since-tags": "tsx scripts/update-since-tags.ts"
  }
}
```

---

### Phase 4: Documentation & Migration (1 hour)

#### File: AGENTS.md (additions)

**Section to add after "Commit Rules":**

````markdown
### @since Tag Convention (MANDATORY)

You MUST add `@since NEXT` tags to ALL new or modified public exports:

**REQUIRED: Use @since NEXT for new exports:**

```typescript
/**
 * Process files with lazy loading strategy.
 * @since NEXT
 */
export const processFilesLazy = (files: string[]) => {
  /* ... */
}

/**
 * Time tracking service for performance monitoring.
 * @since NEXT
 */
export class Time extends Context.Tag("Time")<Time, TimeService>() {}
```
````

**Automation workflow:**

1. Add `@since NEXT` when creating new exports
2. ESLint enforces presence of tag
3. During release: `pnpm changeset version` auto-replaces `NEXT` with package version
4. CI validates no `NEXT` tags exist in main branch

**NEVER:**

```typescript
// ❌ FORBIDDEN - No @since tag
export const myFunction = () => {
  /* ... */
}

// ❌ FORBIDDEN - Hardcoded version (will become stale)
/**
 * @since 0.5.0
 */
export const myFunction = () => {
  /* ... */
}

// ❌ FORBIDDEN - Incorrect placeholder
/**
 * @since TBD
 */
export const myFunction = () => {
  /* ... */
}
```

**Enforcement:**

- ESLint rule: `local/require-since-tag` (error)
- CI check: No `@since NEXT` in main branch
- Pre-commit: Lint checks enforce tags

**Migration of existing tags:**

Existing incorrect tags will be updated gradually:

- New code: Use `@since NEXT`
- Modified exports: Update to `@since NEXT`
- Untouched code: Leave as-is (avoid churn)

````

#### File: CONTRIBUTING.md (additions)

**Section to add in "Development Workflow":**

```markdown
### Adding @since Tags

All exported declarations (functions, classes, interfaces, types, variables) **must** include a `@since` tag in their TSDoc:

```typescript
/**
 * Description of what this does.
 *
 * @since NEXT
 * @example
 * const result = myFunction()
 */
export const myFunction = () => { /* ... */ }
````

**Important:**

- Use `@since NEXT` placeholder (do NOT hardcode version numbers)
- The automation script replaces `NEXT` with actual versions during release
- ESLint will fail if you forget the tag
- CI prevents merging to main if `@since NEXT` remains (after version bump)

**Why?** This helps users understand when APIs were introduced, especially important for library code.

````

---

### Phase 5: Migration Script for Existing Code (1 hour)

#### File: scripts/add-missing-since-tags.ts

**Purpose:** One-time migration to add `@since NEXT` to existing exports missing tags.

**Code:**

```typescript
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import { FileSystem } from "@effect/platform"
import { Path } from "@effect/platform"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"

/**
 * Check if line is an export declaration
 * @since NEXT
 */
const isExportLine = (line: string): boolean => {
  const trimmed = line.trim()
  return (
    trimmed.startsWith("export class") ||
    trimmed.startsWith("export interface") ||
    trimmed.startsWith("export type") ||
    trimmed.startsWith("export const") ||
    trimmed.startsWith("export function") ||
    trimmed.startsWith("export async function")
  )
}

/**
 * Check if previous lines contain @since tag
 * @since NEXT
 */
const hasSinceInPreviousLines = (lines: string[], currentIndex: number): boolean => {
  // Look back up to 20 lines for JSDoc
  const lookback = Math.max(0, currentIndex - 20)
  const previousLines = lines.slice(lookback, currentIndex).join("\n")
  return /@since\s+/.test(previousLines)
}

/**
 * Find where to insert @since tag (after description, before other tags)
 * @since NEXT
 */
const findInsertionPoint = (lines: string[], exportIndex: number): number => {
  // Walk backwards to find JSDoc start
  let jsDocStart = -1
  for (let i = exportIndex - 1; i >= Math.max(0, exportIndex - 20); i--) {
    if (lines[i].trim().startsWith("/**")) {
      jsDocStart = i
      break
    }
  }

  if (jsDocStart === -1) return -1 // No JSDoc found

  // Find last line of description (before first @tag or end of JSDoc)
  for (let i = jsDocStart + 1; i < exportIndex; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith("* @") || trimmed === "*/") {
      return i
    }
  }

  return exportIndex - 1 // Insert before closing */
}

/**
 * Add @since NEXT tag to file
 * @since NEXT
 */
const addMissingSinceTags = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(filePath)
    const lines = content.split("\n")

    let modified = false
    const newLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (isExportLine(line) && !hasSinceInPreviousLines(lines, i)) {
        const insertPoint = findInsertionPoint(lines, i)

        if (insertPoint !== -1) {
          // Insert accumulated lines up to insertion point
          while (newLines.length < insertPoint) {
            newLines.push(lines[newLines.length])
          }

          // Add @since tag with proper indentation
          const indent = lines[insertPoint].match(/^\s*/)?.[0] || " "
          newLines.push(`${indent}* @since NEXT`)
          modified = true

          // Add remaining lines for this export
          newLines.push(lines[insertPoint])
          i = insertPoint
          continue
        }
      }

      newLines.push(line)
    }

    if (modified) {
      yield* fs.writeFileString(filePath, newLines.join("\n"))
      return { file: filePath, updated: true }
    }

    return { file: filePath, updated: false }
  })

/**
 * Run migration on all TypeScript files
 * @since NEXT
 */
const runMigration = Effect.gen(function* () {
  yield* Console.log("🔍 Finding TypeScript files...")

  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  // Find all src directories
  const packagesDir = path.join(process.cwd(), "packages")
  const packages = yield* fs.readDirectory(packagesDir)

  const results = yield* Effect.forEach(
    packages.filter(p => p.type === "Directory"),
    (pkg) =>
      Effect.gen(function* () {
        const srcPath = path.join(packagesDir, pkg.name, "src")
        const exists = yield* fs.exists(srcPath)

        if (!exists) return []

        // Find all .ts files recursively
        const findFiles = (dir: string): Effect.Effect<string[], never, FileSystem.FileSystem | Path.Path> =>
          Effect.gen(function* () {
            const entries = yield* fs.readDirectory(dir)
            const results = yield* Effect.forEach(
              entries,
              (entry) => {
                const fullPath = path.join(dir, entry.name)
                if (entry.type === "Directory") {
                  return findFiles(fullPath)
                } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
                  return Effect.succeed([fullPath])
                }
                return Effect.succeed([])
              },
              { concurrency: 4 }
            )
            return results.flat()
          })

        const files = yield* findFiles(srcPath)

        return yield* Effect.forEach(files, addMissingSinceTags, { concurrency: 4 })
      }),
    { concurrency: 1 }
  )

  const allResults = results.flat()
  const updated = allResults.filter(r => r.updated)

  yield* Console.log(`\n✨ Complete! Updated ${updated.length} files`)

  if (updated.length > 0) {
    yield* Console.log("\nModified files:")
    yield* Effect.forEach(updated, (r) => Console.log(`  - ${r.file}`), { concurrency: "unbounded" })
  }
})

// Run migration
runMigration.pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
````

**Usage:**

```bash
# Run once to add missing tags
pnpm tsx scripts/add-missing-since-tags.ts

# Review changes
git diff

# Commit migration
git add -A
git commit -m "chore: add @since NEXT tags to public exports"
```

---

## Integration

### Changeset Workflow Integration

The automation hooks into the existing Changesets workflow:

```
1. Developer creates feature branch
2. Add/modify exports with @since NEXT tags
3. ESLint enforces tags during development
4. Create changeset: pnpm changeset
5. Commit changes + changeset

[PR merged to main]

6. Changesets bot creates "Version Packages" PR
7. pnpm changeset version runs (updates package.json versions)
8. Post-version hook runs: pnpm run update-since-tags
9. Script replaces @since NEXT → @since 0.5.0 (actual version)
10. Changeset PR updated with tag replacements
11. Merge "Version Packages" PR
12. CI validates no @since NEXT remains
13. Release published to npm
```

### ESLint Integration

The custom rule integrates with existing `@effect/eslint-plugin`:

```javascript
// eslint.config.mjs
export default tseslint.config(...effectEslint.configs.dprint, {
  rules: {
    "@effect/dprint": [
      "error",
      {
        /* config */
      }
    ],
    "@effect/no-import-from-barrel-package": [
      "error",
      {
        /* config */
      }
    ],
    "local/require-since-tag": "error" // ← New rule
  }
})
```

---

## Testing

### Unit Tests

#### File: scripts/**tests**/update-since-tags.test.ts

```typescript
import { describe, it, expect } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { FileSystem } from "@effect/platform"
import * as Layer from "effect/Layer"

const MockFS = Layer.succeed(FileSystem.FileSystem, {
  readFileString: (path) =>
    Effect.succeed(`
/**
 * Test function
 * @since NEXT
 */
export const test = () => {}
  `),
  writeFileString: (path, content) => Effect.succeed(undefined)
  // ... other methods
})

describe("update-since-tags", () => {
  it.effect("replaces @since NEXT with version", () =>
    Effect.gen(function* () {
      // Test implementation
    }).pipe(Effect.provide(MockFS))
  )
})
```

### Integration Tests

```bash
# Test full workflow in test repository
cd /tmp
mkdir test-since-tags
cd test-since-tags
pnpm init
# ... setup test package
# ... add exports with @since NEXT
pnpm changeset version
# Verify tags replaced correctly
grep -r "@since 0.1.0" src/
```

### Manual Testing Checklist

- [ ] Run `update-since-tags.ts` on current codebase
- [ ] Verify all `@since NEXT` replaced with correct versions
- [ ] Test ESLint rule catches missing tags
- [ ] Test CI workflow rejects `@since NEXT` in main
- [ ] Test full changeset → version → tag update → release workflow
- [ ] Verify no false positives in ESLint rule

---

## Success Criteria

- [ ] Script successfully replaces all `@since NEXT` → actual versions
- [ ] ESLint rule enforces tags on all exported declarations
- [ ] CI prevents `@since NEXT` from reaching main branch
- [ ] Documentation updated in AGENTS.md and CONTRIBUTING.md
- [ ] Migration script adds tags to existing exports
- [ ] Zero manual intervention needed during releases
- [ ] All new exports automatically get correct versions

---

## Files Summary

**New files:**

- `scripts/update-since-tags.ts` (~200 LOC)
- `scripts/add-missing-since-tags.ts` (~180 LOC)
- `scripts/eslint-rules/require-since-tag.mjs` (~100 LOC)
- `scripts/__tests__/update-since-tags.test.ts` (~80 LOC)
- `.github/workflows/validate-since-tags.yml` (~40 LOC)

**Modified files:**

- `package.json` (add `update-since-tags` script, modify `version` script)
- `eslint.config.mjs` (add custom rule configuration)
- `AGENTS.md` (add @since tag convention section)
- `CONTRIBUTING.md` (add @since tag usage guide)

**Total new code:** ~600 LOC\
**Total modifications:** ~50 LOC

---

## Rollout Plan

### Phase 1: Foundation (Day 1)

1. Implement `update-since-tags.ts` script
2. Test manually on one package
3. Verify version replacement works correctly

### Phase 2: Validation (Day 1-2)

1. Implement ESLint rule
2. Test on existing codebase (expect many errors)
3. Run migration script to fix existing exports
4. Commit migration changes

### Phase 3: CI Integration (Day 2)

1. Add GitHub workflow
2. Update package.json scripts
3. Test full workflow with test changeset

### Phase 4: Documentation (Day 2)

1. Update AGENTS.md
2. Update CONTRIBUTING.md
3. Create PR with all changes

### Phase 5: Monitoring (Week 1)

1. Monitor first real version bump
2. Verify automation works as expected
3. Address any edge cases discovered

---

## Edge Cases & Considerations

### Edge Cases

1. **Multi-package changesets:** If changeset bumps multiple packages with different versions, each package's files get its own version
2. **No changesets:** If version doesn't change, script skips that package
3. **Manual version bumps:** Script only works with package.json versions, supports manual edits
4. **Monorepo sub-packages:** Script recursively processes all packages/\*/src directories

### Limitations

1. **Existing incorrect tags:** Migration doesn't fix historical tags (would need git history analysis)
2. **Non-exported code:** Rule only checks exports (internal code can omit tags)
3. **Type-only exports:** May need special handling for `export type` vs `export { type }`

### Future Enhancements

1. **Docgen integration:** Use @effect/docgen to validate tags during doc generation
2. **Git history analysis:** Script to backfill historical tags based on first commit
3. **Package scope awareness:** Different tag format for internal vs public packages
4. **Removal detection:** Track when APIs are removed and add `@deprecated` tags

---

## Related Work

- **Changesets:** https://github.com/changesets/changesets
- **@effect/docgen:** Used for API documentation generation
- **TSDoc standard:** https://tsdoc.org/
- **Effect-TS conventions:** Follow their pattern for @since tags

---

## Alternatives Considered

### Alternative 1: Manual version tags

**Approach:** Developers manually add correct version when creating exports.

**Rejected because:**

- Impossible to know future version at development time
- Requires updating tags during version bumps
- High error rate, poor DX

### Alternative 2: Git-based version detection

**Approach:** Script analyzes git history to determine when each export was added.

**Rejected because:**

- Complex implementation (git blame, AST diffing)
- Doesn't work for uncommitted changes
- Breaks with rebases/squashes
- Requires full git history

### Alternative 3: No @since tags

**Approach:** Remove tags entirely, rely on CHANGELOG.md.

**Rejected because:**

- Poor IDE experience (no inline version info)
- TSDoc best practice includes @since
- Harder for consumers to determine API maturity
- Inconsistent with Effect-TS ecosystem patterns

---

**Last Updated:** 2025-11-08\
**Status:** Ready for implementation review\
**Next Steps:** Review plan → implement Phase 1 → test → proceed with remaining phases
