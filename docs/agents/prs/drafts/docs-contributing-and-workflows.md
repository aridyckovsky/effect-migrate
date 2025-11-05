---
created: 2025-11-05
lastUpdated: 2025-11-05
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-8e4ffec8-e44d-4bfa-85c8-39f43aeadba8
audience: Development team and reviewers
tags: [pr-draft, contributing, workflows, documentation, github, codeowners]
---

# PR Draft: docs(contributing): add contribution guidelines and Git workflows

## What

Adds comprehensive contribution guidelines for human developers (`CONTRIBUTING.md`) and Git/GitHub workflows for AI agents (`AGENTS.md`), establishing clear standards for branching, PR process, testing, and code quality.

## Why

**Problem:** The project lacked structured onboarding documentation for contributors (both human and AI). Contributors needed clear guidance on:

- Development setup and workflow
- Branching strategy and PR process
- Testing requirements and code standards
- Changesets workflow
- AI agent-specific rules and constraints

**Solution:** Create dedicated documentation that separates human-focused contribution guides from AI agent-specific workflow rules, while maintaining consistency between both.

## Scope

**Packages affected:**

- Repository-wide documentation and configuration
- No runtime code changes

**Files:**

**New files:**

- `CONTRIBUTING.md` - Human contributor guide (390 lines)
- `.github/CODEOWNERS` - Code ownership definitions (28 lines)
- `docs/agents/prs/reviews/amp/feat-contributing-and-workflows.md` - Self-review document (270 lines)

**Modified files:**

- `AGENTS.md` - Added Git and GitHub Workflows section (506 lines added)
- `docs/agents/AGENTS.md` - Updated references and release workflow notes (5 lines changed)
- `docs/agents/plans/contributing-and-workflows.md` - Updated status to `complete` (6 lines changed)
- `.vscode/settings.json` - Added CODEOWNERS file association (14 lines changed)
- `.prettierignore` - Added CODEOWNERS to ignore list (3 lines added)

## Key Changes

### 1. CONTRIBUTING.md (New File)

Primary guide for human contributors covering setup, workflow, branching strategy, PR process, testing, changesets, and code standards.

### 2. AGENTS.md - Git and GitHub Workflows Section (New Section)

AI agent-specific workflow rules including branching, commits, PR process, and 5 strict restrictions (one bug per PR, never push to main, etc.). Includes complete workflow examples and conflict resolution guidance.

**Review improvements:**

- Clarified thread recording is manual until CLI command implemented
- Replaced placeholder UUIDs with concrete examples

### 3. .github/CODEOWNERS (New File)

Defines code ownership for automated review assignments (default `@aridyckovsky`, package-specific owners).

### 4. VS Code and Prettier Configuration

- Added CODEOWNERS file association as plaintext
- Added CODEOWNERS to Prettier ignore list

### 5. Plan Document Update

Updated `docs/agents/plans/contributing-and-workflows.md` status to `complete` and aligned branch naming with Conventional Commits.

## Changeset

- [ ] No changeset needed (documentation-only changes, no package versions affected)

## Testing

### Pre-commit checks:

```bash
pnpm build:types  # ✅ Passed
pnpm typecheck    # ✅ Passed
pnpm lint         # ✅ Passed
pnpm build        # ✅ Passed
pnpm test         # ✅ Passed
```

### Manual verification:

- [x] CONTRIBUTING.md renders correctly on GitHub
- [x] AGENTS.md formatting and links work
- [x] CODEOWNERS syntax is valid (GitHub recognizes ownership)
- [x] VS Code recognizes CODEOWNERS as plaintext
- [x] Prettier ignores CODEOWNERS file
- [x] All internal documentation links are valid
- [x] Frontmatter in all docs/agents files follows standards

### Review process:

- [x] Self-review completed via Oracle analysis
- [x] Review document created: `docs/agents/prs/reviews/amp/feat-contributing-and-workflows.md`
- [x] High and medium priority improvements implemented:
  - Clarified thread recording section in AGENTS.md
  - Replaced placeholder UUIDs with examples
  - Added Effect-TS patterns checklist to CONTRIBUTING.md
  - Added Agent Context explanation comment

