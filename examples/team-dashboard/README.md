# Team Dashboard - Partial Effect Migration

A team dashboard API that's **~40% migrated** to Effect patterns. This example demonstrates a realistic migration scenario for teams using Amp as their coding agent.

## Project Status

**Migration Progress:** ~40% complete

### ✅ Migrated to Effect
- `services/users.ts` - User service with Effect.gen and proper error handling
- `services/tasks.ts` - Task service with Schema validation
- `controllers/user-controller.ts` - Clean Effect-based controller using services

### ⚠️ Legacy Code (Not Yet Migrated)
- `repositories/database.ts` - async/await, try/catch, console logging
- `services/auth.ts` - new Promise constructors, callback-based JWT
- `controllers/auth-controller.ts` - async/await + **architectural boundary violation**

## Known Issues

Based on effect-migrate audit:

1. **15+ async/await patterns** - Should be migrated to Effect.gen
2. **8+ try/catch blocks** - Should use Effect error handling
3. **10+ console.* calls** - Should use Effect Console service
4. **3 new Promise constructors** - Should use Effect.async or Effect.tryPromise
5. **2 .then() chains** - Should use Effect combinators
6. **1 boundary violation** - Controller importing repository directly

## Using effect-migrate

### Standard Audit

```bash
# From this directory
node ../../packages/cli/dist/index.js audit

# Or if globally installed
effect-migrate audit
```

### Metrics Report

```bash
node ../../packages/cli/dist/index.js metrics
```

### For Amp Users

Generate migration context for Amp to understand your codebase:

```bash
# Generate .amp context files
node ../../packages/cli/dist/index.js audit --amp-out .amp
node ../../packages/cli/dist/index.js metrics --amp-out .amp

# Or use package scripts
npm run audit:amp
npm run metrics:amp
```

## For Amp Users: What's in .amp/

The `.amp/` directory contains structured migration context that helps Amp:

- **audit.json** - Complete list of patterns to migrate with file locations
- **metrics.json** - Quantitative metrics (files analyzed, violations found, severity breakdown)
- **index.json** - MCP-compatible index of all context files
- **badges.md** - Quick visual reference of migration state

When Amp reads these files, it can:
- Understand which files still need migration
- Suggest idiomatic Effect patterns for specific violations
- Track migration progress as you work
- Maintain consistency with already-migrated code

## Migration Guide

### Priority Order (Recommended)

1. **Fix boundary violation** in `controllers/auth-controller.ts` first
2. **Migrate auth service** - Complex async patterns, good learning example
3. **Migrate database layer** - Foundation for other services
4. **Update auth controller** - Complete the auth flow migration

### Example: Migrating auth.ts

See `services/users.ts` for the Effect pattern:

```typescript
// Before (legacy)
export async function authenticate(username: string, password: string): Promise<string> {
  try {
    const user = await new Promise((resolve, reject) => {
      // ...
    })
    console.log('User authenticated:', username)
    return jwt.sign({ user }, SECRET)
  } catch (error) {
    console.error('Authentication failed:', error)
    throw error
  }
}

// After (Effect)
export const authenticate = (username: string, password: string) =>
  Effect.gen(function* () {
    const user = yield* Effect.async<User, AuthError>((resume) => {
      // ...
    })
    yield* Console.log('User authenticated:', username)
    return yield* signToken(user)
  })
```

## Amp Best Practices

When working with Amp on this migration:

1. **Share context**: Run `effect-migrate audit --amp-out .amp` before starting work
2. **Focus on one service**: Migrate one file completely rather than partial changes
3. **Reference migrated code**: Point Amp to `services/users.ts` as a pattern
4. **Update .amp context**: Re-run audit after completing each file
5. **Track progress**: Use metrics command to see % improvement

---

**Tech Stack:**
- TypeScript + Node.js
- PostgreSQL (simulated in database.ts)
- JWT authentication
- Effect-TS (partial migration)
