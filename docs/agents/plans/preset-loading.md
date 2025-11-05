---
created: 2025-11-05
lastUpdated: 2025-11-05
author: Generated via Amp (Oracle + AI analysis)
status: complete
thread: https://ampcode.com/threads/T-6d1b44b5-1e73-4465-9d49-9761d3555b66
audience: AI coding agents and migration developers
tags: [feature, preset-loading, cli, preset-basic, core]
---

# First-Class Preset Support Implementation Plan

**Oracle Recommendation:** Post-0.2.0 next feature priority

**Estimated Effort:** 1-2 days (L) coding + testing

---

## Goal

Implement first-class preset support in effect-migrate to provide users with out-of-the-box, opinionated migration guidance. Currently, `config.presets` exists in the schema but isn't loaded or used by the CLI.

## Success Criteria

1. ✅ CLI loads and merges rules from configured presets
2. ✅ `@effect-migrate/preset-basic` ships with complete boundary and pattern rules
3. ✅ `audit` and `metrics` commands use preset rules + user-defined rules
4. ✅ Config defaults from presets can be overridden by user config
5. ✅ Clear error handling when presets fail to load
6. ✅ Tests cover preset loading, merging, and rule execution

## Architecture

### Current State

- **Config Schema:** Already includes `presets?: string[]` field
- **Preset Type:** Defined in `packages/core/src/types.ts`
- **preset-basic Package:** Exists with pattern rules, but boundary rules are TODOs
- **CLI Commands:** Don't currently load or use presets

### Proposed Changes

#### 1. Preset Loading (CLI)

**File:** `packages/cli/src/loaders/presets.ts` (new)

```typescript
import { Effect, Array } from "effect"
import type { Preset, Rule } from "@effect-migrate/core"
import { Data } from "effect"

class PresetLoadError extends Data.TaggedError("PresetLoadError")<{
  readonly preset: string
  readonly message: string
}> {}

interface LoadPresetsResult {
  readonly rules: ReadonlyArray<Rule>
  readonly defaults: Record<string, unknown>
}

export const loadPresets = (
  names: ReadonlyArray<string>
): Effect.Effect<LoadPresetsResult, PresetLoadError> =>
  Effect.gen(function* () {
    const presets = yield* Effect.forEach(
      names,
      (name) => loadPreset(name),
      { concurrency: 1 }
    )
    
    return {
      rules: Array.flatten(presets.map(p => p.rules)),
      defaults: mergeDefaults(presets.map(p => p.defaults ?? {}))
    }
  })

const loadPreset = (name: string): Effect.Effect<Preset, PresetLoadError> =>
  Effect.gen(function* () {
    const module = yield* Effect.tryPromise({
      try: () => import(name),
      catch: (error) => new PresetLoadError({
        preset: name,
        message: `Failed to import: ${String(error)}`
      })
    })
    
    // Handle default export or named preset export
    const preset = module.default ?? module.preset
    
    if (!isValidPreset(preset)) {
      yield* Effect.fail(new PresetLoadError({
        preset: name,
        message: "Invalid preset shape"
      }))
    }
    
    return preset
  })
```

#### 2. Command Integration

**Files:** `packages/cli/src/commands/audit.ts`, `packages/cli/src/commands/metrics.ts`

Add preset loading before rule construction:

```typescript
Effect.gen(function* () {
  const config = yield* loadConfig(configPath)
  
  // Load presets if configured
  let allRules: Rule[] = []
  let effectiveConfig = config
  
  if (config.presets && config.presets.length > 0) {
    const { rules: presetRules, defaults } = yield* loadPresets(config.presets).pipe(
      Effect.catchTag("PresetLoadError", (error) =>
        Effect.gen(function* () {
          yield* Console.warn(`Failed to load preset ${error.preset}: ${error.message}`)
          return { rules: [], defaults: {} }
        })
      )
    )
    
    yield* Console.log(`Loaded ${config.presets.length} preset(s)`)
    
    effectiveConfig = mergeConfig(defaults, config) // User config wins
    allRules = [...presetRules]
  }
  
  // Add user-defined pattern and boundary rules
  const userRules = yield* constructRulesFromConfig(effectiveConfig)
  allRules = [...allRules, ...userRules]
  
  // Run audit with combined rules
  const results = yield* runAudit(allRules, effectiveConfig)
  // ...
})
```

#### 3. Complete preset-basic

**File:** `packages/preset-basic/src/boundaries.ts`

Implement boundary rules using `makeBoundaryRule`:

```typescript
import { makeBoundaryRule } from "@effect-migrate/core"

export const noNodeInServices = makeBoundaryRule({
  id: "no-node-in-services",
  description: "Services should use @effect/platform abstractions instead of Node.js built-ins",
  severity: "error",
  from: "src/services/**/*.ts",
  disallow: ["node:*"],
  message: "Don't import Node.js built-ins in service layer. Use @effect/platform instead.",
  docsUrl: "https://effect.website/docs/platform/overview"
})

export const noPlatformNodeInCore = makeBoundaryRule({
  id: "no-platform-node-in-core",
  description: "Core logic should be platform-agnostic",
  severity: "error",
  from: "src/core/**/*.ts",
  disallow: ["@effect/platform-node*"],
  message: "Core modules should use @effect/platform, not @effect/platform-node"
})

export const noBarrelImportsEffect = makeBoundaryRule({
  id: "no-barrel-imports-effect",
  description: "Import from specific Effect modules for better tree-shaking",
  severity: "warning",
  from: "**/*.ts",
  disallow: [], // Handled by pattern rule instead
  message: "Import from 'effect/Effect', 'effect/Console', etc. instead of 'effect'"
})
```

