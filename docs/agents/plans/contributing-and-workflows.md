---
created: 2025-11-05
lastUpdated: 2025-11-05
author: Generated via Amp (Oracle + Librarian analysis)
status: ready
thread: https://ampcode.com/threads/T-8b3e5303-5997-447c-95c9-b32c5e7c3eaa
related: ../concepts/amp-integration.md
audience: Development team (human and AI agents)
tags: [contributing, workflows, git, github, documentation]
---

# Contributing Documentation and Git Workflow Implementation Plan

## Goal

Create comprehensive developer documentation (CONTRIBUTING.md) and update AGENTS.md with git/GitHub workflow rules to establish clear branching strategy, PR conventions, and testing requirements for both human developers and AI agents (Amp).

**Estimated Effort:** 2-3 hours writing + 1 hour testing/validation

---

## Overview

Based on Oracle recommendations and Librarian research of best practices from well-maintained TypeScript monorepos (Effect-TS, pnpm monorepos, changesets-based projects), we'll create:

1. **CONTRIBUTING.md** - Human-friendly guide for contributors
2. **AGENTS.md updates** - Git/GitHub workflow rules for AI agents
3. **Branch protection recommendations** - Optional GitHub settings

This establishes a foundation for handling bug fixes as individual PRs (per T-e20aa8e6-d2d0-431c-a091-2fa128684617) and ensures clean, maintainable development workflows.

---

## Implementation Order

### Phase 1: Create CONTRIBUTING.md (1.5 hours)

#### File: CONTRIBUTING.md

**Purpose:** Primary documentation for human developers contributing to the project, with clear pointers to AGENTS.md for AI-specific guidance.

**Structure:**

````markdown
# Contributing to effect-migrate

