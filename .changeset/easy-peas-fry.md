---
"@effect-migrate/cli": minor
---

Add norms capture command for analyzing migration checkpoint history and detecting established norms. New command effect-migrate norms capture provides prepare-only mode (default) for preview without writes, with options for status filtering (migrated/in-progress/all), directory filtering, lookback window customization (default: 5), min-files threshold, and overwrite control. Outputs JSON summaries to .amp/effect-migrate/norms/ using Schema.encodeSync for proper DateTimeUtc serialization. Includes user guidance for AGENTS.md documentation workflow. Supports --json flag and --amp-out directory configuration. Includes 15 new CLI integration tests covering all options and error paths.
