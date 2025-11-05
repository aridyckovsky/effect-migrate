---
created: 2025-11-05
lastUpdated: 2025-11-05
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-c6507f53-d611-4b1a-ba52-8fa3a68a195b
audience: Development team and reviewers
tags: [pr-draft, bug-fix, amp-context, index-json, threads]
---

# PR Draft: fix(cli): index.json references threads.json when threads exist

## What

Fixes issue #18: index.json now includes a reference to threads.json when threads exist.

## Why

The Amp context index should be the single source of truth for discovering all context files. Previously, threads.json was created but not referenced in index.json, making it harder for MCP consumers to discover thread tracking.

## Scope

- `@effect-migrate/cli`

## Changeset

- [x] Changeset added

**Changeset summary:**

> Include threads.json reference in index.json when threads exist, making thread tracking discoverable through the Amp context index file.

## Testing

```bash
pnpm build:types
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

**New tests:**

- `packages/cli/test/amp/context-writer.test.ts` - Added test verifying index.files.threads is set when threads exist

## Checklist

- [x] Code follows Effect-TS best practices
- [x] TypeScript strict mode passes
- [x] All tests pass
- [x] Linter passes
- [x] Build succeeds
- [x] Changeset created

## Agent Context (for AI agents)

**Implementation approach:**

- Extended AmpContextIndex schema with optional `threads` field
- Updated writeAmpContext to conditionally include threads.json reference when auditThreads.length > 0
- Used exactOptionalPropertyTypes-compatible conditional spreading

**Amp Thread(s):**

- https://ampcode.com/threads/T-c6507f53-d611-4b1a-ba52-8fa3a68a195b

**Related issues:**

- Fixes #18
