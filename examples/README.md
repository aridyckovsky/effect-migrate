# effect-migrate Examples

This directory contains example projects demonstrating effect-migrate in action.

## Examples

### `file-processor/` - Legacy File Processing

A TypeScript project with heavy async/await, Promise-based patterns, and imperative error handling. Perfect for demonstrating a full migration audit.

**Patterns detected:**
- 15 async/await functions
- 14 try/catch blocks  
- 8 console.* calls
- 5 Promise.then chains
- 3 Promise.all calls
- 3 new Promise constructors

### `legacy-api/` - Database & API Layer

Example with database connections, REST API handlers, and nested error handling.

### `mid-migration/` - Partial Migration

Shows a project in the middle of migrating to Effect, with some files migrated and others not.

### `ecommerce-orders/` - E-Commerce Order Processing (Amp Optimized)

E-commerce order processing system in partial Effect migration. Demonstrates:
- Mixed Effect and Promise-based patterns
- Callback hell in legacy code
- Architectural boundary violations
- Amp context generation with `--amp-out`

### `clean-effect/` - Migrated Code

Already migrated to Effect patterns - shows zero violations and success state.

## Quick Start

Build the CLI first:
```bash
pnpm --filter @effect-migrate/cli build
```

Then navigate to any example and run:
```bash
node ../../packages/cli/dist/index.js audit
node ../../packages/cli/dist/index.js metrics
```

---

## Creating New Examples

### Step 1: Setup Directory Structure

```bash
mkdir -p examples/my-example/src/{services,repositories,controllers}
mkdir -p examples/my-example/.amp
```

### Step 2: Create Config File

Create `effect-migrate.config.json` (or `.ts`) with **all required fields**:

```json
{
  "version": 1,
  "paths": {
    "root": "./src",
    "exclude": ["node_modules/**", "dist/**"]
  },
  "patterns": [
    {
      "id": "my-pattern-rule",
      "files": "**/*.ts",          // ⚠️ REQUIRED - don't forget this!
      "pattern": "some-regex",
      "severity": "warning",        // Must be "error" or "warning"
      "message": "Description of the issue",
      "tags": ["category", "type"]  // Optional but recommended
    }
  ]
}
```

**⚠️ Common Mistakes:**
- Missing `files` field in pattern rules
- Invalid `severity` (must be `"error"` or `"warning"`)
- Forgetting to escape regex special characters (use `\\` not `\`)
- Using `.config.ts` extension but not having TypeScript config export

### Step 3: Create Source Files

Create TypeScript files that demonstrate the patterns you want to detect:

```typescript
// src/example.ts - Shows anti-pattern
async function oldWay() {
  try {
    const result = await somePromise()
    return result
  } catch (error) {
    throw new Error(`Failed: ${error}`)
  }
}

// src/migrated.ts - Shows Effect pattern  
const newWay = Effect.gen(function* () {
  const result = yield* Effect.tryPromise(() => somePromise())
  return result
})
```

### Step 4: Add package.json (Optional)

```json
{
  "name": "my-example",
  "type": "module",
  "description": "Example showing X pattern migration"
}
```

### Step 5: Test Without Amp Output

```bash
cd examples/my-example

# Test config loads correctly
node ../../packages/cli/dist/index.js audit --config effect-migrate.config.json

# Check metrics calculation
node ../../packages/cli/dist/index.js metrics --config effect-migrate.config.json
```

**Expected output:**
- ✓ Loaded config from...
- Running N rules...
- Findings displayed

**Common errors:**
- `Config validation failed: ["patterns"][0]["files"] is missing` → Add `files` field
- `Received unknown argument` → Check flag spelling (`--amp-out` not `--amp-output`)

### Step 6: Test With Amp Output

```bash
# Generate Amp context files
node ../../packages/cli/dist/index.js audit --config effect-migrate.config.json --amp-out .amp

# Generate metrics for Amp
node ../../packages/cli/dist/index.js metrics --config effect-migrate.config.json --amp-out .amp
```

**Expected output:**
- ✓ audit.json
- ✓ index.json  
- ✓ badges.md
- ✓ metrics.json (from metrics command)
- ✓ Wrote Amp context to .amp

**Verify generated files:**
```bash
ls .amp/
# Should show: audit.json  badges.md  index.json  metrics.json
```

### Step 7: Document Your Example

Create `README.md` in your example:

```markdown
# My Example - Description

## Project Status

**Migration Progress:** ~X% complete

## Known Issues

1. Issue category 1
2. Issue category 2

## Using effect-migrate

\`\`\`bash
effect-migrate audit
effect-migrate metrics

# For Amp users
effect-migrate audit --amp-out .amp
\`\`\`

## For Amp Users

The `.amp/` directory contains migration context that helps Amp understand:
- Current migration state (audit.json)
- Quantitative metrics (metrics.json)
- Quick reference badges (badges.md)
```

### Step 8: Validate Schema

Double-check your config against the schema:

**Pattern Rule Required Fields:**
- ✅ `id` (string)
- ✅ `files` (string or array of strings)
- ✅ `pattern` (string or regex object)
- ✅ `severity` ("error" | "warning")
- ✅ `message` (string)

**Pattern Rule Optional Fields:**
- `negativePattern` (string) - exclude matches
- `docsUrl` (string) - link to docs
- `tags` (array of strings) - categorization

**Boundary Rule Required Fields:**
- ✅ `id` (string)
- ✅ `from` (string glob)
- ✅ `disallow` (array of strings)
- ✅ `severity` ("error" | "warning")
- ✅ `message` (string)

### Debugging Tips

**Config won't load:**
```bash
# Test just the config
cat effect-migrate.config.json | jq
# Should parse as valid JSON
```

**Pattern not matching:**
```bash
# Add --log-level debug for verbose output
node ../../packages/cli/dist/index.js audit --log-level debug
```

**Amp output not generating:**
```bash
# Check permissions
mkdir -p .amp
chmod 755 .amp

# Verify path
node ../../packages/cli/dist/index.js audit --amp-out .amp
# NOT: --amp-out (without directory)
```

---

## Testing All Examples

From the root:

```bash
# Build CLI
pnpm --filter @effect-migrate/cli build

# Test all examples
for dir in examples/*/; do
  if [ -f "$dir/effect-migrate.config.json" ] || [ -f "$dir/effect-migrate.config.ts" ]; then
    echo "Testing: $dir"
    cd "$dir"
    node ../../packages/cli/dist/index.js audit
    cd ../..
  fi
done
```
