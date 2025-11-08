---
created: 2025-11-07
lastUpdated: 2025-11-07
author: Amp
status: in-progress
thread: https://ampcode.com/threads/T-bfa88dd3-c229-49b8-93f4-86cf48b84dd1
audience: ai-agents
tags: [refactoring, migration, architecture, effect-patterns]
---

# Loaders to Core Migration Plan

## Overview

Migrate loader logic from `@packages/cli/src/loaders` to `@packages/core` to eliminate code duplication, establish proper separation of concerns, and enforce Effect-first patterns throughout the codebase.

## Problems Identified

1. **Duplication**: `deepMerge` and `isPlainObject` duplicated in `config.ts` and `presets.ts`
2. **Wrong Layer**: Config merging, preset loading, and rule construction are domain logic but live in CLI
3. **Anti-patterns**: Logging in loaders, `process.cwd()` in business logic, no service abstraction for preset loading
4. **Dependency Chain**: Core should provide services; CLI should consume them

## Migration Strategy

### Phase 1: Merge Utilities (PR #1)

**Goal**: Move shared utilities to core and eliminate duplication

**Changes**:
- Create `packages/core/src/utils/merge.ts`
  - Export `deepMerge(target, source)`
  - Export `isPlainObject(value)`
- Create `packages/core/src/config/merge.ts`
  - Export `mergeConfig(defaults, userConfig)`
- Update `packages/cli/src/loaders/config.ts` to import from core
- Delete duplicated utilities from CLI loaders

**Files**:
- ✅ New: `packages/core/src/utils/merge.ts`
- ✅ New: `packages/core/src/config/merge.ts`
- ✅ Modified: `packages/core/src/index.ts` (exports)
- ✅ Modified: `packages/cli/src/loaders/config.ts` (use core)
- ✅ Modified: `packages/cli/src/loaders/presets.ts` (use core)

**Tests**:
- Unit tests for `deepMerge` edge cases
- Unit tests for `isPlainObject`
- Unit tests for `mergeConfig` with various config shapes

### Phase 2: PresetLoader Service (PR #2)

**Goal**: Create PresetLoader service in core with npm-only implementation

**Changes**:
- Create `packages/core/src/presets/PresetLoader.ts`
  - Define `PresetLoadError` tagged error
  - Define `PresetLoaderService` interface
  - Implement `PresetLoader` Context.Tag
  - Implement `PresetLoaderNpmLive` Layer
  - Export types: `LoadPresetsResult`, `Preset` (if not already exported)
- Update core exports
- Create basic tests with mocked dynamic imports

**Service Interface**:
```typescript
export interface PresetLoaderService {
  readonly loadPreset: (name: string) => Effect.Effect<Preset, PresetLoadError>
  readonly loadPresets: (names: ReadonlyArray<string>) => Effect.Effect<LoadPresetsResult, PresetLoadError>
}

export interface LoadPresetsResult {
  readonly rules: ReadonlyArray<Rule>
  readonly defaults: Record<string, unknown>
}
```

**Files**:
- ✅ New: `packages/core/src/presets/PresetLoader.ts`
- ✅ Modified: `packages/core/src/index.ts` (exports)
- ✅ New: `packages/core/src/__tests__/presets/PresetLoader.test.ts`

**Tests**:
- Load valid preset (mocked import)
- Load invalid preset (missing rules)
- Load non-existent preset (import failure)
- Load multiple presets (merge defaults and rules)

### Phase 3: Rules Builder (PR #3)

**Goal**: Move rule construction logic from CLI to core

**Changes**:
- Create `packages/core/src/rules/builders.ts`
  - Export `rulesFromConfig(config): ReadonlyArray<Rule>`
  - Handle `exactOptionalPropertyTypes` correctly
  - Support both pattern and boundary rules
- Update core exports

