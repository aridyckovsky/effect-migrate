---
created: 2025-11-04
lastUpdated: 2025-11-04
author: Generated via Amp (Oracle + AI analysis)
status: complete
thread: https://ampcode.com/threads/T-38c593cf-0e0f-4570-ad73-dfc2c3b1d6c9
audience: Migration developers and Amp coding agents
related: ../plans/thread-command.md
---

# Amp + effect-migrate Integration Guide

---

## TL;DR

- **effect-migrate** writes a persistent migration "source of truth" to `.amp/effect-migrate`. Amp agents load it by @-mention (e.g., "Read @.amp/effect-migrate/index.json") or via links in AGENTS.md.
- Agents should drive work from this context: prioritize files, apply Effect patterns, call the CLI to regenerate artifacts, and record thread links.
- Use Amp thread sharing and read-thread to coordinate across sessions and teammates; prefer CLI regeneration over hand-editing context files.

---

## Why Amp + effect-migrate

Effect migrations are iterative and cross-cutting. Without a shared memory, each Amp thread re-learns constraints and prior decisions. **effect-migrate** eliminates reset-cost by:

- Persisting migration state and findings in `.amp/effect-migrate`
- Guiding agents to use Effect-TS patterns and boundaries
- Tracking progress and threads, so work resumes seamlessly across sessions and collaborators

With Amp:

- Agents auto-load project guidance from AGENTS.md and can read `.amp` context on demand via @-mentions
- Developers and agents share threads, reuse past analysis via `read-thread`, and script flows through the Amp CLI/SDK

**Value for teams:**

- ✅ Less repetition explaining the migration plan
- ✅ Consistent, Effect-first recommendations
- ✅ Traceable progress and decisions across threads
- ✅ Easy handoffs between teammates and across time zones

---

## Context Architecture

How Amp sees your repo and the effect-migrate context:

### AGENTS.md autoload

Amp automatically searches for AGENTS.md starting from the working directory up through parents and user config (e.g., `~/.config/amp/AGENTS.md`). When found, it's loaded into context. Files @-mentioned inside AGENTS.md are also loaded.

### @-mentions (file references)

In any thread, "@" lets users/agents reference files by path or fuzzy pattern (e.g., `@.amp/effect-migrate/context.json` or `@**/effect-migrate/*.json`). Amp reads the referenced files into context. Code blocks don't trigger @-mentions.

### .amp directory (convention)

**effect-migrate** writes migration context under `.amp/effect-migrate`. Amp doesn't auto-scan `.amp`, but it will load any referenced file. **Best practice:** add `@.amp/effect-migrate/index.json` to the repo's AGENTS.md so Amp includes it automatically.

### Thread persistence

Amp threads retain full history: messages, attached files, tool calls, and decisions. Reusing a thread keeps context; starting new threads can reattach context via @-mentions. Shared threads can be referenced by URL or ID and read directly.

### Recommended file layout

Written by effect-migrate CLI:

```
.amp/effect-migrate/
├── index.json     # Entry point and resource index (MCP-compatible)
├── context.json   # High-level migration state summary
├── audit.json     # Findings by file (rules, locations)
├── metrics.json   # Progress and completion aggregates
├── threads.json   # Known thread references (IDs, URLs, tags)
└── badges.md      # Progress badges for docs/readme
```

### Add to root AGENTS.md

```markdown
## Migration Context

See @.amp/effect-migrate/index.json for migration context and resources.
```

Optionally link rule docs, Effect patterns, and team conventions.

---

## Workflow Integration

How developers and agents collaborate using effect-migrate + Amp:

### Workflow Diagram (described)

1. **Developer runs CLI**

   ```bash
   effect-migrate audit --amp-out .amp/effect-migrate
   effect-migrate metrics --amp-out .amp/effect-migrate
   ```

   These commands generate/refresh `index.json`, `context.json`, `audit.json`, `metrics.json`, `threads.json`.

2. **Agent session**
   - Open an Amp thread and load context via `@.amp/effect-migrate/index.json`
   - Agent prioritizes work from metrics/audit and applies Effect refactors

3. **Feedback loop**
   - After edits, Agent or developer runs the CLI again to refresh findings/metrics
   - Agent updates thread references (see Thread management)

