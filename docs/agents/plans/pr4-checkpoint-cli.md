---
created: 2025-11-06
lastUpdated: 2025-11-06
author: Generated via Amp (Oracle + Librarian analysis)
status: ready
thread: https://ampcode.com/threads/T-5bd34c50-9752-4d71-8768-e8290de2c380
audience: Development team and AI coding agents
tags: [pr-plan, cli, ux, wave2, checkpoints]
related:
  - ./checkpoint-based-audit-persistence.md
  - ./comprehensive-data-architecture.md
  - ../../packages/cli/AGENTS.md
---

# PR4: Checkpoint CLI - User-Facing Management Commands

## Goal

Add user-friendly CLI commands for checkpoint management to enable developers to view, compare, and understand their migration progress history.

**Estimated Effort:** 1-2 hours coding + 30 min testing

**Dependencies:** 
- PR3 (JSON Checkpoints) must be complete
- `checkpoint-manager.ts` must be implemented

---

## Overview

This PR adds four CLI commands under the `checkpoints` subcommand:

1. **`checkpoints list`** - Tabular view of all checkpoints with deltas
2. **`checkpoints show <id>`** - Full JSON details of a specific checkpoint
3. **`checkpoints latest`** - Quick summary of the most recent checkpoint
4. **`checkpoints diff <from> [to]`** - Compare two checkpoints (defaults to latest)

Additionally, the `audit` command will be updated to log checkpoint information on success.

**Key Principles:**
- Use `@effect/cli` Command and Options patterns (see packages/cli/AGENTS.md)
- Use `cli-table3` for formatted table output
- Follow existing CLI command patterns from `thread.ts`
- Provide both human-readable and JSON output options
- Handle errors gracefully with helpful messages

---

## Implementation

### Phase 1: CLI Command Implementation (1-1.5 hours)

#### File: `packages/cli/src/commands/checkpoints.ts`

**Purpose:** Implement checkpoint management CLI commands using @effect/cli framework.

**Implementation:**

