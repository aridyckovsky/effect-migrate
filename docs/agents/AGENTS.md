---
created: 2025-11-04
lastUpdated: 2025-11-04
author: Ari Dyckovsky
status: complete
thread: https://ampcode.com/threads/T-38c593cf-0e0f-4570-ad73-dfc2c3b1d6c9
audience: AI coding agents and documentation contributors
---

# Agent Documentation Guide

**Purpose:** Guidelines for creating and maintaining agent-focused documentation in the effect-migrate project.

This directory (`docs/agents/`) contains documentation specifically designed for AI coding agents (like Amp) to understand concepts, follow implementation plans, and learn from past decisions.

---

## Directory Structure

```
docs/agents/
├── AGENTS.md              # This file - meta-documentation
├── concepts/              # Conceptual guides and integration patterns
│   └── amp-integration.md
├── plans/                 # Implementation plans for features
│   └── thread-command.md
├── post-mortem/          # Analysis of abandoned or failed approaches
│   └── (future post-mortems)
└── prs/                   # Pull request documentation
    ├── drafts/            # Draft PR descriptions
    └── reviews/           # PR reviews and analysis
        └── amp/           # Amp-generated reviews
```

---

## Document Types

### Concepts (`concepts/`)

**Purpose:** Explain architectural patterns, integration strategies, and conceptual models.

**When to create:**

- Introducing a new integration (e.g., Amp, MCP server)
- Documenting design patterns unique to this project
- Explaining how systems work together
- Providing comprehensive guides for agents

**Characteristics:**

- Evergreen content (regularly updated)
- Comprehensive and detailed
- Include examples and diagrams
- Cross-reference related plans and docs

**Status values:**

- `draft` - Work in progress, incomplete
- `ready` - Complete but awaiting review
- `complete` - Reviewed and ready for use

### Plans (`plans/`)

**Purpose:** Detailed implementation plans for features, refactors, or major changes.

**When to create:**

- Before implementing a significant feature
- When breaking down complex work into phases
- To coordinate work across multiple sessions/agents
- For oracle-generated implementation strategies

**Characteristics:**

- Actionable and specific
- Include code snippets and file paths
- Phase-based breakdown
- Success criteria and testing strategy
- Effort estimates

**Status values:**

- `draft` - Initial outline, not complete
- `ready` - Complete plan, ready to implement
- `in-progress` - Currently being implemented
- `complete` - Implementation finished and verified
- `abandoned` - No longer pursuing (must include `postMortem`)

### Post-Mortems (`post-mortem/`)

**Purpose:** Document why approaches were abandoned and lessons learned.

**When to create:**

- A plan status changes to `abandoned`
- A significant refactor or pivot occurs
- An approach fails and we need to learn from it

**Characteristics:**

- Retrospective analysis
- Clear explanation of what was attempted
- Reasons for abandonment
- Lessons learned
- Alternative approaches considered

**Status values:**

- `draft` - Analysis in progress
- `complete` - Finalized post-mortem

### PR Documentation (`prs/`)

**Purpose:** Draft PR descriptions and store detailed code reviews for pull requests.

**When to create:**

- **Drafts (`prs/drafts/`)**: **REQUIRED before opening any PR** - AI agents must create a draft first
- **Reviews (`prs/reviews/`)**: When conducting detailed code reviews, especially Amp-generated reviews

**Characteristics:**

**Drafts:**

- **MUST be created BEFORE opening the PR on GitHub**
- **MUST include full YAML frontmatter** (created, lastUpdated, author, status, thread, audience, tags)
- Well-structured PR descriptions
- Include context, changes, and testing details
- Follow PR template conventions from root AGENTS.md
- Use descriptive filenames matching PR branch or feature name (e.g., `fix-cli-index-threads-reference.md`)
- Set status to `complete` when ready to use for PR

**Using drafts with `gh` CLI:**

When creating PRs via GitHub CLI, **skip the YAML frontmatter** (lines 1-9). Only use the markdown body content:

```bash
# Extract body without YAML frontmatter (skip first 10 lines)
tail -n +10 docs/agents/prs/drafts/your-pr-draft.md | \
  gh pr create --title "your PR title" --body-file -
```

The YAML frontmatter is for internal documentation only, not for GitHub PR bodies.

**Reviews:**

- **MUST include full YAML frontmatter** (created, lastUpdated, author, status, thread, audience, tags)
- Comprehensive file-by-file analysis
- Identify key functionality and questionable code
- Include improvement suggestions
- Link to specific files and line numbers
- Stored in subdirectories by reviewer (e.g., `amp/`)

**Status values:**

- `draft` - Review or PR description in progress
- `complete` - Review finished or PR description ready to use

---

## YAML Frontmatter

All documents in `docs/agents/` **must** include YAML frontmatter with metadata.

### Required Fields

```yaml
---
created: YYYY-MM-DD # Date document was created
lastUpdated: YYYY-MM-DD # Date of last significant update
author: Name or "Generated via Amp (Oracle + AI analysis)"
status: draft|ready|in-progress|complete|abandoned
thread: https://ampcode.com/threads/T-{uuid} # Thread where doc was created/discussed
---
```