4. **Team collaboration**
   - Share thread visibility as appropriate; other agents can "read-thread" prior work
   - New threads can re-attach the same `.amp` context via @-mentions

### Agent operational checklist

- **Load:** `@AGENTS.md` (auto), then `@.amp/effect-migrate/index.json`
- **Understand scope:** `context.json.migrationState`, `metrics.json.progress`, `audit.json.summary`
- **Pick targets:** `audit.json.findings` sorted by severity and effort tags
- **Use Effect patterns:** convert async/await, Promise, try/catch; enforce boundary rules (@effect/platform, Effect Layers)
- **Regenerate:** run `effect-migrate audit/metrics` to refresh `.amp` artifacts (prefer CLI over manual edits)
- **Record thread:** add URL/ID to `threads.json` (or ask developer to run `effect-migrate thread add <url>`)
- **Hand off:** set visibility and note next steps in the thread

---

## Context Formats

These schemas describe how agents should read effect-migrate context. **The CLI is the source of truth**; agents should not hand-edit JSON—regenerate via commands.

### 1. index.json (MCP-compatible resource index)

**Purpose:** Single entry point that lists all context artifacts with basic metadata. Intended for simple resource discovery and future MCP server alignment.

**Example:**

```json
{
  "version": 1,
  "generatedAt": "2025-01-03T10:00:00Z",
  "projectPath": "/abs/path/to/project",
  "resources": [
    {
      "id": "context",
      "path": ".amp/effect-migrate/context.json",
      "kind": "context",
      "mime": "application/json",
      "title": "Migration context"
    },
    {
      "id": "audit",
      "path": ".amp/effect-migrate/audit.json",
      "kind": "report",
      "mime": "application/json",
      "title": "Audit findings"
    },
    {
      "id": "metrics",
      "path": ".amp/effect-migrate/metrics.json",
      "kind": "metrics",
      "mime": "application/json",
      "title": "Migration metrics"
    },
    {
      "id": "threads",
      "path": ".amp/effect-migrate/threads.json",
      "kind": "links",
      "mime": "application/json",
      "title": "Related Amp threads"
    },
    {
      "id": "badges",
      "path": ".amp/effect-migrate/badges.md",
      "kind": "doc",
      "mime": "text/markdown",
      "title": "Status badges"
    }
  ]
}
```

**Agent use:** Always open `index.json` first; then load listed resources as needed via @-mention.

### 2. context.json (high-level state)

**Example:**

```json
{
  "version": 1,
  "timestamp": "2025-01-03T10:00:00Z",
  "projectPath": "/Users/you/project",
  "migrationState": {
    "phase": "pattern-detection",
    "completedModules": ["src/models/user.ts"],
    "pendingModules": ["src/api/fetchUser.ts"]
  },
  "ruleset": {
    "preset": "@effect-migrate/preset-basic",
    "enabledRuleIds": ["no-async-await", "no-direct-node-imports"],
    "boundaries": ["no-node-in-services"]
  },
  "findings": {
    "summary": {
      "errors": 1,
      "warnings": 3,
      "totalFiles": 24,
      "migratedFiles": 16,
      "progress": 67
    }
  },
  "recommendations": [
    "Convert async/await to Effect.gen",
    "Replace node:fs with @effect/platform/FileSystem"
  ]
}
```

**Agent use:** Orient to phase, prioritize `pendingModules`, follow recommendations.

### 3. audit.json (detailed findings)

**Shape:**

```json
{
  "version": 1,
  "timestamp": "...",
  "rules": [
    {
      "id": "no-async-await",
      "severity": "warning",
      "docsUrl": "https://effect.website/docs/guides/essentials/async",
      "results": [
        {
          "file": "src/api/fetchUser.ts",
          "message": "Replace async/await with Effect.gen",
          "range": {
            "start": { "line": 23, "column": 1 },
            "end": { "line": 27, "column": 1 }
          },
          "tags": ["async", "migration-required"]
        }
      ]
    }
  ]
}
```

**Agent use:** Triage by severity, group by file, apply fixes; link `docsUrl` for rationale.

### 4. metrics.json (progress)

**Shape:**