```typescript
/**
 * Checkpoints Command - CLI commands for viewing checkpoint history
 *
 * This module provides commands for managing and viewing audit checkpoints,
 * enabling users to track migration progress over time.
 *
 * ## Commands
 *
 * - **checkpoints list**: Show all checkpoints in table format
 * - **checkpoints show <id>**: Display full checkpoint details
 * - **checkpoints latest**: Show latest checkpoint summary
 * - **checkpoints diff <from> [to]**: Compare two checkpoints
 *
 * ## Usage
 *
 * ```bash
 * # List all checkpoints
 * effect-migrate checkpoints list
 *
 * # Show specific checkpoint
 * effect-migrate checkpoints show 2025-11-06T10-00-00Z
 *
 * # Show latest checkpoint
 * effect-migrate checkpoints latest
 *
 * # Compare checkpoints
 * effect-migrate checkpoints diff 2025-11-06T10-00-00Z 2025-11-06T14-15-00Z
 * ```
 *
 * @module @effect-migrate/cli/commands/checkpoints
 * @since 0.3.0
 */

import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import Table from "cli-table3"
import chalk from "chalk"
import * as Console from "effect/Console"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { ampOutOption } from "../amp/constants.js"
import {
  getLatestCheckpoint,
  listCheckpoints,
  readCheckpoint,
  type CheckpointSummary
} from "../amp/checkpoint-manager.js"

/**
 * Format timestamp for display (shorter, cleaner format).
 */
const formatTimestamp = (ts: string): string => {
  try {
    const date = new Date(ts)
    return date.toISOString().replace("T", " ").replace(/\.\d{3}Z/, "")
  } catch {
    return ts
  }
}

/**
 * Format delta value with sign and color.
 */
const formatDelta = (value: number): string => {
  if (value === 0) return chalk.gray("0")
  const sign = value > 0 ? "+" : ""
  const color = value > 0 ? chalk.red : chalk.green
  return color(`${sign}${value}`)
}

/**
 * CLI command: checkpoints list
 *
 * Displays all checkpoints in a formatted table with:
 * - Timestamp
 * - Thread ID (if linked)
 * - Error count
 * - Warning count
 * - Total findings
 * - Delta from previous checkpoint
 *
 * @category CLI Command
 * @since 0.3.0
 */
const checkpointsListCommand = Command.make(
  "list",
  {
    ampOut: ampOutOption(),
    json: Options.boolean("json").pipe(
      Options.withDefault(false),
      Options.withDescription("Output as JSON instead of table")
    ),
    limit: Options.integer("limit").pipe(
      Options.optional,
      Options.withDescription("Limit number of checkpoints shown (default: all)")
    )
  },
  ({ ampOut, json, limit }) =>
    Effect.gen(function*() {
      const limitValue = Option.getOrElse(limit, () => undefined)
      const checkpoints = yield* listCheckpoints(ampOut, limitValue)

      if (checkpoints.length === 0) {
        yield* Console.log("No checkpoints found")
        return 0
      }

      if (json) {
        // JSON output
        yield* Console.log(JSON.stringify(checkpoints, null, 2))
      } else {
        // Table output
        const table = new Table({
          head: [
            chalk.bold("Timestamp"),
            chalk.bold("Thread"),
            chalk.bold("Errors"),
            chalk.bold("Warnings"),
            chalk.bold("Total"),
            chalk.bold("Delta (E/W)")
          ],
          colWidths: [22, 14, 10, 10, 10, 18]
        })

        for (const cp of checkpoints) {
          const deltaStr = cp.delta
            ? `${formatDelta(cp.delta.errors)} / ${formatDelta(cp.delta.warnings)}`
            : chalk.gray("—")

          table.push([
            formatTimestamp(cp.timestamp),
            cp.thread ?? chalk.gray("—"),
            cp.summary.errors.toString(),
            cp.summary.warnings.toString(),
            cp.summary.totalFindings.toString(),
            deltaStr
          ])
        }

        yield* Console.log(`\n${table.toString()}\n`)
        yield* Console.log(chalk.gray(`Total checkpoints: ${checkpoints.length}\n`))
      }

      return 0
    }).pipe(
      Effect.catchAll((error: unknown) =>
        Effect.gen(function*() {
          const errorMessage = error instanceof Error ? error.message : String(error)
          yield* Console.error(`❌ Failed to list checkpoints: ${errorMessage}`)
          return 1
        })
      )
    )
)

/**
 * CLI command: checkpoints show <id>
 *
 * Displays full checkpoint details in JSON format.
 *
 * @category CLI Command
 * @since 0.3.0
 */
const checkpointsShowCommand = Command.make(
  "show",
  {
    ampOut: ampOutOption(),
    checkpointId: Args.text({ name: "checkpoint-id" }).pipe(
      Args.withDescription("Checkpoint ID (e.g., 2025-11-06T10-00-00Z)")
    )
  },
  ({ ampOut, checkpointId }) =>
    Effect.gen(function*() {
      const checkpoint = yield* readCheckpoint(ampOut, checkpointId)

      yield* Console.log(JSON.stringify(checkpoint, null, 2))

      return 0
    }).pipe(
      Effect.catchAll((error: unknown) =>
        Effect.gen(function*() {
          const errorMessage = error instanceof Error ? error.message : String(error)
          yield* Console.error(`❌ Failed to read checkpoint: ${errorMessage}`)
          yield* Console.error(`   Use 'checkpoints list' to see available checkpoint IDs`)
          return 1
        })
      )
    )
)

/**
 * CLI command: checkpoints latest
 *
 * Shows a quick summary of the most recent checkpoint with:
 * - Checkpoint ID
 * - Timestamp
 * - Thread ID (if linked)
 * - Error/warning counts
 * - Delta from previous (if available)
 *
 * @category CLI Command
 * @since 0.3.0
 */
const checkpointsLatestCommand = Command.make(
  "latest",
  {
    ampOut: ampOutOption(),
    json: Options.boolean("json").pipe(
      Options.withDefault(false),
      Options.withDescription("Output as JSON")
    )
  },
  ({ ampOut, json }) =>
    Effect.gen(function*() {
      const latestOption = yield* getLatestCheckpoint(ampOut)

      if (Option.isNone(latestOption)) {
        yield* Console.log("No checkpoints found")
        return 0
      }

      const latest = latestOption.value

      if (json) {
        yield* Console.log(JSON.stringify(latest, null, 2))
      } else {
        yield* Console.log(chalk.bold("\nLatest Checkpoint:\n"))
        yield* Console.log(`  ${chalk.gray("ID:")} ${latest.timestamp}`)
        yield* Console.log(`  ${chalk.gray("Time:")} ${formatTimestamp(latest.timestamp)}`)

        if (latest.thread) {
          yield* Console.log(`  ${chalk.gray("Thread:")} ${latest.thread}`)
        }

        yield* Console.log(`  ${chalk.gray("Errors:")} ${latest.summary.errors}`)
        yield* Console.log(`  ${chalk.gray("Warnings:")} ${latest.summary.warnings}`)
        yield* Console.log(`  ${chalk.gray("Total findings:")} ${latest.summary.totalFindings}`)
        yield* Console.log(`  ${chalk.gray("Files scanned:")} ${latest.summary.totalFiles}`)

        if (latest.delta) {
          yield* Console.log(
            `  ${chalk.gray("Delta:")} ${formatDelta(latest.delta.errors)} errors, ${formatDelta(latest.delta.warnings)} warnings`
          )
        }

        yield* Console.log("")
      }

      return 0
    }).pipe(
      Effect.catchAll((error: unknown) =>
        Effect.gen(function*() {
          const errorMessage = error instanceof Error ? error.message : String(error)
          yield* Console.error(`❌ Failed to get latest checkpoint: ${errorMessage}`)
          return 1
        })
      )
    )
)

/**
 * CLI command: checkpoints diff <from> [to]
 *
 * Compares two checkpoints and displays the delta. If [to] is omitted,
 * compares [from] to the latest checkpoint.
 *
 * @category CLI Command
 * @since 0.3.0
 */
const checkpointsDiffCommand = Command.make(
  "diff",
  {
    ampOut: ampOutOption(),
    fromId: Args.text({ name: "from-checkpoint-id" }).pipe(
      Args.withDescription("Starting checkpoint ID")
    ),
    toId: Args.text({ name: "to-checkpoint-id" }).pipe(
      Args.optional,
      Args.withDescription("Ending checkpoint ID (default: latest)")
    )
  },
  ({ ampOut, fromId, toId }) =>
    Effect.gen(function*() {
      const fromCheckpoint = yield* readCheckpoint(ampOut, fromId)

      // If toId not provided, use latest
      const toCheckpoint = yield* Option.match(toId, {
        onNone: () =>
          Effect.gen(function*() {
            const latestOption = yield* getLatestCheckpoint(ampOut)
            if (Option.isNone(latestOption)) {
              return yield* Effect.fail(new Error("No latest checkpoint found"))
            }
            return yield* readCheckpoint(ampOut, latestOption.value.timestamp)
          }),
        onSome: id => readCheckpoint(ampOut, id)
      })

      const fromSummary = fromCheckpoint.normalized.summary
      const toSummary = toCheckpoint.normalized.summary

      // Calculate deltas
      const errorDelta = toSummary.errors - fromSummary.errors
      const warningDelta = toSummary.warnings - fromSummary.warnings
      const totalDelta = toSummary.totalFindings - fromSummary.totalFindings

      // Display comparison
      yield* Console.log(chalk.bold("\nCheckpoint Comparison:\n"))
      yield* Console.log(`  ${chalk.gray("From:")} ${fromCheckpoint.checkpointId}`)
      yield* Console.log(`  ${chalk.gray("To:")}   ${toCheckpoint.checkpointId}`)
      yield* Console.log("")
      yield* Console.log(
        `  ${chalk.gray("Errors:")}   ${fromSummary.errors} → ${toSummary.errors} (${formatDelta(errorDelta)})`
      )
      yield* Console.log(
        `  ${chalk.gray("Warnings:")} ${fromSummary.warnings} → ${toSummary.warnings} (${formatDelta(warningDelta)})`
      )
      yield* Console.log(
        `  ${chalk.gray("Total:")}    ${fromSummary.totalFindings} → ${toSummary.totalFindings} (${formatDelta(totalDelta)})`
      )
      yield* Console.log("")

      return 0
    }).pipe(
      Effect.catchAll((error: unknown) =>
        Effect.gen(function*() {
          const errorMessage = error instanceof Error ? error.message : String(error)
          yield* Console.error(`❌ Failed to compare checkpoints: ${errorMessage}`)
          yield* Console.error(`   Use 'checkpoints list' to see available checkpoint IDs`)
          return 1
        })
      )
    )
)

/**
 * Root checkpoints command with subcommands.
 *
 * Parent command for checkpoint management. Use with subcommands:
 * - `checkpoints list`: List all checkpoints
 * - `checkpoints show <id>`: Show checkpoint details
 * - `checkpoints latest`: Show latest checkpoint
 * - `checkpoints diff <from> [to]`: Compare checkpoints
 *
 * @category CLI Command
 * @since 0.3.0
 */
export const checkpointsCommand = Command.make("checkpoints", {}, () =>
  Effect.gen(function*() {
    yield* Console.log(
      "Usage: effect-migrate checkpoints <command>\n\nCommands:\n  list     List all checkpoints\n  show     Show checkpoint details\n  latest   Show latest checkpoint\n  diff     Compare checkpoints"
    )
    return 0
  })).pipe(
  Command.withSubcommands([
    checkpointsListCommand,
    checkpointsShowCommand,
    checkpointsLatestCommand,
    checkpointsDiffCommand
  ])
)
```

