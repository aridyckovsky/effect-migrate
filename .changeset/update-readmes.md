---
"@effect-migrate/core": patch
"@effect-migrate/cli": patch
---

Update all READMEs to reflect current architecture and published usage

**Documentation improvements:**

- Root README: Accurate CLI commands, output schemas (index.json, audit.json, metrics.json, threads.json), real rule examples, proper roadmap
- CLI README: Complete options documentation (--strict, --log-level, --amp-out), troubleshooting guide, local development instructions
- Core README: Comprehensive exported API documentation, service architecture, Layer patterns, real rule examples from preset-basic

**Key updates:**

- Reflect dogfooding status and unstable API warnings across all packages
- Document complementary relationship with @effect/language-service
- Add proper roadmap with planned features (SQLite, Polars, OpenTelemetry, MCP server, workflow orchestration)
- User-focused: Published npm usage as primary, local development as secondary
- Real examples from actual codebase (patterns.ts, boundaries.ts)

Resolves #24
