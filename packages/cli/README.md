# @effect-migrate/cli

Command-line interface for the Effect migration toolkit.

> **⚠️ Early Stage Development**  
> This package is under active development. Core commands work, but some features are still in progress.

## Status

| Command            | Status         | Description                   |
| ------------------ | -------------- | ----------------------------- |
| `init`             | 🧪 Dogfooding  | Create configuration file     |
| `audit`            | 🧪 Dogfooding  | Detect migration issues       |
| `thread add`       | 🧪 Dogfooding  | Track Amp thread URLs         |
| `thread list`      | 🧪 Dogfooding  | List tracked threads          |
| `checkpoints list` | 🧪 Dogfooding  | List audit checkpoint history |
| `checkpoints show` | 🧪 Dogfooding  | Show specific checkpoint      |
| `checkpoints diff` | 🧪 Dogfooding  | Compare two checkpoints       |
| `metrics`          | 🧪 Dogfooding  | Show migration progress       |
| `docs`             | 📅 Not Started | Validate documentation        |
| `--help`           | ✅ Complete    | Show command help             |

## Installation

Install as a dev dependency:

```bash
pnpm add -D @effect-migrate/cli
```

Or globally:

```bash
pnpm add -g @effect-migrate/cli
```

> **Note**: APIs are unstable and may change. Pin to specific versions in production.

Then run commands:

```bash
effect-migrate --help
effect-migrate audit
effect-migrate thread list
```

---

## Usage

### Getting Help

```bash
effect-migrate --help
effect-migrate audit --help
effect-migrate thread --help
effect-migrate checkpoints --help
```

### Global Options

All commands support:

- `--help` — Show command-specific help
- `--version` — Show version information
- `--log-level <level>` — Set minimum log level (all, trace, debug, info, warning, error, fatal, none)
- `--completions <shell>` — Generate shell completion script (sh, bash, fish, zsh)

---

## Commands

### `init` — Initialize Configuration

Create a new `effect-migrate.config.ts` file with type-safe defaults.

**Usage:**

```bash
effect-migrate init
```

**Generated config:**

```typescript
import { defineConfig } from "@effect-migrate/core"

export default defineConfig({
  version: 1,
  presets: ["@effect-migrate/preset-basic"],
  paths: {
    include: ["src/**/*.{ts,tsx}"],
    exclude: ["**/{node_modules,dist,build}/**"]
  }
})
```

**Options:**

- Currently no options; future versions may support `--preset`, `--output`, etc.

---

### `audit` — Detect Migration Issues

Run pattern and boundary rules against your codebase to detect migration issues.

**Usage:**

```bash
# Basic audit
effect-migrate audit

# With custom config
effect-migrate audit --config my-config.ts

# Output as JSON
effect-migrate audit --json

# Write Amp context files
effect-migrate audit --amp-out .amp/effect-migrate

# Strict mode (fail on warnings)
effect-migrate audit --strict
```

**Options:**

| Option         | Type      | Default                    | Description                          |
| -------------- | --------- | -------------------------- | ------------------------------------ |
| `--config, -c` | `string`  | `effect-migrate.config.ts` | Path to configuration file           |
| `--json`       | `boolean` | `false`                    | Output results as JSON               |
| `--amp-out`    | `string`  | (optional)                 | Directory to write Amp context files |
| `--strict`     | `boolean` | `false`                    | Fail on warnings (not just errors)   |

**Console Output:**

```
🔍 Running migration audit...

Pattern Violations
══════════════════
❌ src/api/fetchUser.ts:23
   Replace async/await with Effect.gen (no-async-await)

Boundary Violations
═══════════════════
❌ src/services/FileService.ts:5
   Use @effect/platform instead of Node.js APIs (no-node-in-services)
   Import: node:fs/promises

Summary
═══════
Errors: 1
Warnings: 1
```

**JSON Output (`--json`):**

