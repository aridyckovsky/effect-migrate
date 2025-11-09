---
"@effect-migrate/core": minor
---

Add norms capture feature for detecting established migration norms from checkpoint history. New DirectorySummarizer service analyzes audit checkpoints using lookback window consensus algorithm (default K=5) to identify rules that went to zero and stayed there. Exports DirectoryStatus, Norm, and DirectorySummary schemas with comprehensive JSDoc, along with tagged errors (NoCheckpointsError, InvalidDirectoryError, NormDetectionError, SummaryWriteError). Pure functions (detectExtinctNorms, computeDirectoryStats, determineStatus, findCleanTimestamp) enable testability with 100% coverage. Reuses existing Severity and CheckpointSummary schemas for consistency. Includes 38 new tests with realistic checkpoint fixtures.
