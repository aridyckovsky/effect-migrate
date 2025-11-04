# Mid-Migration Example

This example demonstrates a project **in the middle of migration** to Effect patterns. It contains:

## File Status

### ❌ Not Migrated (Legacy)
- **`legacy-database.ts`** - Database operations with try/catch, manual connection cleanup
  - 3 async functions with try/catch
  - 6 console.error calls
  - Manual resource management

### ✅ Fully Migrated
- **`migrated-file-reader.ts`** - File operations using Effect patterns
  - Effect.gen instead of async/await
  - Effect.forEach with concurrency instead of Promise.all
  - Effect.acquireRelease for resource safety
  - Tagged errors instead of throw

### 🔄 Mixed (Partially Migrated)
- **`mixed-api-handler.ts`** - API handlers in transition
  - 2 legacy async/await functions
  - 2 migrated Effect functions
  - Shows side-by-side comparison

## Expected Audit Results

**Patterns to detect:**
- 6 async/await functions (in legacy files)
- 5 try/catch blocks
- 7 console.* calls
- 1 Promise.all usage
- 0 new Promise constructors

**Migration Progress:** ~40% complete

## Running Commands

```bash
# Install dependencies (links workspace packages)
pnpm install

# Run audit using TypeScript config
pnpm audit

# Or with JSON output
pnpm audit:json

# Or directly via CLI
node ../../packages/cli/build/esm/index.js audit --config effect-migrate.config.ts
```

## Configuration

This example uses **TypeScript config** (`effect-migrate.config.ts`) for type safety:

```typescript
import { defineConfig } from "@effect-migrate/core"

export default defineConfig({
  version: 1,
  paths: {
    root: "./src",
    exclude: ["node_modules/**", "dist/**"]
  },
  patterns: [...]
})
```

The `defineConfig` helper provides TypeScript autocomplete and validation.

## What to Observe

The Amp output should:
1. Show summary metrics (total violations, by severity)
2. List files needing migration with specific line numbers
3. Group violations by pattern type
4. Provide actionable migration suggestions
5. Format for AI coding agent consumption