```json
{
  "summary": {
    "total": 2,
    "errors": 1,
    "warnings": 1
  },
  "findings": [
    {
      "id": "no-async-await",
      "file": "src/api/fetchUser.ts",
      "line": 23,
      "column": 1,
      "severity": "error",
      "message": "Replace async/await with Effect.gen",
      "docsUrl": "https://effect.website/docs/essentials/effect-type"
    }
  ]
}
```

**Amp Context Output (`--amp-out`):**

When you specify `--amp-out`, the following files are generated:

- `index.json` — Entry point for Amp and other agents
- `audit.json` — Detailed findings with schema version and revision
- `threads.json` — Tracked threads (if any exist)

---

### `thread add` — Track Amp Thread

Add an Amp thread URL to track migration work and context.

**Usage:**

```bash
# Basic usage
effect-migrate thread add --url https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc

# With tags
effect-migrate thread add \
  --url https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc \
  --tags "migration,services"

# With scope (file globs)
effect-migrate thread add \
  --url https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc \
  --tags "migration,api" \
  --scope "src/api/**,src/services/**"

# With description
effect-migrate thread add \
  --url https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc \
  --description "Migrated user authentication to Effect"

# Write to custom directory
effect-migrate thread add \
  --url https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc \
  --amp-out .amp/custom
```

**Options:**

| Option          | Type     | Required | Description                                                      |
| --------------- | -------- | -------- | ---------------------------------------------------------------- |
| `--url`         | `string` | ✅ Yes   | Amp thread URL (format: `https://ampcode.com/threads/T-{uuid}`)  |
| `--tags`        | `string` | No       | Comma-separated tags (e.g., `migration,api`)                     |
| `--scope`       | `string` | No       | Comma-separated file globs (e.g., `src/api/**`)                  |
| `--description` | `string` | No       | Optional description of thread context                           |
| `--amp-out`     | `string` | No       | Directory to write threads.json (default: `.amp/effect-migrate`) |

**Thread URL Validation:**

URLs must match the format `https://ampcode.com/threads/T-{uuid}` (case-insensitive). The thread ID is normalized to lowercase.

**Behavior:**

- **Adding new thread**: Creates entry with `createdAt` timestamp
- **Re-adding same thread**: Replaces tags and scope (no merging); preserves original `createdAt`
- **Sorting**: Threads are sorted by `createdAt` descending (newest first)

**Output:**

```
✓ Added thread T-abc12345-6789-abcd-ef01-234567890abc
```

or

```
✓ Updated thread T-abc12345-6789-abcd-ef01-234567890abc: replaced tags/scope
```

---

### `thread list` — List Tracked Threads

Display all tracked Amp threads.

**Usage:**

```bash
# Human-readable format
effect-migrate thread list

# JSON format
effect-migrate thread list --json

# Read from custom directory
effect-migrate thread list --amp-out .amp/custom
```

**Options:**

| Option      | Type      | Default               | Description                         |
| ----------- | --------- | --------------------- | ----------------------------------- |
| `--json`    | `boolean` | `false`               | Output as JSON                      |
| `--amp-out` | `string`  | `.amp/effect-migrate` | Directory to read threads.json from |

**Console Output:**

```
T-abc12345-6789-abcd-ef01-234567890abc
  URL: https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc
  Tags: migration, services
  Scope: src/services/**
  Created: 2025-11-07T10:00:00Z

T-def67890-1234-5678-90ab-cdef12345678
  URL: https://ampcode.com/threads/T-def67890-1234-5678-90ab-cdef12345678
  Tags: migration, api
  Created: 2025-11-06T15:30:00Z
```

**JSON Output:**

```json
{
  "threads": [
    {
      "id": "T-abc12345-6789-abcd-ef01-234567890abc",
      "url": "https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc",
      "tags": ["migration", "services"],
      "scope": ["src/services/**"],
      "description": "Migrated user services to Effect",
      "createdAt": "2025-11-07T10:00:00Z"
    }
  ]
}
```

---