**Implementation**:
```typescript
export function rulesFromConfig(config: Config): ReadonlyArray<Rule> {
  const rules: Rule[] = []
  
  if (config.patterns) {
    for (const patternConfig of config.patterns) {
      const rule = makePatternRule({
        id: patternConfig.id,
        message: patternConfig.message,
        pattern: patternConfig.pattern,
        severity: patternConfig.severity,
        ...(patternConfig.docsUrl && { docsUrl: patternConfig.docsUrl }),
        ...(patternConfig.fileGlobs && { fileGlobs: patternConfig.fileGlobs })
      })
      rules.push(rule)
    }
  }
  
  if (config.boundaries) {
    for (const boundaryConfig of config.boundaries) {
      const rule = makeBoundaryRule({
        id: boundaryConfig.id,
        message: boundaryConfig.message,
        from: boundaryConfig.from,
        to: boundaryConfig.to,
        severity: boundaryConfig.severity,
        ...(boundaryConfig.docsUrl && { docsUrl: boundaryConfig.docsUrl })
      })
      rules.push(rule)
    }
  }
  
  return rules
}
```

**Files**:
- ✅ New: `packages/core/src/rules/builders.ts`
- ✅ Modified: `packages/core/src/index.ts` (exports)
- ✅ New: `packages/core/src/__tests__/rules/builders.test.ts`

**Tests**:
- Build rules from pattern config
- Build rules from boundary config
- Build rules from mixed config
- Handle empty config
- Preserve optional properties correctly

### Phase 4: CLI Workspace Layer (PR #4)

**Goal**: Create workspace-aware PresetLoader layer in CLI

**Changes**:
- Create `packages/cli/src/layers/PresetLoaderWorkspace.ts`
  - Implement workspace resolution using FileSystem and Path
  - Fall back to npm resolution if not in workspace
  - Provide same interface as core PresetLoader
- Update CLI to use this layer in dev/monorepo mode

**Implementation Pattern**:
```typescript
export const PresetLoaderWorkspaceLive: Layer.Layer<
  PresetLoader,
  never,
  FileSystem.FileSystem | Path.Path
> = Layer.effect(
  PresetLoader,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    
    const resolveWorkspaceUrl = (name: string) =>
      Effect.gen(function* () {
        const packageName = name.split("/").pop()
        if (!packageName) return undefined
        
        const workspacePath = path.join(
          process.cwd(), // CLI is allowed to use process.cwd
          "packages",
          packageName,
          "build/esm/index.js"
        )
        
        const exists = yield* fs.exists(workspacePath).pipe(
          Effect.catchAll(() => Effect.succeed(false))
        )
        
        return exists ? `file://${workspacePath}` : undefined
      })
    
    // Implement PresetLoaderService interface
    // Try workspace, fall back to npm
  })
)
```

**Files**:
- ✅ New: `packages/cli/src/layers/PresetLoaderWorkspace.ts`
- ✅ New: `packages/cli/src/__tests__/layers/PresetLoaderWorkspace.test.ts`

**Tests**:
- Load from workspace (file:// URL)
- Load from npm when not in workspace
- Handle missing preset in both locations

### Phase 5: CLI Orchestration (PR #5)

**Goal**: Reduce CLI loaders to thin orchestrators

**Changes**:
- Delete `packages/cli/src/loaders/config.ts` (replaced by core merge)
- Reduce `packages/cli/src/loaders/rules.ts` to orchestrator:
  - Import from core: `loadConfig`, `mergeConfig`, `rulesFromConfig`, `PresetLoader`
  - Compose services with logging and error handling
  - No business logic duplication
- Update commands to import from correct locations

**Orchestrator Pattern**:
```typescript
import { loadConfig, mergeConfig, rulesFromConfig, PresetLoader } from "@effect-migrate/core"

export const loadRulesAndConfig = (configPath: string) =>
  Effect.gen(function* () {
    // Log progress
    yield* Console.log("🔍 Loading configuration...")
    const config = yield* loadConfig(configPath)
    
    // Load presets with CLI-specific error handling
    const presetResult = config.presets?.length
      ? yield* PresetLoader.pipe(
          Effect.flatMap((loader) => loader.loadPresets(config.presets)),
          Effect.catchTag("PresetLoadError", (e) =>
            Effect.gen(function* () {
              yield* Console.warn(`⚠️  Failed to load preset ${e.preset}: ${e.message}`)
              return { rules: [], defaults: {} }
            })
          )
        )
      : { rules: [], defaults: {} }
    
    // Merge config with preset defaults
    const effectiveConfig = mergeConfig(presetResult.defaults, config)
    
    // Build all rules
    const allRules = [...presetResult.rules, ...rulesFromConfig(effectiveConfig)]
    
    return { rules: allRules, config: effectiveConfig }
  })