**File:** `packages/preset-basic/src/patterns.ts`

Add additional pattern rules:

```typescript
export const noTryCatch = makePatternRule({
  id: "no-try-catch",
  description: "Avoid try/catch in Effect code - use Effect.catchAll instead",
  severity: "warning",
  pattern: /\btry\s*\{[\s\S]*?\}\s*catch/,
  message: "Use Effect.catchAll() or Effect.catchTag() instead of try/catch",
  filePatterns: ["**/*.ts"],
  tags: ["effect", "error-handling"]
})

export const noNewPromise = makePatternRule({
  id: "no-new-promise",
  description: "Avoid creating raw Promises - use Effect instead",
  severity: "warning",
  pattern: /\bnew\s+Promise\s*</,
  message: "Use Effect.async() or Effect.promise() instead of new Promise()",
  tags: ["effect", "async"]
})

export const noBarrelImport = makePatternRule({
  id: "no-barrel-import-effect",
  description: "Import from specific Effect modules",
  severity: "warning",
  pattern: /import\s+\{[^}]+\}\s+from\s+['"]effect['"]/,
  message: "Import from 'effect/Effect', 'effect/Console', etc. for tree-shaking",
  tags: ["effect", "imports"]
})

export const noFsPromises = makePatternRule({
  id: "no-fs-promises",
  description: "Use @effect/platform FileSystem instead of fs/promises",
  severity: "warning",
  pattern: /from\s+['"]fs\/promises['"]/,
  message: "Use @effect/platform FileSystem service instead of fs/promises",
  tags: ["platform", "filesystem"]
})
```

**File:** `packages/preset-basic/src/index.ts`

Export complete preset:

```typescript
import type { Preset } from "@effect-migrate/core"
import * as patterns from "./patterns.js"
import * as boundaries from "./boundaries.js"

export const preset: Preset = {
  rules: [
    // Pattern rules
    patterns.noAsyncAwait,
    patterns.noTryCatch,
    patterns.noNewPromise,
    patterns.noBarrelImport,
    patterns.noFsPromises,
    
    // Boundary rules
    boundaries.noNodeInServices,
    boundaries.noPlatformNodeInCore
  ],
  defaults: {
    paths: {
      root: process.cwd(),
      exclude: ["node_modules/**", "dist/**", "build/**", ".git/**"]
    },
    report: {
      format: "console",
      groupBy: "severity"
    }
  }
}

export default preset
```

#### 4. Config Merging

**File:** `packages/cli/src/loaders/config.ts` (update)

```typescript
export const mergeConfig = (
  defaults: Record<string, unknown>,
  userConfig: Config
): Config => {
  return {
    ...userConfig,
    paths: {
      ...defaults.paths,
      ...userConfig.paths
    },
    report: {
      ...defaults.report,
      ...userConfig.report
    }
    // User config always wins for top-level fields
  }
}
```

## Testing Strategy

### Unit Tests

1. **Preset Loading** (`packages/cli/src/__tests__/loaders/presets.test.ts`)
   - Load valid preset (default export)
   - Load valid preset (named export)
   - Handle missing preset module
   - Handle invalid preset shape
   - Merge multiple presets

2. **Config Merging** (`packages/cli/src/__tests__/loaders/config.test.ts`)
   - User config overrides preset defaults
   - Deep merge for nested objects
   - Empty presets array

3. **Preset Rules** (`packages/preset-basic/src/__tests__/`)
   - Each boundary rule against fixtures
   - Each pattern rule against fixtures
   - Ensure no false positives

### Integration Tests

1. **End-to-End Audit** (`packages/cli/src/__tests__/integration/audit-with-preset.test.ts`)
   - Run audit with preset-basic
   - Verify preset rules execute
   - Verify user rules also execute
   - Verify config merging

## Implementation Order

1. ✅ Create plan document (this file)
2. ✅ Create `loadPresets` helper in CLI
3. ✅ Wire preset loading into `audit` command
4. ✅ Wire preset loading into `metrics` command
5. ✅ Implement boundary rules in preset-basic
6. ✅ Add additional pattern rules to preset-basic
7. ✅ Write unit tests for preset loading
8. ✅ Write unit tests for preset-basic rules
9. ✅ Write integration test for audit with preset
10. ✅ Update README with preset usage examples
11. ✅ Update init template to document preset support

## Migration Path

**User Impact:** None breaking. Config already supports `presets` field.

**Before:**
```typescript
// effect-migrate.config.ts
export default {
  version: 1,
  presets: ["@effect-migrate/preset-basic"], // Currently ignored
  patterns: [/* user rules */]
}
```

**After:**
```typescript
// effect-migrate.config.ts (same, but now works!)
export default {
  version: 1,
  presets: ["@effect-migrate/preset-basic"], // Now loaded and merged
  patterns: [/* user rules */]
}
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Dynamic import fails (ESM/CJS mismatch) | Require ESM presets; provide clear error messages |
| Preset config merge conflicts | User config always wins; document precedence |
| Too many false positives from preset rules | Use conservative severities; support negativePattern; document @effect-migrate-ignore |
| Performance with many preset rules | Already using concurrent processing; monitor metrics |

## Documentation Updates

1. **README.md:** Add section on using presets
2. **packages/cli/README.md:** Document preset loading behavior
3. **packages/preset-basic/README.md:** List all rules with examples
4. **Config schema docs:** Document preset defaults merging

## Future Enhancements (Out of Scope)

- Custom preset creation guide
- Preset versioning/compatibility checks
- Preset composition (preset extends another preset)
- Community preset registry

---

**Next Steps:** Create feature branch and start implementation with preset loading helper.