**Lines of Code:** ~320 LOC

---

### Phase 2: Integration with Main CLI (15 minutes)

#### File: `packages/cli/src/index.ts`

**Changes:**

```diff
// Add import
+ import { checkpointsCommand } from "./commands/checkpoints.js"

// Add to subcommands
const rootCommand = Command.make("effect-migrate", {
  version: "0.3.0"
}).pipe(
  Command.withSubcommands([
    auditCommand,
    metricsCommand,
    docsCommand,
    initCommand,
    threadCommand,
+   checkpointsCommand
  ])
)
```

---

### Phase 3: Update Audit Command Output (15 minutes)

#### File: `packages/cli/src/commands/audit.ts`

**Purpose:** Log checkpoint information after successful audit.

**Changes:**

```diff
// After checkpoint creation
+ if (ampOut) {
+   yield* Console.log(`\n${chalk.green("✓")} Checkpoint created: ${checkpointId}`)
+   yield* Console.log(`  ${chalk.gray("Location:")} ${ampOut}/checkpoints/${checkpointId}.json`)
+   
+   if (threadId) {
+     yield* Console.log(`  ${chalk.gray("Thread:")} ${threadId}`)
+   }
+   
+   if (previousSummary) {
+     const errorDelta = summary.errors - previousSummary.errors
+     const warningDelta = summary.warnings - previousSummary.warnings
+     
+     if (errorDelta !== 0 || warningDelta !== 0) {
+       yield* Console.log(
+         `  ${chalk.gray("Delta:")} ${formatDelta(errorDelta)} errors, ${formatDelta(warningDelta)} warnings`
+       )
+     }
+   }
+   
+   yield* Console.log("")
+ }
```