```

**Files**:
- ✅ Deleted: `packages/cli/src/loaders/config.ts`
- ✅ Modified: `packages/cli/src/loaders/rules.ts`
- ✅ Modified: `packages/cli/src/commands/audit.ts`
- ✅ Modified: `packages/cli/src/commands/metrics.ts`
- ✅ Modified: `packages/cli/src/__tests__/commands/audit.test.ts`

**Tests**:
- Integration test: load rules with presets
- Integration test: handle preset load errors gracefully
- Integration test: merge config correctly

### Phase 6: Final Cleanup (PR #6)

**Goal**: Remove all duplicated code and update documentation

**Changes**:
- Delete `packages/cli/src/loaders/presets.ts` if fully replaced
- Remove any remaining duplicated utilities
- Update AGENTS.md files
- Update package READMEs
- Run full test suite
- Type check all packages
- Lint and format

**Verification**:
```bash
pnpm build:types
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

## Key Principles

### Effect Patterns

1. **Services over functions**: Use Context.Tag and Layer for dependency injection
2. **TaggedError**: Use Data.TaggedError for type-safe error handling
3. **Platform-agnostic core**: No process, console, or Node-specific APIs in core
4. **Layer composition**: CLI provides enhanced layers; core provides base implementations

### Dependency Direction

```
@effect-migrate/preset-basic
        ↓
@effect-migrate/core ← (no imports from other packages)
        ↓
@effect-migrate/cli
```

Core is the source of truth. CLI depends on core but core never depends on CLI.

### Separation of Concerns

**Core Package**:
- Config merging (pure utility)
- Preset loading interface (service)
- Rule construction (pure function)
- Schema validation
- Domain types

**CLI Package**:
- User interaction (logging, progress)
- Workspace resolution (process.cwd, file:// URLs)
- Error presentation (console formatting)
- Command orchestration
- Exit code handling

## Anti-Patterns to Avoid

❌ **Don't**:
- Add Console or logging to core services
- Use process.cwd() in core
- Duplicate utility functions
- Mix business logic with presentation logic
- Create core → CLI dependencies

✅ **Do**:
- Keep core pure and platform-agnostic
- Use services for swappable implementations
- Compose with layers
- Add logging at CLI orchestration layer
- Use Effect.gen for async flows
- Handle errors with catchTag

## Testing Strategy

### Core Tests

- **Unit tests**: All utilities (merge, isPlainObject, rulesFromConfig)
- **Service tests**: PresetLoader with mocked imports
- **Integration tests**: Full config + preset + rules flow

### CLI Tests

- **Layer tests**: PresetLoaderWorkspace resolution
- **Integration tests**: Commands using new core services
- **E2E tests**: Full audit/metrics workflows

## Rollout Plan

1. **PR #1**: Merge utilities (low risk, isolated)
2. **PR #2**: PresetLoader service (core only, no CLI changes yet)
3. **PR #3**: Rules builder (core only)
4. **PR #4**: CLI workspace layer (additive, no removal)
5. **PR #5**: CLI orchestration refactor (breaking changes isolated to CLI)
6. **PR #6**: Cleanup and docs

Each PR is independently reviewable and testable.

## Success Criteria

- ✅ No duplicated code between packages
- ✅ Core package is platform-agnostic
- ✅ CLI uses core services via dependency injection
- ✅ All tests pass
- ✅ Type checking passes with strict mode
- ✅ Lint passes
- ✅ No anti-patterns in core
- ✅ Documentation updated

## References

- Oracle analysis: See thread context
- Librarian Effect patterns: See thread context
- AGENTS.md: Effect-TS best practices
- packages/core/AGENTS.md: Core package guidelines
- packages/cli/AGENTS.md: CLI package guidelines
