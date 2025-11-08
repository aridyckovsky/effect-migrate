---
"@effect-migrate/core": minor
"@effect-migrate/cli": minor
---

Add normalized schema for 40-70% audit.json size reduction and move business logic to core

**Breaking Changes:**

1. **Schema version 0.1.0 → 0.2.0** (audit.json - no backwards compatibility)
   - Replace `byFile`/`byRule` with deduplicated `rules[]`, `files[]`, `results[]` arrays
   - Add index-based groupings in `groups` field for O(1) lookup
   - Implement deterministic ordering (sorted rules/files) for reproducible output
   - Add stable content-based keys for cross-checkpoint delta computation
   - Compact range representation using tuples instead of objects
   - Add separate `info` counter to FindingsSummary (previously counted as warnings)

2. **CLI loaders removed** - business logic moved to @effect-migrate/core
   - ❌ Removed `@effect-migrate/cli/loaders/config` - use `@effect-migrate/core` exports instead
   - ❌ Removed `@effect-migrate/cli/loaders/presets` - use `PresetLoader` service instead

**New @effect-migrate/core exports:**

Config utilities:

- `mergeConfig(defaults, userConfig)` - Merge preset defaults with user config
- `deepMerge(target, source)` - Deep merge plain objects (arrays replaced, not concatenated)
- `isPlainObject(value)` - Type guard for plain objects

Preset loading:

- `PresetLoader` - Context.Tag for preset loading service
- `PresetLoaderService` - Service interface
- `PresetLoaderNpmLive` - Default Layer for npm-based preset resolution
- `PresetLoadError` - Tagged error for preset loading failures
- `Preset` - Preset type (rules + optional defaults)
- `LoadPresetsResult` - Result of loading multiple presets

Rule construction:

- `rulesFromConfig(config)` - Build rules from config (pattern + boundary)

Schema enhancements:

- Config now supports `presets?: string[]` field for preset names

Normalizer utilities:

- `normalizeResults(results, config, threads?)` - Convert to normalized schema
- `expandResult(normalized)` - Convert back to flat format
- `deriveResultKey(result)` - Generate stable content-based key

**@effect-migrate/cli changes:**

New workspace-aware preset resolution:

- `PresetLoaderWorkspaceLive` - Layer that tries workspace path first, falls back to npm
- Supports monorepo development with automatic workspace preset detection
- Windows-compatible file URL handling with `pathToFileURL()`

Refactored loaders:

- `loadRulesAndConfig()` now orchestrates core services instead of implementing logic
- Uses `Effect.catchTag("PresetLoadError")` for precise error handling
- Reduced CLI code by ~1291 lines (60% reduction in loaders)

**Build improvements:**

- Implement TypeScript Project References (src/test separation) for proper type checking
- Fix NodeNext module resolution (.js extension requirements)
- Consolidate test organization (all tests in `test/` directories)
- Fix barrel import violations (use direct imports from @effect/platform)
- Remove duplicate utils folder (merged util/ into utils/)

**Migration guide:**

If you were importing from CLI loaders:

```typescript
// Before
import { loadConfig } from "@effect-migrate/cli/loaders/config"
import { loadPresets } from "@effect-migrate/cli/loaders/presets"

// After
import { loadConfig, PresetLoader } from "@effect-migrate/core"

const config = yield * loadConfig(configPath)
const loader = yield * PresetLoader
const { rules, defaults } = yield * loader.loadPresets(config.presets ?? [])
```

**Test coverage:**

- 50 new tests for core utilities (config merge, preset loading, rule builders)
- 6 new tests for CLI workspace preset resolution
- 40+ tests for normalized schema
- Total: 308 tests passing
