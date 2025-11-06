# Examples

This directory contains standalone example projects showing how to use `effect-migrate` in different scenarios.

## Quick Start

Each example is a standalone project with its own `package.json` and TypeScript configuration:

```bash
# 1. Navigate to an example
cd examples/mid-migration

# 2. Install dependencies (creates local node_modules with symlinks to workspace packages)
pnpm install

# 3. Run the audit
pnpm run effect-migrate:audit

# Or get JSON output
pnpm run effect-migrate:audit:json

# Or use the CLI directly (after install)
pnpm effect-migrate audit

# Or with a custom config
pnpm effect-migrate audit --config custom-config.ts
```

## Configuration Files

Examples demonstrate using **TypeScript config files** (`.ts`) with type safety:

```typescript
// effect-migrate.config.ts
import { defineConfig } from "@effect-migrate/core"

export default defineConfig({
  version: 1,
  paths: {
    root: "./src",
    exclude: ["node_modules/**", "dist/**", "test/**"]
  },
  patterns: [
    {
      id: "async-await-usage",
      files: "**/*.ts",
      pattern: "async\\s+function|async\\s*\\(",
      message: "Consider migrating async/await to Effect.gen",
      severity: "warning",
      tags: ["async", "migration"]
    }
  ]
})
```

The `defineConfig` helper provides:
- ✅ TypeScript autocomplete
- ✅ Type checking for configuration
- ✅ Better error messages

## Available Examples

- **`mid-migration/`** - Project in the middle of migrating to Effect
- **`legacy-api/`** - Legacy API with async/await patterns to migrate
- **`file-processor/`** - File processing with mixed patterns
- **`team-dashboard/`** - Dashboard with authentication and database code
- **`clean-effect/`** - Fully migrated Effect-based project (zero violations)

## How Examples Work

Examples use `workspace:*` dependencies which automatically resolve to the local packages during `pnpm install`:

```json
{
  "dependencies": {
    "@effect-migrate/core": "workspace:*",
    "@effect-migrate/cli": "workspace:*"
  }
}
```

**Note:** Examples are not listed in `pnpm-workspace.yaml` to keep them standalone, but pnpm still resolves `workspace:*` dependencies from the monorepo root. This allows examples to consume local packages during development while remaining independent projects that don't participate in workspace-wide commands.

When published to npm, these would resolve to actual versions like `"^0.1.0"`.
