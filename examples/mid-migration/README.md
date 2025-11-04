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

Build the CLI first:
```bash
cd ../..
pnpm --filter @effect-migrate/cli build
```

Then from this directory:

```bash
# Standard audit
node ../../packages/cli/dist/index.js audit

# Audit with Amp context output
node ../../packages/cli/dist/index.js audit --amp

# Metrics summary
node ../../packages/cli/dist/index.js metrics

# Metrics with Amp context
node ../../packages/cli/dist/index.js metrics --amp
```

## What to Observe

The Amp output should:
1. Show summary metrics (total violations, by severity)
2. List files needing migration with specific line numbers
3. Group violations by pattern type
4. Provide actionable migration suggestions
5. Format for AI coding agent consumption