### Optional Fields

```yaml
audience: Description of target audience
related: ../relative/path/to/related/doc.md # or array of paths
postMortem: ../post-mortem/feature-name.md # Required if status is "abandoned"
tags: [tag1, tag2] # For future filtering/search
```

### Status Values

**Draft** (`draft`)

- Document is incomplete
- May contain TODOs or placeholders
- Not ready for agent consumption

**Ready** (`ready`)

- Document is complete
- Plans: Ready to implement
- Concepts: Ready for review

**In Progress** (`in-progress`)

- Plans only: Currently being implemented
- Update `lastUpdated` as work progresses

**Complete** (`complete`)

- Concepts: Reviewed and accurate
- Plans: Implementation finished and verified
- Post-mortems: Analysis finalized

**Abandoned** (`abandoned`)

- Plans only: No longer pursuing this approach
- **MUST include** `postMortem` field linking to analysis
- Document remains for historical context

---

## Document Templates

### Concept Document Template

```yaml
---
created: YYYY-MM-DD
lastUpdated: YYYY-MM-DD
author: Your Name
status: draft
thread: https://ampcode.com/threads/T-{uuid}
audience: Target audience description
related: ../plans/related-plan.md
---

# Concept Name

Brief description of what this concept covers.

---

## Overview

High-level explanation of the concept.

## Key Principles

- Principle 1
- Principle 2

## Architecture

Detailed explanation with examples.

## Integration Points

How this integrates with other systems.

## Best Practices

Guidance for implementation.

## Examples

Real-world usage examples.

## References

- External documentation
- Related internal docs
```

### Plan Document Template

````yaml
---
created: YYYY-MM-DD
lastUpdated: YYYY-MM-DD
author: Generated via Amp (Oracle + AI analysis)
status: ready
thread: https://ampcode.com/threads/T-{uuid}
related: ../concepts/related-concept.md
---

# Feature Name Implementation Plan

## Goal

Clear statement of what will be implemented.

**Estimated Effort:** X hours coding + Y hours testing

---

## Overview

Brief context and why this is needed.

## Implementation Order

### Phase 1: Core Infrastructure (X hours)

#### File: path/to/file.ts

**Purpose:** What this file does.

**Code:**

```typescript
// Implementation details
````

### Phase 2: Next Phase (Y hours)

...

---

## Integration

How this integrates with existing code.

## Testing

Test strategy and acceptance criteria.

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2

---

## Files Summary

**New files:**

- path/to/new/file.ts (LOC estimate)

**Modified files:**

- path/to/modified/file.ts (changes)

````

### Post-Mortem Document Template

```yaml
---
created: YYYY-MM-DD
lastUpdated: YYYY-MM-DD
author: Your Name
status: complete
thread: https://ampcode.com/threads/T-{uuid}
originalPlan: ../plans/abandoned-plan.md
---

# Post-Mortem: Feature Name

## Summary

Brief explanation of what was attempted and why it was abandoned.

## Context

What problem were we trying to solve?

## Approach Taken

Detailed description of the attempted implementation.

## Why It Failed

Specific reasons for abandonment:
- Technical blockers
- Design flaws
- Better alternatives discovered
- Changed requirements

## What We Learned

Key lessons from this attempt.

## Alternative Approaches

What we're doing instead or what could be tried in the future.

## References

- Links to related discussions
- External resources
````

---

## File Naming Conventions

### Concepts

- Lowercase with hyphens: `amp-integration.md`
- Descriptive of the topic: `mcp-server-design.md`

### Plans

- Feature or component name: `thread-command.md`
- Action-oriented: `migrate-to-vitest.md`
- Lowercase with hyphens

### Post-Mortems

- Match the abandoned plan: `thread-command.md`
- Include context if multiple attempts: `boundary-rules-regex-approach.md`

### PR Documentation

**Drafts:**

- Match PR branch or feature name: `feat-build-core-package.md`
- Descriptive of PR content: `fix-import-resolution-bug.md`

**Reviews:**

- Match PR branch or feature name: `feat-build-core-package.md`
- Organize by reviewer in subdirectories: `amp/feat-build-core-package.md`

---

## Updating Documents

### When to Update `lastUpdated`

**Update the date when:**

- Significant content changes
- Status changes
- Implementation details change
- New sections added

**Don't update for:**

- Typo fixes
- Formatting changes
- Link updates

### Status Transitions

**Concepts:**

```
draft → ready → complete
```

**Plans:**

```
draft → ready → in-progress → complete
draft → ready → abandoned (→ requires post-mortem)
in-progress → abandoned (→ requires post-mortem)
```

**Post-Mortems:**

```
draft → complete
```

**PR Documentation:**

```
draft → complete
```

---

## Best Practices

### For Humans

1. **Create plans before large implementations** - Use oracle to generate detailed plans
2. **Update status as work progresses** - Keep agents informed of current state
3. **Link related documents** - Use `related` field to cross-reference
4. **Write for agents** - Clear, structured, actionable content
5. **Include thread URLs** - Provide context and history

### For AI Agents

