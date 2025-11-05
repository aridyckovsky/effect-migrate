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

- **`feat/<area>-<description>`** - New features
  - Example: `feat/core-file-discovery-cache`
  - Example: `feat/cli-json-formatter`

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
git checkout -b feat/core-lazy-loading
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

- `packages/core/src/__tests__/new-feature.test.ts`
- Updated existing tests in `packages/cli/src/__tests__/audit.test.ts`

## Checklist

- [ ] Code follows Effect-TS best practices:
  - Used Effect.gen for sequential operations
  - Defined errors with Data.TaggedError
  - Managed resources with acquireRelease; used Effect.scoped where appropriate
  - See [AGENTS.md](./AGENTS.md#effect-ts-best-practices) for details
- [ ] TypeScript strict mode passes (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)
- [ ] Linter passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Changeset created (if needed)
- [ ] Documentation updated (if needed)

## Agent Context (optional, for AI agents)
<!-- This section helps AI agents understand implementation decisions, trade-offs, and context. Human contributors can skip. -->

**Implementation approach:**

- Brief summary of how you implemented the feature
- Key design decisions
- Effect patterns used

**Amp Thread(s):**

- https://ampcode.com/threads/T-[uuid]

**Related docs:**

- @docs/agents/plans/feature-name.md (if applicable)

````

### Review Process

1. **Automated checks must pass:**
   - CI build
   - Type checking
   - Linting
   - All tests

2. **Code review:**
   - At least 1 approval required
   - Address all comments
   - Keep PR focused and small

3. **Merge:**
   - Maintainers will squash-merge into `main`
   - PR title becomes commit message
   - Branch will be automatically deleted

## Testing Requirements

### Before Submitting PR

**Always run:**

```bash
# 1. Type checking
pnpm build:types
pnpm typecheck

# 2. Linting
pnpm lint

# 3. Build
pnpm build

# 4. Tests
pnpm test
````

### Test Coverage

- **Unit tests** for business logic (Effect.gen functions, helpers)
- **Integration tests** for CLI commands and workflows
- **Schema tests** for validation logic

### Writing Tests

Use `@effect/vitest`:

```typescript
import { expect, it } from "@effect/vitest"
import { Effect } from "effect"

it.effect("should process data correctly", () =>
  Effect.gen(function* () {
    const result = yield* processData({ input: "test" })
    expect(result.output).toBe("processed: test")
  })
)
```

See [AGENTS.md Testing section](./AGENTS.md#testing) for Effect-specific patterns.

## Working with Changesets

### What are Changesets?

Changesets track version bumps and generate CHANGELOGs. Every user-facing change needs a changeset.

### When to Create a Changeset

**Create changeset for:**

- ✅ New features
- ✅ Bug fixes
- ✅ Breaking changes
- ✅ Dependency updates affecting users

**Skip changeset for:**

- ❌ Internal refactors (no behavior change)
- ❌ Test-only changes
- ❌ Documentation updates
- ❌ Dev dependency updates

### How to Create a Changeset

```bash
pnpm changeset
```

**Interactive prompts:**

1. **Which packages changed?**
   - Select affected packages (space to toggle, enter to confirm)

2. **What type of change?**
   - `major` - Breaking change (e.g., API removal)
   - `minor` - New feature (backward compatible)
   - `patch` - Bug fix

3. **Summary:**
   - Describe the change from user perspective
   - Will appear in CHANGELOG

**Example:**

```bash
$ pnpm changeset
🦋  Which packages would you like to include?
● @effect-migrate/cli

🦋  Which packages should have a major bump?
◯ (none selected)

🦋  Which packages should have a minor bump?
● @effect-migrate/cli

🦋  Please enter a summary for this change:
Add JSON output format to audit command

✅ Changeset added! - commit it:
.changeset/lazy-dogs-fly.md
```

### Committing Changesets

```bash
# Changeset file is created
git add .changeset/*.md
git commit -m "chore: add changeset for JSON formatter"

# Include in your PR
git push
```

### Publishing (Maintainers Only)

1. Changesets accumulate in `.changeset/` directory
2. GitHub workflow creates "Version Packages" PR
3. Merging that PR triggers npm publish

**Never run `pnpm changeset version` locally** - let CI handle it.

## Code Standards

### Effect-TS Patterns

Follow patterns in [AGENTS.md](./AGENTS.md):

- Use `Effect.gen` for sequential operations
- Use `pipe` for functional composition
- Define errors with `Data.TaggedError`
- Use `acquireRelease` for resources
- Build services with `Context.Tag` and `Layer`
- Validate data with `Schema`

### TypeScript Rules

- **Strict mode enabled** - No `any`, no implicit returns
- **exactOptionalPropertyTypes** - Handle optional props carefully
- **Import from specific modules** - Not barrel exports

```typescript
// ❌ BAD - Barrel import
import { Console, Effect } from "effect"

// ✅ GOOD - Specific modules
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
```

### File Organization

- **Services:** `packages/*/src/services/`
- **Tests:** `packages/*/src/__tests__/` or co-located `*.test.ts`
- **Types:** `packages/*/src/types.ts` or domain-specific files
- **Schema:** `packages/*/src/schema/`

### Naming Conventions

- **Files:** kebab-case (`file-discovery.ts`)
- **Services:** PascalCase (`FileDiscovery`)
- **Functions:** camelCase (`listFiles`)
- **Constants:** UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)

## Troubleshooting

### Build Errors

**"Cannot find module '@effect-migrate/core'"**

```bash
# Build dependencies first
pnpm --filter @effect-migrate/core build
pnpm --filter @effect-migrate/cli... build
```

**Type errors after pulling changes**

```bash
# Rebuild type definitions
pnpm build:types
```

### Test Failures

**Tests pass locally but fail in CI**

- Check Node.js version matches (see `.node-version`)
- Run `pnpm install` to sync dependencies
- Run tests with same command as CI: `pnpm test`

### Changeset Issues

**"No changeset found"**

- Add changeset: `pnpm changeset`
- Commit `.changeset/*.md` file
- Or add comment in PR if truly not needed

### Workspace Issues

**pnpm commands not finding packages**

```bash
# Verify workspace setup
pnpm -r list

# Reinstall dependencies
rm -rf node_modules packages/*/node_modules
pnpm install
```

## Resources

### Documentation

- [Effect-TS Website](https://effect.website) - Official docs
- [Effect API Reference](https://effect-ts.github.io/effect) - API docs
- [pnpm Workspaces](https://pnpm.io/workspaces) - Monorepo guide
- [Changesets](https://github.com/changesets/changesets) - Version management

### Internal Guides

- [AGENTS.md](./AGENTS.md) - Effect patterns and anti-patterns
- [packages/core/AGENTS.md](./packages/core/AGENTS.md) - Core package specifics
- [packages/cli/AGENTS.md](./packages/cli/AGENTS.md) - CLI package specifics
- [docs/agents/](./docs/agents/) - Implementation plans and concepts

### Community

- [Effect Discord](https://discord.gg/effect-ts) - Get help and discuss
- [GitHub Issues](https://github.com/aridyckovsky/effect-migrate/issues) - Report bugs
- [GitHub Discussions](https://github.com/aridyckovsky/effect-migrate/discussions) - Feature requests

---

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues/discussions first

Thank you for contributing to effect-migrate! 🚀