---

### Phase 4: Add cli-table3 Dependency (5 minutes)

#### File: `packages/cli/package.json`

**Changes:**

```diff
{
  "dependencies": {
    "@effect/cli": "^0.71.0",
    "@effect/platform": "^0.92.1",
    "@effect/platform-node": "^0.98.4",
    "chalk": "^5.3.0",
+   "cli-table3": "^0.6.5",
    "effect": "^3.18.4"
  },
  "devDependencies": {
+   "@types/cli-table3": "^0.6.5",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.2",
    "vitest": "^2.0.0"
  }
}
```

---

## Testing

### Unit Tests

**File:** `packages/cli/test/commands/checkpoints.test.ts`

```typescript
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { NodeContext } from "@effect/platform-node"
import { checkpointsCommand } from "../../src/commands/checkpoints.js"
import { createCheckpoint } from "../../src/amp/checkpoint-manager.js"

describe("checkpoints command", () => {
  it.effect("should list checkpoints", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const testDir = path.join(process.cwd(), ".amp-test", "checkpoints-list")

      // Create test checkpoints
      const checkpoint1 = {
        /* ... */
      }
      const checkpoint2 = {
        /* ... */
      }

      yield* createCheckpoint(testDir, checkpoint1)
      yield* createCheckpoint(testDir, checkpoint2)

      // Run list command
      const result = yield* Command.run(checkpointsCommand, {
        name: "effect-migrate",
        version: "0.3.0",
        args: ["list", "--amp-out", testDir]
      })

      expect(result).toBe(0)
    }).pipe(Effect.provide(NodeContext.layer))
  )

  it.effect("should show specific checkpoint", () =>
    Effect.gen(function*() {
      // Test show command
    }).pipe(Effect.provide(NodeContext.layer))
  )

  it.effect("should show latest checkpoint", () =>
    Effect.gen(function*() {
      // Test latest command
    }).pipe(Effect.provide(NodeContext.layer))
  )

  it.effect("should diff two checkpoints", () =>
    Effect.gen(function*() {
      // Test diff command
    }).pipe(Effect.provide(NodeContext.layer))
  )
})
```