1. **Always check `status`** - Don't implement abandoned plans
2. **Read related documents** - Follow `related` links for full context
3. **Update `lastUpdated`** - When making significant changes
4. **Create post-mortems** - When abandoning plans (ask human to help)
5. **Reference threads** - Link to implementation threads in updates

---

## Integration with Root AGENTS.md

The root `AGENTS.md` should reference this directory:

```markdown
## Agent Documentation

For guides on creating implementation plans, concept documents, and post-mortems, see:

@docs/agents/AGENTS.md

**For human contributors:** See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, development workflow, branching strategy, and PR process.

**For AI agents:** The root AGENTS.md includes a comprehensive "Git and GitHub Workflows" section with branching rules, commit conventions, and PR requirements.

Current active plans:

- @docs/agents/plans/thread-command.md
- @docs/agents/plans/contributing-and-workflows.md

Key concepts:

- @docs/agents/concepts/amp-integration.md
```

---

## Release Workflow

**Note:** The release workflow is documented in the root AGENTS.md. Key points for documentation purposes:

**Creating Changesets:**

- Always create changesets via `pnpm changeset` after making changes
- Commit changeset files (`.changeset/*.md`) along with your changes
- Never run `pnpm changeset version` locally - let the GitHub workflow handle it

**Version Packages PR:**

- Workflow automatically creates/updates a "Version Packages" PR
- This PR updates versions, CHANGELOGs, and creates tags
- Only merge when ready to publish to npm

**Publishing:**

- Merging the "Version Packages" PR triggers automatic npm publish
- Unpublishing blocks republishing for 24 hours - avoid it
- NPM organization `@effect-migrate` must exist before first publish

**For detailed instructions, see:** [Root AGENTS.md Release & Publishing section](../../AGENTS.md#release--publishing)

---

## Examples

### Good Example Headers

**IMPORTANT:** These are example templates. Each document must use its own accurate:

- `created` and `lastUpdated` dates (YYYY-MM-DD format)
- `thread` URL from the actual Amp thread where the work was done
- `audience` and `tags` appropriate to the document
- `status` must be correct and accounted for accuracy
- `author` must be the agent(s) and/or the developer
- `related` must be actually related

**Concept:**

```yaml
---
created: 2025-11-04 # Use actual creation date
lastUpdated: 2025-11-04 # Use actual last update date
author: Generated via Amp (Oracle + AI analysis)
status: complete
thread: https://ampcode.com/threads/T-38c593cf-0e0f-4570-ad73-dfc2c3b1d6c9 # Use actual thread URL
audience: Migration developers and Amp coding agents
related: ../plans/thread-command.md
---
```

**Plan:**

```yaml
---
created: 2025-11-04
lastUpdated: 2025-11-04
author: Generated via Amp (Oracle + AI analysis)
status: ready
thread: https://ampcode.com/threads/T-38c593cf-0e0f-4570-ad73-dfc2c3b1d6c9
related: ../concepts/amp-integration.md
---
```

**Abandoned Plan with Post-Mortem:**

```yaml
---
created: 2025-11-01
lastUpdated: 2025-11-04
author: Team Discussion
status: abandoned
thread: https://ampcode.com/threads/T-original-uuid
postMortem: ../post-mortem/regex-boundary-approach.md
---
```

**PR Draft:**

```yaml
---
created: 2025-11-04
lastUpdated: 2025-11-04
author: Generated via Amp
status: complete
thread: https://ampcode.com/threads/T-f57a4529-ce92-4ba3-9d68-01eda86dc1fb
audience: Development team and reviewers
tags: [pr-draft, thread-command, feature-implementation]
---
```

**PR Review:**

```yaml
---
created: 2025-11-04
lastUpdated: 2025-11-04
author: Generated via Amp (Review)
status: complete
thread: https://ampcode.com/threads/T-f57a4529-ce92-4ba3-9d68-01eda86dc1fb
audience: Development team and AI coding agents
tags: [pr-review, thread-command, amp-integration, context-output]
---
```

### Bad Example Headers

```yaml
# ❌ Missing required fields
---
created: 2025-11-04
status: ready
---
# ❌ Wrong status values
---
status: WIP # Should be: in-progress
---
# ❌ Abandoned without post-mortem
---
status: abandoned
# Missing: postMortem field
---
# ❌ No frontmatter at all
# Just content with no metadata
```

---

## Maintenance

### Regular Reviews

- **Monthly:** Review `in-progress` plans - update status or mark abandoned
- **Quarterly:** Review `complete` concepts - update for accuracy
- **As needed:** Create post-mortems for abandoned work

### Archival Policy

- **Keep everything** - Don't delete abandoned plans or old post-mortems
- **Status over deletion** - Use status field to indicate relevance
- **Context preservation** - Historical context helps future decisions

---

## Questions?

For questions about this documentation system:

- Open an Amp thread and reference this guide
- Tag discussions with the project thread URL
- Update this guide based on learnings

---

**Last Updated:** 2025-11-04  
**Maintained By:** @aridyckovsky
**Feedback:** Open issues or start Amp threads with suggestions