**For AI Coding Agents:** See [AGENTS.md](./AGENTS.md) for comprehensive development guidance including Effect-TS patterns, anti-patterns, and agent-specific workflows.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Branching Strategy](#branching-strategy)
5. [Pull Request Process](#pull-request-process)
6. [Testing Requirements](#testing-requirements)
7. [Working with Changesets](#working-with-changesets)
8. [Code Standards](#code-standards)
9. [Troubleshooting](#troubleshooting)
10. [Resources](#resources)

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or higher (`.node-version` specifies exact version)
- [pnpm](https://pnpm.io/) v10.14.0 or higher
- [Git](https://git-scm.com/)
- Familiarity with [Effect-TS](https://effect.website) recommended

> **Note:** This project uses pnpm workspaces, changesets for version management, and Effect-TS for all business logic.

## Getting Started

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/effect-migrate.git
cd effect-migrate
```
````

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build Packages

```bash
# Build all packages (respects dependency order)
pnpm build

# Build specific package with dependencies
pnpm --filter @effect-migrate/cli... build
```

### 4. Verify Setup

```bash
pnpm build:types
pnpm typecheck
pnpm lint
pnpm test
```

## Development Workflow

### Monorepo Commands

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `pnpm build`        | Build all packages                  |
| `pnpm build:types`  | Build TypeScript declarations only  |
| `pnpm test`         | Run all tests                       |
| `pnpm test --watch` | Run tests in watch mode             |
| `pnpm typecheck`    | Type check all packages             |
| `pnpm lint`         | Lint all packages                   |
| `pnpm lint:fix`     | Auto-fix linting issues             |
| `pnpm changeset`    | Create a changeset for version bump |
| `pnpm clean`        | Clean all build artifacts           |

### Working with Specific Packages

```bash
# Run commands in specific package
pnpm --filter @effect-migrate/core test
pnpm --filter @effect-migrate/cli build

# Run in package and its dependencies (note the ...)
pnpm --filter @effect-migrate/cli... build
```

See [pnpm filtering docs](https://pnpm.io/filtering) for more options.

## Branching Strategy

We use a simple, linear branching model with protected `main` branch:

### Branch Types

- **`main`** (protected)
  - Always green CI
  - Only merge via squash commits
  - Never push directly

- **`feature/<area>-<description>`** - New features
  - Example: `feature/core-file-discovery-cache`
  - Example: `feature/cli-json-formatter`

- **`fix/<package>-<description>`** - Bug fixes
  - **One bug per branch/PR**
  - Example: `fix/cli-exit-code-on-error`
  - Example: `fix/core-import-resolution`

- **`docs/<scope>-<description>`** - Documentation
  - Example: `docs/contributing-setup`
  - Example: `docs/agents-git-workflows`

- **`chore/<scope>-<description>`** - Maintenance
  - Example: `chore/deps-update-effect`
  - Example: `chore/ci-cache-optimization`

### Branch Creation

```bash
# Start from latest main
git checkout main
git pull origin main

# Create your branch
git checkout -b feature/core-lazy-loading
# or
git checkout -b fix/cli-missing-config
```

## Pull Request Process

### PR Title Format

Use [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>(<scope>): <description>

Examples:
feat(core): add lazy file loading for large repositories
fix(cli): exit with code 1 when audit finds violations
docs(preset-basic): document no-async-await rule
chore(ci): add pnpm cache to speed up builds
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `test` - Adding/updating tests
- `refactor` - Code refactoring (no behavior change)
- `chore` - Maintenance, dependencies, tooling
- `ci` - CI/CD changes

**Scopes:**

- `core` - @effect-migrate/core package
- `cli` - @effect-migrate/cli package
- `preset-basic` - @effect-migrate/preset-basic package
- Or omit scope for repo-wide changes

### PR Description Template

````markdown
## What

Brief summary of changes.

## Why

Why this change is needed (link to issue/thread if applicable).

## Scope

Which packages are affected:

- `@effect-migrate/core`
- `@effect-migrate/cli`

## Changeset

- [ ] Changeset added (for user-facing changes)
- [ ] No changeset needed (docs/tests/internal only)

**Changeset summary:**

> [paste your changeset description or link to .changeset/*.md file]

## Testing

How this was tested:

```bash
pnpm build:types
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```
````

Specific tests added/updated:

- `packages/core/src/services/FileDiscovery.test.ts` - Added cache tests

## Breaking Changes

- [ ] Yes (requires major version bump)
- [x] No

**Migration notes (if breaking):**
N/A

## Related

- Issue: #123
- Amp Thread: https://ampcode.com/threads/T-...
- Related PR: #456

## Agent Context (if applicable)

> **For AI-generated or AI-assisted PRs:**
>
> - Thread URL: https://ampcode.com/threads/T-...
> - Scope: `packages/core/src/**`
> - Key decisions: [brief summary]

````

### PR Checklist

Before requesting review, ensure:

- [ ] `pnpm build:types` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (or run `pnpm lint:fix`)
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes
- [ ] Tests added/updated for new functionality
- [ ] Changeset added for user-facing changes (`pnpm changeset`)
- [ ] No unrelated formatting or lockfile churn
- [ ] Documentation updated (README, JSDoc, etc.)
- [ ] PR description filled out completely

### Review Process

- **Non-breaking changes:** Minimum 1 approval
- **Breaking changes:** Minimum 2 approvals
- **CI must be green** before merge
- Squash merge only (preserves linear history)

## Testing Requirements

### Before Opening PR

Run the full test suite locally:

```bash
# At repository root
pnpm build:types
pnpm typecheck
pnpm lint
pnpm build
pnpm test
````

Or for a specific package:

```bash
pnpm --filter @effect-migrate/core build
pnpm --filter @effect-migrate/core test
```

### Test Organization

- **Unit tests:** Side-by-side with code as `*.test.ts`
- **Integration tests:** In `test/` directories
- **Test framework:** Vitest with `@effect/vitest`

### Writing Tests

Use Effect-style tests with `@effect/vitest`:

```typescript
import { expect, it } from "@effect/vitest"
import { Effect } from "effect"

it.effect("should process files correctly", () =>
  Effect.gen(function* () {
    const result = yield* processFiles(["test.ts"])
    expect(result.length).toBeGreaterThan(0)
  })
)

// For scoped resources
it.scoped("should cleanup resources", () =>
  Effect.gen(function* () {
    const resource = yield* acquireResource()
    expect(resource.isOpen).toBe(true)
    // Automatically released after test
  })
)
```

### Coverage Expectations

- New features: Add tests covering main code paths
- Bug fixes: Add regression test demonstrating the fix
- Critical paths: Aim for high coverage (80%+)

## Working with Changesets

### When to Add a Changeset

**Yes - Add a changeset for:**

- New features in published packages
- Bug fixes affecting user-facing behavior
- Performance improvements
- Breaking changes
- Deprecations

**No - Skip changeset for:**

- Documentation-only changes
- CI/CD configuration
- Internal refactors with zero user impact
- Test-only changes

### Creating a Changeset

```bash
pnpm changeset
```

You'll be prompted to:

1. **Select packages** - Choose which packages are affected
   - `@effect-migrate/core`
   - `@effect-migrate/cli`
   - `@effect-migrate/preset-basic`

2. **Choose version bump**
   - `patch` (0.0.X) - Bug fixes, minor improvements
   - `minor` (0.X.0) - New features, backward-compatible
   - `major` (X.0.0) - Breaking changes

3. **Write description** - Clear, user-facing summary

This creates a `.changeset/*.md` file. **Commit this file** with your changes:

```bash
git add .changeset/*.md
git commit -m "chore: add changeset for lazy loading feature"
```

### Version Management

**Important:**

- **DO NOT run** `pnpm changeset version` locally
- The Release GitHub workflow handles versioning automatically
- It creates/updates a "Version Packages" PR
- Merging that PR publishes to npm

### Multiple Changesets

Multiple changesets can accumulate on `main`. They're all processed together when the "Version Packages" PR is merged.

### Parallel PRs

Each PR can have its own changeset without conflicts (random filenames). If by chance two PRs create the same changeset filename, rerun `pnpm changeset` in one PR.

## Code Standards

### Effect-TS Patterns

For comprehensive Effect-TS guidance, see [AGENTS.md - Effect-TS Best Practices](./AGENTS.md#effect-ts-best-practices).

**Key patterns:**

**Use Effect.gen for sequential operations:**

```typescript
// ✅ GOOD
const program = Effect.gen(function* () {
  const config = yield* loadConfig()
  const files = yield* listFiles(config.paths)
  return processFiles(files)
})

// ❌ BAD - Don't mix async/await with Effect
const bad = async () => {
  const result = await Effect.runPromise(someEffect)
}
```

**Import from specific modules (avoid barrel imports):**

```typescript
// ✅ GOOD - Specific imports for tree-shaking
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"

// ❌ BAD - Barrel imports hurt bundle size
import { Effect, Console } from "effect"
```

**Handle errors with tagged errors:**

```typescript
import { Data } from "effect"

class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly path: string
  readonly message: string
}> {}

const loadConfig = (path: string): Effect.Effect<Config, ConfigError> =>
  Effect.gen(function* () {
    // ...
  })
```

**See more:**

- [AGENTS.md - Anti-Patterns](./AGENTS.md#anti-patterns)
- [AGENTS.md - Services and Layers](./AGENTS.md#effect-ts-best-practices)

### TypeScript

- **Strict mode enabled** (`strict: true`, `exactOptionalPropertyTypes: true`)
- **No `any` types** - Use `unknown` and validate with `effect/Schema`
- **Export types** alongside implementations
- **Use `readonly`** for immutable data structures

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(core): add pattern detection for async/await"
git commit -m "fix(cli): handle missing config file gracefully"
git commit -m "docs: update installation instructions"
git commit -m "test(core): add tests for FileDiscovery service"
```

### Documentation

- Add **JSDoc comments** to all exported functions
- Include **`@example`** tags with usage examples
- Document **error cases** and edge cases
- Update **README** when adding user-facing features
- Keep **AGENTS.md** updated with new patterns/anti-patterns

## Troubleshooting

### Build Failures

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Type Errors in IDE

```bash
# Rebuild TypeScript project references
pnpm build:types

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Test Failures

```bash
# Run tests with verbose output
pnpm test --reporter=verbose

# Run specific test file
pnpm test packages/core/src/services/FileDiscovery.test.ts

# Watch mode for debugging
pnpm test --watch
```

### Dependency Issues

```bash
# Clean reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Lockfile Conflicts

If you have merge conflicts in `pnpm-lock.yaml`:

```bash
# Rebase on latest main
git fetch origin
git rebase origin/main

# If conflicts, accept theirs and regenerate
git checkout --theirs pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
git rebase --continue
```

## Resources

### Project Documentation

- [README.md](./README.md) - Project overview and usage
- [AGENTS.md](./AGENTS.md) - Comprehensive guide for AI agents
- [docs/agents/](./docs/agents/) - Implementation plans and concepts

### External Resources

- [Effect Documentation](https://effect.website) - Official Effect-TS docs
- [Effect API Reference](https://effect-ts.github.io/effect) - Full API docs
- [pnpm Workspace Guide](https://pnpm.io/workspaces) - Monorepo management
- [Changesets Documentation](https://github.com/changesets/changesets) - Version management
- [Vitest Documentation](https://vitest.dev) - Testing framework
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit format
- [Effect Discord](https://discord.gg/effect-ts) - Community support

### Community

- **Discussions:** [GitHub Discussions](https://github.com/aridyckovsky/effect-migrate/discussions)
- **Issues:** [GitHub Issues](https://github.com/aridyckovsky/effect-migrate/issues)
- **Effect Discord:** [discord.gg/effect-ts](https://discord.gg/effect-ts)

## Questions?

If you have questions or need help:

1. Check existing [Issues](https://github.com/aridyckovsky/effect-migrate/issues) and [Discussions](https://github.com/aridyckovsky/effect-migrate/discussions)
2. Review [AGENTS.md](./AGENTS.md) for detailed technical guidance
3. Ask in [Effect Discord](https://discord.gg/effect-ts) #help channel
4. Open a new Discussion for broader questions

---

**Thank you for contributing to effect-migrate!** 🎉

Your contributions help make TypeScript-to-Effect migrations easier for everyone.

````

**Content:** Full CONTRIBUTING.md as specified above.

---

### Phase 2: Update Root AGENTS.md with Git/GitHub Workflows (1 hour)

#### File: AGENTS.md

**Purpose:** Add comprehensive git/GitHub workflow rules specifically for AI agents.

**Changes:** Add new section after "Development Commands" and before "Testing":

```markdown
---

## Git and GitHub Workflows

**For Human Developers:** See [CONTRIBUTING.md](./CONTRIBUTING.md) for general contribution guidelines.

This section provides git and GitHub workflow rules specifically for AI coding agents.

### Branching Rules

**Always work on branches - NEVER push directly to `main`.**

#### Branch Naming

Use descriptive branch names following these patterns:

```bash
# New features
feature/<area>-<short-description>
feature/core-lazy-file-loading
feature/cli-json-output

# Bug fixes (ONE bug per branch/PR)
fix/<package>-<issue-description>
fix/cli-exit-code-on-error
fix/core-import-resolution-bug

# Documentation
docs/<scope>-<description>
docs/contributing-setup
docs/agents-git-workflows

# Maintenance/chores
chore/<scope>-<description>
chore/deps-update-effect
chore/ci-add-caching
````

#### Creating Branches

```bash
# Always start from latest main
git checkout main
git pull origin main

# Create and switch to new branch
git checkout -b feature/core-file-cache
```

### Commit Message Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

<optional body>

<optional footer>
```

#### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `test` - Adding/updating tests
- `refactor` - Code refactoring without behavior change
- `chore` - Maintenance, dependencies, tooling
- `ci` - CI/CD configuration changes
- `build` - Build system changes

#### Scopes

- `core` - @effect-migrate/core package
- `cli` - @effect-migrate/cli package
- `preset-basic` - @effect-migrate/preset-basic package
- Omit for repo-wide changes

#### Examples

```bash
git commit -m "feat(core): add pattern engine for async/await detection"
git commit -m "fix(cli): exit with code 1 when violations found"
git commit -m "docs: update CONTRIBUTING.md with PR process"
git commit -m "test(core): add FileDiscovery service tests"
git commit -m "chore: update effect to 3.18.5"
```

### Pre-Push Checklist

**Before pushing any branch, ALWAYS run:**

```bash
pnpm build:types
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

**Fix any errors before pushing.** Do not push broken code.

**Optional but recommended:**

```bash
# Auto-fix linting issues
pnpm lint:fix

# Run tests in watch mode during development
pnpm test --watch
```

### Pull Request Process

#### PR Title

Use Conventional Commit format:

```
feat(core): add lazy file loading for large repositories
fix(cli): handle missing config file gracefully
docs(preset-basic): document boundary rule patterns
```

#### PR Description

**REQUIRED sections:**

````markdown
## What

[Clear summary of changes]

## Why

[Reason for change, link to issue/thread]

## Scope

- `@effect-migrate/core`
- `@effect-migrate/cli`

## Changeset

- [x] Changeset added (user-facing changes)
- [ ] No changeset needed (internal only)

## Testing

```bash
pnpm build:types && pnpm typecheck && pnpm lint && pnpm build && pnpm test
```
````

Tests added/updated:

- [list test files]

## Breaking Changes

- [ ] Yes (major version)
- [x] No

## Related

- Issue: #123
- Amp Thread: https://ampcode.com/threads/T-...

## Agent Context

- Thread URL: https://ampcode.com/threads/T-...
- Scope: `packages/core/src/**`
- Key decisions: [summary]
- Commands run: [key commands]

````

#### Agent Context Section

**For AI-generated or AI-assisted PRs, ALWAYS include:**

```markdown
## Agent Context

- **Thread URL:** https://ampcode.com/threads/T-8b3e5303-5997-447c-95c9-b32c5e7c3eaa
- **Scope:** `packages/cli/src/commands/**`, `packages/core/src/services/FileDiscovery.ts`
- **Key decisions:**
  - Used Effect.gen for async operations
  - Added FileDiscovery.cache for performance
  - Chose LRU cache with 1000 entry limit
- **Commands run:**
  ```bash
  pnpm build:types
  pnpm typecheck
  pnpm lint:fix
  pnpm build
  pnpm test
  pnpm --filter @effect-migrate/core test
````

````

**Optional - Record threads to .amp/threads.json:**

```bash
effect-migrate thread add \
  --url https://ampcode.com/threads/T-8b3e5303-5997-447c-95c9-b32c5e7c3eaa \
  --tags "feature,core,file-discovery" \
  --scope "packages/core/src/services/**"

# Commit the thread file
git add .amp/threads.json
git commit -m "chore: record implementation thread"
````

### Changesets Workflow

#### When to Create Changesets

**Create a changeset (`pnpm changeset`) for:**

✅ New features in published packages  
✅ Bug fixes affecting user behavior  
✅ Performance improvements  
✅ Breaking changes  
✅ Deprecations

**Skip changeset for:**

❌ Documentation-only changes  
❌ CI/CD configuration  
❌ Internal refactors with no user impact  
❌ Test-only changes

#### Creating a Changeset

```bash
pnpm changeset
```

**Process:**

1. **Select packages** affected (use space to toggle):
   - `@effect-migrate/core`
   - `@effect-migrate/cli`
   - `@effect-migrate/preset-basic`

2. **Choose version bump:**
   - `patch` (0.0.X) - Bug fixes, small improvements
   - `minor` (0.X.0) - New features, backward-compatible
   - `major` (X.0.0) - Breaking changes

3. **Write summary** - User-facing description of change

4. **Commit changeset file:**
   ```bash
   git add .changeset/*.md
   git commit -m "chore: add changeset for file discovery cache"
   ```

#### Changeset Anti-Patterns

**❌ NEVER run `pnpm changeset version` locally**

- The GitHub Release workflow handles versioning
- It creates a "Version Packages" PR automatically
- Merging that PR publishes to npm

**❌ NEVER modify the "Version Packages" PR**

- Don't edit versions manually
- Don't change CHANGELOGs
- Don't merge it unless ready to publish

**❌ NEVER skip changesets for user-facing changes**

- Features without changesets won't be versioned/published
- Bug fixes need changesets to trigger patch releases

### Handling Multiple Parallel PRs

When working on multiple features/fixes simultaneously:

#### Avoid Conflicts

1. **Separate concerns** - Each PR should touch different files/packages when possible
2. **Keep PRs small** - Under ~300 lines of diff ideal
3. **One bug per PR** - Don't combine multiple fixes

#### Changeset Files

- Changeset files have random names - conflicts are rare
- If two PRs create same changeset filename by chance:
  ```bash
  # In one PR, regenerate
  rm .changeset/[conflicting-file].md
  pnpm changeset
  ```

#### Lockfile Conflicts

- **Avoid**: Don't install new dependencies in feature PRs
- **Isolate**: Put dependency updates in separate `chore/deps-*` PRs
- **Rebase**: Keep branches up-to-date with main

```bash
# Before final review, rebase on main
git fetch origin
git rebase origin/main

# If lockfile conflicts, accept theirs and reinstall
git checkout --theirs pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
git rebase --continue

# Rerun tests after rebase
pnpm test
```

#### Merge Order

1. Merge first PR to main
2. Rebase second PR on updated main
3. Rerun all checks
4. Update changeset summary if needed
5. Merge second PR

### AI Agent Restrictions

**DO:**
✅ Work on feature/fix branches  
✅ Run full test suite before pushing  
✅ Add changesets for user-facing changes  
✅ Include "Agent Context" in PR descriptions  
✅ Keep PRs small and focused  
✅ Rebase on main before requesting review

**DO NOT:**
❌ Push directly to main  
❌ Run `pnpm changeset version` locally  
❌ Edit package.json versions manually  
❌ Modify the "Version Packages" PR  
❌ Introduce new dependencies without explicit request  
❌ Mass-format unrelated files  
❌ Combine multiple unrelated changes in one PR  
❌ Skip tests or typecheck

### GitHub Actions and CI

#### CI Workflow (.github/workflows/ci.yml)

Runs on:

- Pushes to `main`
- Pull requests targeting `main`

**Steps:**

1. Checkout code
2. Setup Node.js (from `.node-version`)
3. Setup pnpm
4. Install dependencies
5. Build TypeScript declarations (`pnpm build:types`)
6. Type check (`pnpm typecheck`)
7. Lint (`pnpm lint`)
8. Build (`pnpm build`)
9. Test (`pnpm test:ci`)

**Your PR must pass all CI steps before merge.**

#### Release Workflow (.github/workflows/release.yml)

Runs on:

- Pushes to `main` (after PR merge)

**What it does:**

1. Builds all packages
2. Checks for pending changesets
3. Creates/updates "Version Packages" PR
4. When that PR is merged → publishes to npm with provenance

**Agents must NOT interact with this workflow or the version PR.**

### Thread Recording (Optional)

For traceability, you can record Amp threads in the repo:

```bash
# Add thread reference
effect-migrate thread add \
  --url https://ampcode.com/threads/T-... \
  --tags "feature,cli,json-output" \
  --scope "packages/cli/src/**"

# Commit thread file
git add .amp/threads.json
git commit -m "chore: record implementation thread for JSON output"
```

This creates/updates `.amp/threads.json` for future reference.

### Example Complete Workflow

```bash
# 1. Start from main
git checkout main
git pull origin main

# 2. Create branch
git checkout -b feat/cli-json-output

# 3. Make changes
# ... edit files ...

# 4. Run checks
pnpm build:types
pnpm typecheck
pnpm lint:fix
pnpm build
pnpm test

# 5. Create changeset
pnpm changeset
# Select: @effect-migrate/cli
# Bump: minor
# Summary: "Add JSON output format to audit command"

# 6. Commit changes
git add .
git commit -m "feat(cli): add JSON output formatter for audit results"

# 7. Push branch
git push origin feat/cli-json-output

# 8. Open PR on GitHub
# Use conventional commit title
# Fill out all required sections in description
# Include "Agent Context" section

# 9. Wait for CI to pass
# Address any failures

# 10. Request review
# Make any requested changes
# Rebase if main has moved

# 11. Merge via squash (maintainer will do this)
```

---

```

**Integration:** Insert this new section into AGENTS.md after the "Development Commands" section and before "Testing".

---

### Phase 3: Optional GitHub Repository Settings (30 minutes)

**Note:** These are recommendations for the repository owner to implement via GitHub UI.

#### Branch Protection Rules for `main`

1. **Navigate to:** Settings → Branches → Add rule
2. **Branch name pattern:** `main`
3. **Enable:**
   - ✅ Require a pull request before merging
   - ✅ Require approvals (1 for normal, 2 for breaking changes - configure as 1 minimum)
   - ✅ Require status checks to pass before merging
     - Add: `build` (from CI workflow)
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings
   - ✅ Restrict who can push to matching branches (optional - limit to maintainers)

4. **Merge button settings:**
   - Settings → General → Pull Requests
   - ✅ Allow squash merging
   - ❌ Disable merge commits
   - ❌ Disable rebase merging

#### CODEOWNERS (Optional)

**File:** `.github/CODEOWNERS`

```

# Package ownership for review routing

# Core package

packages/core/\*\* @aridyckovsky

# CLI package

packages/cli/\*\* @aridyckovsky

# Preset package

packages/preset-basic/\*\* @aridyckovsky

# Documentation

docs/\*_ @aridyckovsky
_.md @aridyckovsky

# CI/CD

.github/\*\* @aridyckovsky

# Root configuration

/_.json @aridyckovsky
/_.yaml @aridyckovsky
/\*.ts @aridyckovsky

```

---

## Testing Strategy

### Validation Steps

After implementing the documentation:

1. **Human Developer Test:**
   - Follow CONTRIBUTING.md from scratch in a fresh clone
   - Verify all commands work
   - Ensure setup completes successfully

2. **AI Agent Test:**
   - Ask Amp to create a small fix following AGENTS.md git workflow
   - Verify branch creation, changeset, commit, and PR process
   - Check that all restrictions are followed

3. **Documentation Review:**
   - Check all links work (internal and external)
   - Verify code examples are accurate
   - Ensure consistency between CONTRIBUTING.md and AGENTS.md

4. **Process Test:**
   - Create a test PR following the documented process
   - Verify CI runs correctly
   - Check PR template coverage

---

## Success Criteria

- [x] CONTRIBUTING.md created with comprehensive developer guide
- [x] AGENTS.md updated with Git/GitHub workflow section
- [ ] All code examples in docs are accurate and tested
- [ ] All internal links between docs work correctly
- [ ] Human developers can follow CONTRIBUTING.md to contribute
- [ ] AI agents can follow AGENTS.md git workflows without errors
- [ ] Branch naming conventions are clear and documented
- [ ] PR process is well-defined with templates and checklists
- [ ] Changeset workflow is explained thoroughly
- [ ] Testing requirements are explicit and actionable
- [ ] Multiple parallel PR workflow is documented
- [ ] AI agent restrictions are clear and enforceable

---

## Files Summary

**New files:**

- `CONTRIBUTING.md` (~500 lines) - Human developer guide
- `.github/CODEOWNERS` (~20 lines, optional) - Review routing

**Modified files:**

- `AGENTS.md` - Add "Git and GitHub Workflows" section (~350 lines)
- `docs/agents/AGENTS.md` - Update "Integration with Root AGENTS.md" to reference contributing docs

**Optional (future):**

- `.github/workflows/changeset-check.yml` - CI check for missing changesets
- `.github/PULL_REQUEST_TEMPLATE.md` - PR description template

---

## Integration Points

### With Existing Documentation

- CONTRIBUTING.md references AGENTS.md for Effect-TS patterns
- AGENTS.md references CONTRIBUTING.md for general workflow
- docs/agents/AGENTS.md links to both root-level docs
- README.md should link to CONTRIBUTING.md in "Contributing" section

### With CI/CD

- Documented workflows match .github/workflows/ci.yml steps
- Release workflow behavior is accurately described
- Changeset process aligns with .github/workflows/release.yml

### With Development Tools

- Commands reference package.json scripts
- pnpm workspace patterns match actual configuration
- Testing commands use Vitest as configured

---

## Follow-Up Work

After implementing this plan:

1. **Bug Fix PRs:** Can now proceed with individual bug fixes following the documented workflow (per thread T-e20aa8e6-d2d0-431c-a091-2fa128684617)

2. **PR Template:** Consider adding `.github/PULL_REQUEST_TEMPLATE.md` to auto-populate PR descriptions

3. **Issue Templates:** Add `.github/ISSUE_TEMPLATE/` for bug reports and feature requests

4. **Changeset Automation:** Add CI check to warn when package changes lack changesets

5. **CODEOWNERS:** Expand as team grows to distribute review load

---

## References

- Oracle recommendations for branching strategy and PR conventions
- Librarian research on CONTRIBUTING.md best practices from:
  - farcasterxyz/hub-monorepo
  - opral/monorepo
  - Effect-TS/effect
  - pnpm/pnpm
  - belgattitude/nextjs-monorepo-example
- Current .github/workflows/ci.yml and release.yml
- Existing AGENTS.md Effect-TS patterns
- Thread T-e20aa8e6-d2d0-431c-a091-2fa128684617 (bug fixes as separate PRs)
```