**Lines of Code:** ~150 LOC

---

### Manual Testing

**Workflow:**

```bash
# 1. Run first audit
pnpm effect-migrate audit --amp-out .amp/effect-migrate

# 2. Verify checkpoint created
pnpm effect-migrate checkpoints list

# Expected output:
# ┌──────────────────────┬────────┬────────┬──────────┬────────┬───────────────┐
# │ Timestamp            │ Thread │ Errors │ Warnings │ Total  │ Delta (E/W)   │
# ├──────────────────────┼────────┼────────┼──────────┼────────┼───────────────┤
# │ 2025-11-06 10:00:00  │ —      │ 45     │ 120      │ 165    │ —             │
# └──────────────────────┴────────┴────────┴──────────┴────────┴───────────────┘

# 3. Show latest
pnpm effect-migrate checkpoints latest

# Expected output:
# Latest Checkpoint:
#   ID: 2025-11-06T10-00-00Z
#   Time: 2025-11-06 10:00:00
#   Errors: 45
#   Warnings: 120
#   Total findings: 165
#   Files scanned: 50

# 4. Fix some issues, run audit again
# (make fixes...)
pnpm effect-migrate audit --amp-out .amp/effect-migrate

# Expected output:
# ✓ Checkpoint created: 2025-11-06T11-30-00Z
#   Location: .amp/effect-migrate/checkpoints/2025-11-06T11-30-00Z.json
#   Delta: -15 errors, -20 warnings

# 5. List again to see delta
pnpm effect-migrate checkpoints list

# Expected output:
# ┌──────────────────────┬────────┬────────┬──────────┬────────┬───────────────┐
# │ Timestamp            │ Thread │ Errors │ Warnings │ Total  │ Delta (E/W)   │
# ├──────────────────────┼────────┼────────┼──────────┼────────┼───────────────┤
# │ 2025-11-06 11:30:00  │ —      │ 30     │ 100      │ 130    │ -15 / -20     │
# │ 2025-11-06 10:00:00  │ —      │ 45     │ 120      │ 165    │ —             │
# └──────────────────────┴────────┴────────┴──────────┴────────┴───────────────┘

# 6. Compare checkpoints
pnpm effect-migrate checkpoints diff 2025-11-06T10-00-00Z 2025-11-06T11-30-00Z

# Expected output:
# Checkpoint Comparison:
#   From: 2025-11-06T10-00-00Z
#   To:   2025-11-06T11-30-00Z
#
#   Errors:   45 → 30 (-15)
#   Warnings: 120 → 100 (-20)
#   Total:    165 → 130 (-35)

# 7. Show specific checkpoint
pnpm effect-migrate checkpoints show 2025-11-06T10-00-00Z

# Expected output: Full JSON checkpoint
```

---

## Integration

### With Existing Systems

1. **checkpoint-manager.ts**: Already provides all necessary functions (`listCheckpoints`, `getLatestCheckpoint`, `readCheckpoint`)
2. **@effect/cli**: Follow patterns from `thread.ts` command
3. **ampOutOption**: Reuse from `constants.ts` for consistency
4. **Error handling**: Follow Effect patterns with `catchAll`

### Files Affected

**New:**
- `packages/cli/src/commands/checkpoints.ts` (~320 LOC)
- `packages/cli/test/commands/checkpoints.test.ts` (~150 LOC)

**Modified:**
- `packages/cli/src/index.ts` (2 lines added)
- `packages/cli/src/commands/audit.ts` (~15 lines added)
- `packages/cli/package.json` (2 dependencies added)

**Total:** ~470 new LOC + ~20 modified LOC

---

## Success Criteria

### Functional

- [ ] `checkpoints list` displays table with all checkpoints
- [ ] `checkpoints list --json` outputs valid JSON
- [ ] `checkpoints list --limit N` shows only N checkpoints
- [ ] `checkpoints show <id>` displays full checkpoint JSON
- [ ] `checkpoints latest` shows most recent checkpoint summary
- [ ] `checkpoints latest --json` outputs JSON format
- [ ] `checkpoints diff <from> <to>` compares two checkpoints correctly
- [ ] `checkpoints diff <from>` defaults to latest for `to`
- [ ] `audit` command logs checkpoint info on success
- [ ] Delta values show correct sign and color (green=decrease, red=increase)

