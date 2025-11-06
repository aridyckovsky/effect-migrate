# @effect-migrate/cli

Command-line interface for Effect migration toolkit.

## Installation

```bash
pnpm add -D @effect-migrate/cli
```

## Commands

- `effect-migrate init` — Create configuration file
- `effect-migrate audit` — Detect migration issues
- `effect-migrate metrics` — Show migration progress
- `effect-migrate thread add` — Track Amp thread URLs
- `effect-migrate thread list` — List tracked threads

## Preset Loading

The CLI automatically loads and merges rules from presets specified in your config:

```typescript
// effect-migrate.config.ts
export default {
  version: 1,
  presets: ["@effect-migrate/preset-basic"]
  // ... other config
} satisfies Config
```

### How Preset Loading Works

1. **Sequential loading**: Presets are loaded in the order specified
2. **Rule merging**: All preset rules are combined with your custom `patterns` and `boundaries`
3. **Config merging**: Preset defaults (like `paths.exclude`) are merged with your config
4. **User config precedence**: Your config values always override preset defaults

### Config Merging Example

```typescript
// Preset provides:
{
  paths: {
    exclude: ["node_modules/**", "dist/**"]
  }
}

// Your config:
{
  presets: ["@effect-migrate/preset-basic"],
  paths: {
    exclude: ["vendor/**"]  // MERGES with preset excludes
  }
}

// Effective config:
{
  paths: {
    exclude: ["node_modules/**", "dist/**", "vendor/**"]
  }
}
```

### Error Handling

**Missing preset module:**

```bash
$ effect-migrate audit
⚠️  Failed to load preset @myteam/custom-rules: Cannot find module '@myteam/custom-rules'
✓ Loaded 1 preset(s)
```

The CLI logs a warning and continues with remaining presets. User-defined rules still execute.

**Invalid preset shape:**

If a preset doesn't export the correct structure (`{ rules: Rule[], defaults?: {} }`), the CLI logs:

```bash
⚠️  Failed to load preset @myteam/broken-preset: Invalid preset shape
```

### Debugging Presets

Use verbose logging to see which rules are loaded from presets:

```bash
effect-migrate audit --verbose
```

Output shows:

- Which presets loaded successfully
- Number of rules from each preset
- Effective config after merging

## Usage

For complete documentation, see the [main repository](https://github.com/aridyckovsky/effect-migrate).