```json
{
  "version": 1,
  "timestamp": "...",
  "progress": {
    "migratedFiles": 160,
    "totalFiles": 240,
    "percentage": 66.7,
    "byDirectory": [
      {
        "path": "src/api",
        "migrated": 42,
        "total": 60,
        "percentage": 70.0
      }
    ]
  },
  "badges": {
    "overall": "![migration:66%](...)"
  }
}
```

**Agent use:** Use overall percentage and hotspots (`byDirectory`) to pick high ROI work.

### 5. threads.json (thread registry)

**Shape:**

```json
{
  "version": 1,
  "threads": [
    {
      "id": "T-2e877789-12a8-41af-ad0b-de1361897ea8",
      "url": "https://ampcode.com/threads/T-2e877789-12a8-41af-ad0b-de1361897ea8",
      "title": "Migrate src/api/fetchUser.ts",
      "scope": ["src/api/fetchUser.ts"],
      "visibility": "workspace-shared",
      "tags": ["migration", "api"],
      "lastUpdated": "2025-01-03T12:00:00Z"
    }
  ]
}
```

**Agent use:** Post new thread links here (via CLI command or dev assistance), reuse past threads with `read-thread`, keep scope tags accurate.

### Compatibility notes

- **MCP alignment:** `index.json` intentionally mirrors a resource catalog (id, path, kind, mime). A future MCP server can expose these as `mcp/resources`.
- Agents should treat these formats as **read-only**; regenerate via CLI.

---

## Thread Management

How to track migration work across Amp threads:

### Visibility and sharing (Amp manual)

**Levels:** public, unlisted, workspace-shared, group-shared (Enterprise), private.

**Set via:** editor/Web UI sharing menu or command palette (`/thread: set visibility`).

### Referencing threads

Use full URL (`https://ampcode.com/threads/T-...`) or ID (`T-...`).

Amp can read other threads via `read-thread`: paste URL/ID and instruct what to extract.

### Recommended practice

- For each significant migration task (file/module), create or continue a focused thread
- Add/refresh entry in `.amp/effect-migrate/threads.json` (or ask a developer to run `effect-migrate thread add <url>`)
- Use visibility `workspace-shared` by default for team collaboration

### Agent snippet (in-thread)

```
Read T-95e73a95-f4fe-4f22-8d5c-6297467c97a5 to extract the plan and decisions.
Apply the same approach to src/api/fetchUser.ts.
Also load @.amp/effect-migrate/audit.json.
```

---

## Best Practices for Amp Agents

Interpreting and using migration context effectively:

### Trust but verify

Treat CLI-generated context as source of truth. If code and `audit.json` disagree, prefer rerunning the CLI to refresh context.

### Effect-first fixes

- Convert `async/await` to `Effect.gen` with `yield*`
- Replace `new Promise` with `Effect.async` or `Effect.tryPromise`
- Replace `try/catch` with `Effect.catchAll`/`Effect.catchTag`
- Replace `throw` with `Effect.fail`/`Data.TaggedError`

### Boundaries

- Replace `node:*` imports with `@effect/platform` services (FileSystem, Path, Command)
- Avoid `Effect.runPromise` in library code; return Effects

### Incremental migration

Favor small PRs per module; add explicit boundary shims; reduce blast radius.

### Use language tooling

- Effect Language Service refactors (`async` → `Effect.gen`)
- ESLint plugin rules (`@effect/*`)
- `@effect/schema` for validations

### Performance

Maintain lazy file reads and concurrency limits as per core AGENTS.md. Avoid whole-repo reads in fixes.

### Regenerate, don't hand-edit

After changes, run `effect-migrate audit/metrics` to update `.amp` artifacts; avoid manual JSON edits.

### Thread hygiene

Link the thread in `threads.json`; set visibility; summarize what changed and next steps.

---

## Examples

Real-world scenarios for Amp agent usage:

### A) Single file migration using context

**1. Load context**

```
Read @.amp/effect-migrate/index.json
Open @.amp/effect-migrate/audit.json and filter for src/api/fetchUser.ts
```

**2. Apply fixes (example)**

**Before (async/await):**

```typescript
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) throw new Error("Request failed")
  return res.json()
}
```

**After (Effect.gen):**