## Checklist

- [x] Code follows Effect-TS best practices:
  - Used Effect.gen for sequential operations
  - Defined errors with Data.TaggedError
  - Managed resources with acquireRelease; used Effect.scoped where appropriate
  - See [AGENTS.md](./AGENTS.md#effect-ts-best-practices) for details
- [x] TypeScript strict mode passes
- [x] All tests pass
- [x] Linter passes
- [x] Build succeeds
- [x] No changeset needed (documentation only)
- [x] Documentation is comprehensive and accurate
- [x] All internal links verified
- [x] YAML frontmatter follows standards
- [x] Self-review completed with Oracle

## Agent Context (optional, for AI agents)

<!-- This section helps AI agents understand implementation decisions, trade-offs, and context. Human contributors can skip. -->

**Implementation approach:**

1. **CONTRIBUTING.md creation:**
   - Researched best practices for open-source contribution guidelines
   - Aligned branching strategy with industry standards (Conventional Commits, linear history)
   - Structured PR template to capture all necessary context for reviews
   - Included troubleshooting section based on common pnpm/monorepo issues

2. **AGENTS.md Git workflows section:**
   - Extended existing AGENTS.md with comprehensive Git/GitHub rules
   - Created strict AI agent restrictions to prevent common mistakes (e.g., multiple bugs in one PR)
   - Provided multiple workflow examples (parallel PRs, conflict resolution)
   - Clarified planned vs. implemented features (thread recording CLI command)

3. **CODEOWNERS setup:**
   - Defined ownership structure matching monorepo organization
   - Set default owner for all files with package-specific overrides
   - Ensures automated review requests for appropriate maintainers

4. **Review-driven improvements:**
   - Used Oracle to analyze completeness and clarity
   - Created self-review document following docs/agents/AGENTS.md guidelines
   - Addressed all high/medium priority suggestions before finalizing PR
   - Kept low-priority items optional (already included for completeness)

**Design decisions:**

- **Separation of concerns:** CONTRIBUTING.md for humans, AGENTS.md section for AI agents (reduces cognitive load for each audience)
- **Consistency:** Both documents use same branching strategy and PR process (single source of truth)
- **Actionable examples:** Included complete workflow examples in AGENTS.md (agents can copy/adapt commands)
- **Future-proofing:** Noted planned `thread` CLI command but provided manual workflow until implementation

**Trade-offs:**

- **Documentation length:** Comprehensive docs are verbose but reduce ambiguity and onboarding friction
- **Duplication:** Some overlap between CONTRIBUTING.md and AGENTS.md, but each optimized for its audience
- **Manual thread recording:** Not ideal, but acceptable until CLI command implemented (avoids blocking this PR on feature work)

**Amp Thread(s):**

- https://ampcode.com/threads/T-8e4ffec8-e44d-4bfa-85c8-39f43aeadba8 (implementation thread)

**Related docs:**

- @docs/agents/plans/contributing-and-workflows.md (implementation plan, now complete)
- @docs/agents/AGENTS.md (meta-documentation for agent docs)
- @docs/agents/prs/reviews/amp/feat-contributing-and-workflows.md (self-review)

---

## PR Title

```
docs(contributing): add contribution guidelines and Git workflows
```

## Commit Message (for squash merge)

```
docs(contributing): add contribution guidelines and Git workflows

- Add CONTRIBUTING.md with setup, workflow, branching, PR process
- Add Git and GitHub Workflows section to AGENTS.md for AI agents
- Add .github/CODEOWNERS for automated review assignments
- Configure VS Code and Prettier for CODEOWNERS file
- Update contributing plan status to complete

Includes self-review and Oracle-suggested improvements:
- Clarified thread recording workflow (manual until CLI implemented)
- Added Effect-TS patterns checklist to PR template
- Replaced placeholder UUIDs with examples
```