### `checkpoints` — Manage Audit History

View and compare checkpoint history from time-series audit snapshots.

#### `checkpoints list` — List Checkpoint History

Display all audit checkpoints with deltas showing progress over time.

**Usage:**

```bash
# List all checkpoints
effect-migrate checkpoints list

# JSON format
effect-migrate checkpoints list --json

# Custom amp-out directory
effect-migrate checkpoints list --amp-out .amp/custom
```

**Options:**

| Option      | Type      | Default               | Description                        |
| ----------- | --------- | --------------------- | ---------------------------------- |
| `--json`    | `boolean` | `false`               | Output as JSON                     |
| `--amp-out` | `string`  | `.amp/effect-migrate` | Directory to read checkpoints from |

**Console Output:**

```
Checkpoint ID            | Timestamp            | Thread      | Errors | Warnings | Info  | Delta
────────────────────────────────────────────────────────────────────────────────────────────────────
2025-11-08T14-30-00Z     | 2025-11-08 14:30:00  | T-abc123    | 5      | 12       | 3     | -2 errors, -3 warnings
2025-11-08T10-00-00Z     | 2025-11-08 10:00:00  | T-def456    | 7      | 15       | 3     | +1 error, +2 warnings
2025-11-07T16-45-00Z     | 2025-11-07 16:45:00  |             | 6      | 13       | 3     | (initial)
```

**JSON Output:**

```json
{
  "checkpoints": [
    {
      "id": "2025-11-08T14-30-00Z",
      "timestamp": "2025-11-08T14:30:00.000Z",
      "thread": "T-abc123-uuid",
      "summary": {
        "errors": 5,
        "warnings": 12,
        "info": 3,
        "totalFiles": 42,
        "totalFindings": 20
      },
      "delta": {
        "errors": -2,
        "warnings": -3,
        "info": 0,
        "totalFindings": -5
      }
    }
  ]
}
```

---

#### `checkpoints latest` — Show Latest Checkpoint

Display the most recent checkpoint details.

**Usage:**

```bash
# Show latest checkpoint
effect-migrate checkpoints latest

# JSON format
effect-migrate checkpoints latest --json
```

---

#### `checkpoints show` — Show Specific Checkpoint

Display details for a specific checkpoint by ID.

**Usage:**

```bash
# Show checkpoint
effect-migrate checkpoints show 2025-11-08T14-30-00Z

# JSON format
effect-migrate checkpoints show 2025-11-08T14-30-00Z --json
```

---

#### `checkpoints diff` — Compare Two Checkpoints

Compare two checkpoints and show what changed between them.

**Usage:**

```bash
# Compare two checkpoints
effect-migrate checkpoints diff 2025-11-08T10-00-00Z 2025-11-08T14-30-00Z

# JSON format
effect-migrate checkpoints diff 2025-11-08T10-00-00Z 2025-11-08T14-30-00Z --json
```

**Console Output:**

```
Comparing checkpoints:
  From: 2025-11-08T10-00-00Z (2025-11-08 10:00:00)
  To:   2025-11-08T14-30-00Z (2025-11-08 14:30:00)

Changes:
  Errors:   7 → 5 (-2)
  Warnings: 15 → 12 (-3)
  Info:     3 → 3 (0)
  Total:    25 → 20 (-5)

Progress: ✅ Improved (5 fewer findings)
```

---

### `metrics` — Show Migration Progress

> **⏳ In Progress** — This command is under development.

Show migration progress metrics based on rule violations and file coverage.

**Planned usage:**

```bash
# Show metrics
effect-migrate metrics

# Write metrics.json for Amp
effect-migrate metrics --amp-out .amp/effect-migrate

# JSON output
effect-migrate metrics --json
```

---

## Preset Loading

The CLI automatically loads and merges rules from presets specified in your config.

### How Preset Loading Works

1. **Sequential loading**: Presets are loaded in the order specified in `presets: [...]`
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