```typescript
import { Effect } from "effect"

const fetchUser = (id: string) =>
  Effect.gen(function* () {
    const res = yield* HttpClient.get(`/api/users/${id}`)
    if (!res.ok) {
      return yield* Effect.fail(new RequestError({ status: res.status }))
    }
    return yield* res.json()
  })
```

**3. Refresh artifacts**

Ask the developer (or use tooling) to run:

```bash
effect-migrate audit --amp-out .amp/effect-migrate
effect-migrate metrics --amp-out .amp/effect-migrate
```

**4. Record thread**

```
Please add this thread to .amp/effect-migrate/threads.json
(or run: effect-migrate thread add <this-thread-url>).
Set visibility to workspace-shared.
```

### B) Continue from a prior thread

```
Read https://ampcode.com/threads/T-2e877789-12a8-41af-ad0b-de1361897ea8
and extract the remaining TODOs. Load @.amp/effect-migrate/metrics.json
and propose the next 3 modules to migrate for the biggest progress gains.
```

### C) Audit-driven prioritization

```
From @.amp/effect-migrate/audit.json, list all no-direct-node-imports errors.
For each, propose the @effect/platform equivalent and a minimal refactor plan.
Then update a checklist in this thread.
```

---

## Amp CLI and SDK Integration

For scripting and programmatic flows around effect-migrate:

### CLI patterns (Amp manual)

**Execute mode:**

```bash
amp -x "Analyze audit.json and propose a plan"
echo "commit all my changes" | amp -x
```

Use `--dangerously-allow-all` with care if tools must auto-run.

**Stream JSON (programmatic):**

```bash
amp --execute "Plan next steps" --stream-json
echo "..." | amp --execute --stream-json --stream-json-input
```

**Permissions:**

```bash
amp tools list              # see available tools
amp permissions edit|test|list  # gate tool usage
```

**Context location:** Amp auto-loads AGENTS.md; load `.amp/effect-migrate/*` by @-mention or by adding links to AGENTS.md.

### SDK (TypeScript) overview (Amp manual)

- **`execute(options)`**: AsyncIterable of streamed messages
- **Options highlights**: `cwd`, `continue` (true or thread ID), `permissions`, `dangerouslyAllowAll`
- **Streamed message types**: `system` (tools/session), `assistant` (text/tool_use), `result/error`
- **Authentication**: `AMP_API_KEY` or `amp login`

### SDK example: drive a single-shot analysis using .amp context

```typescript
import { execute } from "@sourcegraph/amp-sdk"

async function proposeNextSteps(cwd: string) {
  const prompt = [
    "Load @.amp/effect-migrate/index.json",
    "Read @.amp/effect-migrate/metrics.json and @.amp/effect-migrate/audit.json",
    "Propose the 3 highest-impact modules to migrate next, referencing rule severities and byDirectory hotspots."
  ].join("\n")

  for await (const msg of execute({ prompt, options: { cwd, continue: false } })) {
    if (msg.type === "result") {
      console.log(msg.result)
      break
    }
  }
}
```

### SDK example: continue a migration thread

```typescript
async function continueThread(cwd: string, threadId: string) {
  for await (const msg of execute({
    prompt: "Resume. Load @.amp/effect-migrate/context.json and list pendingModules with a plan.",
    options: { cwd, continue: threadId }
  })) {
    if (msg.type === "result") {
      console.log(msg.result)
      break
    }
  }
}
```

**Tip:** Prefer effect-migrate CLI re-generation (audit/metrics) over writing context files directly from SDK.

---

## Integration with Existing AGENTS.md

Make `.amp` context auto-load via AGENTS.md:

### 1. In the repo root AGENTS.md, add:

```markdown
## effect-migrate context

See @.amp/effect-migrate/index.json for migration context and resources.

Brief project rules:

- Use Effect.gen for sequencing
- No node:\* in services
- Prefer @effect/platform
```

### 2. In package-specific AGENTS.md (core/cli/preset-basic):

- Cross-link the root AGENTS.md and reiterate rule subsets relevant to each package
- For the CLI package, note `amp-out` behavior and where it writes files

### 3. In team AGENTS.md (e.g., ~/.config/amp/AGENTS.md):

- Add org-wide conventions and links to Effect docs

**Result:** Any Amp thread in this repo pulls in both general guidance and the live migration context.

---

## Effect-TS Patterns Reference