### Error Handling

- [ ] Invalid checkpoint ID shows helpful error
- [ ] Missing checkpoints directory handled gracefully
- [ ] Empty checkpoint list displays "No checkpoints found"
- [ ] Missing `to` checkpoint in diff uses latest

### UX

- [ ] Table output is clean and aligned
- [ ] Colors enhance readability (not required for functionality)
- [ ] Error messages are actionable
- [ ] JSON output is valid and pretty-printed
- [ ] Command help text is clear

### Tests

- [ ] All unit tests pass
- [ ] Integration tests cover all commands
- [ ] Manual testing workflow succeeds
- [ ] `pnpm build` succeeds
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

---

## Documentation

### CLI Help Text

Each command already includes help via `@effect/cli`:

```bash
$ effect-migrate checkpoints --help
Usage: effect-migrate checkpoints <command>

Commands:
  list     List all checkpoints
  show     Show checkpoint details
  latest   Show latest checkpoint
  diff     Compare checkpoints

$ effect-migrate checkpoints list --help
Usage: effect-migrate checkpoints list [options]

Options:
  --amp-out <path>  Path to Amp context directory (default: .amp/effect-migrate)
  --json            Output as JSON instead of table
  --limit <number>  Limit number of checkpoints shown
```

### README Updates

Add to `packages/cli/README.md`:

```markdown
## Checkpoint Management

View and compare audit checkpoints over time:

### List Checkpoints

```bash
effect-migrate checkpoints list
```

### Show Latest

```bash
effect-migrate checkpoints latest
```

### Compare Checkpoints

```bash
effect-migrate checkpoints diff 2025-11-06T10-00-00Z 2025-11-06T14-15-00Z
```

### Show Specific Checkpoint

```bash
effect-migrate checkpoints show 2025-11-06T10-00-00Z
```
```

---

## Risks and Mitigations

### Risk 1: cli-table3 Formatting Issues

**Scenario:** Terminal width too narrow, table wraps badly

**Mitigation:**
- Use fixed column widths (already in implementation)
- Provide `--json` alternative for scripts/CI
- Test on various terminal sizes

### Risk 2: Large Checkpoint Lists

**Scenario:** 100+ checkpoints, table scrolls off screen

**Mitigation:**
- Default to showing last 20 checkpoints (add to implementation)
- Provide `--limit` option (already in implementation)
- Add `--all` flag to override limit

### Risk 3: Timestamp Parsing Differences

**Scenario:** Checkpoint IDs use ISO format, user expects local time

**Mitigation:**
- Display both ISO timestamp and formatted time
- Add timezone-aware formatting
- Document timestamp format in help text

---

## Future Enhancements

### Checkpoint Filtering

```bash
# Filter by thread
effect-migrate checkpoints list --thread T-abc123

# Filter by date range
effect-migrate checkpoints list --since "2025-11-01" --until "2025-11-06"

# Filter by error count
effect-migrate checkpoints list --min-errors 50
```

### Progress Visualization

```bash
# ASCII chart of progress
effect-migrate checkpoints chart

Errors over time:
  45 ┤           ╭──
  40 ┤       ╭───╯
  35 ┤     ╭─╯
  30 ┤   ╭─╯
  25 ┤ ╭─╯
  20 ┼─╯
     └──────────────────
     10:00  11:30  14:15
```

### Checkpoint Deletion

```bash
# Delete old checkpoints
effect-migrate checkpoints clean --keep 30

# Delete specific checkpoint
effect-migrate checkpoints delete 2025-11-06T10-00-00Z
```

---

## Files Summary

**New files:**

- `packages/cli/src/commands/checkpoints.ts` (~320 LOC)
- `packages/cli/test/commands/checkpoints.test.ts` (~150 LOC)

**Modified files:**

- `packages/cli/src/index.ts` (+2 lines: import and register command)
- `packages/cli/src/commands/audit.ts` (+15 lines: log checkpoint info)
- `packages/cli/package.json` (+4 lines: cli-table3 dependency and types)

**Dependencies added:**

- `cli-table3`: ^0.6.5
- `@types/cli-table3`: ^0.6.5

---

**Last Updated:** 2025-11-06  
**Maintainer:** @aridyckovsky  
**Status:** Ready for implementation  
**Thread:** https://ampcode.com/threads/T-5bd34c50-9752-4d71-8768-e8290de2c380