Use log level to see which rules are loaded:

```bash
effect-migrate audit --log-level debug
```

Output shows:

- Which presets loaded successfully
- Number of rules from each preset
- Effective config after merging

---

## Exit Codes

The CLI uses standard exit codes:

- `0` — Success (audit passed, no errors)
- `1` — Failure (audit found errors, or command failed)
- `2` — Invalid usage (missing required arguments, invalid options)

**Audit behavior:**

- Returns `0` if no violations or only warnings
- Returns `1` if any violations with `severity: "error"`

---

## Troubleshooting

### Thread add fails with "Invalid URL"

Thread URLs must be valid Amp thread URLs matching the format:

```
https://ampcode.com/threads/T-{uuid}
```

**Examples:**

```bash
# ✅ Valid
effect-migrate thread add --url https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc

# ✅ Valid (case-insensitive)
effect-migrate thread add --url https://ampcode.com/threads/t-abc12345-6789-abcd-ef01-234567890abc

# ❌ Invalid (missing https://)
effect-migrate thread add --url ampcode.com/threads/T-abc123

# ❌ Invalid (wrong format)
effect-migrate thread add --url https://ampcode.com/threads/abc123
```

### Thread add fails with "Thread URL cannot be empty"

The `--url` flag is required when adding threads:

```bash
effect-migrate thread add --url https://ampcode.com/threads/T-abc12345-6789-abcd-ef01-234567890abc
```

### Threads not showing in audit.json

Thread metadata is stored in `threads.json` and referenced in `audit.json`. Run `audit` after adding threads to regenerate context files:

```bash
effect-migrate thread add --url https://ampcode.com/threads/T-...
effect-migrate audit --amp-out .amp/effect-migrate
```

### Tags/scope replaced (not merged) when re-adding thread

Adding the same thread URL multiple times **replaces** the existing entry. Tags and scope from the new command override previous values; they are **not merged**.

If you want to preserve existing tags, include them in the new command:

```bash
# First add
effect-migrate thread add --url https://... --tags "migration"

# Later, to add another tag, include both:
effect-migrate thread add --url https://... --tags "migration,services"
```

### Config file not found

By default, the CLI looks for `effect-migrate.config.ts` in the current directory. Use `--config` to specify a different path:

```bash
effect-migrate audit --config ./config/migration.config.ts
```

### Preset loading fails in monorepo development

When developing locally in the monorepo, preset loading via `import()` may fail due to workspace resolution. This is expected and handled gracefully:

```bash
⚠️  Failed to load preset @effect-migrate/preset-basic: Cannot find module
```

This is a known limitation of local development. Once published to npm, preset loading works correctly. Your custom rules defined in the config will still execute.

### Command not found

If `effect-migrate` command is not found:

**For local development:**

Use the workspace filter:

```bash
pnpm -w --filter @effect-migrate/cli exec effect-migrate --help
```

**For global installation (after publishing):**

```bash
pnpm add -g @effect-migrate/cli
```

---

## Local Development

Want to try the CLI before it's published?

```bash
git clone https://github.com/aridyckovsky/effect-migrate.git
cd effect-migrate
pnpm install
pnpm build
```

### Running CLI Locally

**During development** (recommended, no build needed):

```bash
# Run from source using tsx
pnpm cli --help
pnpm cli audit
pnpm cli thread list --json
pnpm cli --version
```

**Using built version**:

```bash
node packages/cli/build/esm/index.js --help
node packages/cli/build/esm/index.js audit
node packages/cli/build/esm/index.js thread list --json
```

---

## Links

- [Main Repository](https://github.com/aridyckovsky/effect-migrate)
- [AGENTS.md](../../AGENTS.md) — Development guidelines and Effect patterns
- [@effect-migrate/core](../core) — Migration engine
- [@effect-migrate/preset-basic](../preset-basic) — Default rules

---

## License

MIT © 2025 [Ari Dyckovsky](https://github.com/aridyckovsky)