Key conversions agents will perform:

### Async to Effect

- `async/await` → `Effect.gen`/`yield*`
- `new Promise` → `Effect.async` / `Effect.tryPromise`
- `Promise.all` → `Effect.all` / `Effect.allWith`
- `Promise.race` → `Effect.race` / `Effect.raceFirst`
- `.then/.catch` chains → `Effect.flatMap`/`Effect.catchAll`

### Errors

- `throw` → `Effect.fail(Data.TaggedError)`
- Specific handlers → `Effect.catchTag` / `Effect.catchAll`

### Boundaries

- `node:*` → `@effect/platform` (FileSystem, Path, Command)
- Library code must not run effects (no `Effect.runPromise`) — return Effects instead

### Services/Layers

- Use `Context.Tag` services and Layer provisioning; avoid global singletons

### Resource safety

- `Effect.acquireRelease` and `Effect.scoped` for lifecycles

### Tooling

- Effect Language Service refactors and diagnostics
- ESLint plugin rules (`@effect/*`)
- `@effect/schema` for config/data validation

---

## Safety, Risks, and Guardrails

### Don't mutate context files by hand

Agents should prefer running effect-migrate CLI to regenerate context; manual edits risk drift.

### Permission hygiene

When using Amp CLI/SDK to run shell commands, respect permission policies; avoid `--dangerously-allow-all` unless necessary and approved.

### Large repos

Avoid full-repo loads; leverage `audit.json` scopes and `byDirectory` metrics to keep work bounded.

### False positives

Pattern rules are conservative; confirm before heavy refactors. Use `negativePattern` hints and rule `docsUrl`.

### Thread sprawl

Prefer continuing relevant threads; if forking, link both in `threads.json` and summarize divergence.

---

## Future Roadmap

Deeper Amp integration for effect-migrate:

### Short term

- **Implement effect-migrate thread commands** (planned)
  - `effect-migrate thread add <url> [--scope src/api/*] [--tags migration,api]`
  - `effect-migrate thread list --amp-out .amp/effect-migrate`
- **Enrich index.json**
  - Add resource checksums and sizes for change-detection
  - Add "relationships" (e.g., audit → files) to guide agents

### Medium term

- **Optional MCP server**
  - Expose resources as MCP `mcp/resources`; provide `find/findings` and `get/metrics` tools
  - Offer `mcp/actions` to "refresh audit" and "refresh metrics"
- **Agent codemods**
  - Ship safe codemod suggestions tied to rule IDs; integrate with Effect Language Service refactors

### Long term

- **Cross-repo migration coordination**
  - Workspace-wide `threads.json` with per-repo links
  - Aggregated dashboards of progress across services

### Signals to revisit design

- Teams frequently hand-edit `.amp` JSON → add CLI subcommands or an MCP server
- Many concurrent agents collide on state → adopt locks and event streams, or a server-backed store
- Need richer automation → formalize more actions in MCP and CLI

---

## Appendix: Command and Tooling Cheat Sheet

### effect-migrate

```bash
effect-migrate audit --amp-out .amp/effect-migrate
effect-migrate metrics --amp-out .amp/effect-migrate
effect-migrate docs --amp-out .amp/effect-migrate
effect-migrate thread add <amp-thread-url>  # planned
effect-migrate thread list                   # planned
```

### Amp CLI (manual)

```bash
amp -x "…"                              # single-shot execution
amp --execute --stream-json             # programmatic streaming
amp tools list                          # inspect tools
amp permissions edit|test|list          # manage tool permissions
```

**Sharing:** set via editor/Web UI or `/thread: set visibility`

### Amp read-thread (manual)

Paste thread URL or ID (`T-…`) to read and extract prior context inside an active thread.

---

## References

- **Amp Manual:** https://ampcode.com/manual (CLI, tools, SDK, sharing)
- **Read threads:** https://ampcode.com/news/read-threads
- **Effect docs:** https://effect.website/docs
- **Effect repo:** https://github.com/Effect-TS/effect
- **Language service:** https://github.com/Effect-TS/language-service
- **VS Code extension:** https://github.com/Effect-TS/vscode-extension
- **ESLint plugin:** https://github.com/Effect-TS/eslint-plugin

---

**End of AMP_INTEGRATION.md**
