---
created: 2025-11-04
lastUpdated: 2025-11-04
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-23c6b2e1-3b55-4b20-9bcb-56a35c41782a
audience: Development team and reviewers
tags: [pr-draft, thread-command, feature-implementation]
---

# Thread Command Feature

Implements `effect-migrate thread add` and `effect-migrate thread list` commands for managing Amp thread references in migration context.

**Branch:** `feat/thread-command`  
**Plan:** [docs/agents/plans/thread-command.md](../../plans/thread-command.md)  
**Commit Plan Thread:** https://ampcode.com/threads/T-2cc22f99-0a74-4866-a906-44e5cafd16bb

---

## Summary

Add thread management CLI commands to track Amp threads with tags/scope metadata. Threads are stored in `.amp/effect-migrate/threads.json` and automatically included in audit context output.

**Total commits:** 10 (4 feature + 6 cleanup/refactor)

---

## Feature Implementation

### Thread Management

**Core Infrastructure:**

- Schema-based validation with case-insensitive URL handling
- Tag/scope merging on duplicates using set union
- Graceful error handling (returns empty on malformed JSON)

**CLI Commands:**

- `thread add --url <url> [--tags x,y] [--scope glob] [--description text]`
- `thread list [--json]`
- Comma-separated parsing with deduplication
- User-friendly console output with status indicators

**Integration:**

- Register thread command as CLI subcommand
- Extend ThreadReference schema with tags/scope fields
- Audit command includes threads array when threads.json exists

---

## Additional Improvements

**Refactor:** Remove redundant NodeFileSystem.layer provision from audit/metrics commands

**Fix:** Improve error messages and path normalization in core services

**Chore:** Migrate to ESM-only builds (remove CommonJS support)

**Chore:** Convert examples to standalone projects outside workspace

**Docs:** Add thread command usage to README

**Chore:** Add effect-migrate.config.ts for self-auditing (dogfooding)

---

## Testing

```bash
pnpm test  # All tests pass (990 new lines)
pnpm build # No type errors
```

---

## Breaking Changes

None - purely additive feature.

---

## Usage

```bash
# Add thread
effect-migrate thread add \
  --url https://ampcode.com/threads/T-abc... \
  --tags migration,api \
  --scope "src/api/*"

# List threads
effect-migrate thread list
effect-migrate thread list --json

# Threads included in audit output
effect-migrate audit --amp-out .amp/effect-migrate
```

---

## Success Criteria

- [ ] URL validation and threads.json write/read
- [ ] Tag/scope merging on duplicates
- [ ] Human-readable and JSON output modes
- [ ] Audit integration (threads in audit.json)
- [ ] Comprehensive test coverage
- [ ] Documentation updated
