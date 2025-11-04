---
created: 2025-11-04
lastUpdated: 2025-11-04
author: Generated via Amp (Oracle + Librarian)
status: complete
# TODO: Replace with actual thread for this
thread: https://ampcode.com/threads/T-c8282916-89e9-43f5-9b26-9bbb7cfc79e7
audience: Development team and AI coding agents
tags: [pr-review, core-package, import-index, file-discovery]
---

# PR: Complete @effect-migrate/core Implementation

**Branch:** `feat/build-core-package`  
**Target:** `main`  
**Type:** Feature

## Summary

Completes the core implementation of `@effect-migrate/core` with engines, services, comprehensive testing, and public API docstrings.

## Key Changes

### Engines

- **PatternEngine** - AST traversal using TypeScript Compiler API for code pattern detection
- **BoundaryEngine** - Import parsing and graph building for architectural boundary validation

### Services

- **FileDiscovery** - Refactored for lazy loading and caching
- **ImportIndex** - Complete rewrite with Effect-based queries, lazy graph building
- **RuleRunner** - Enhanced orchestration with better error handling

## Amp's Assessment

### What Changed

This PR represents the transition from skeleton to functional implementation. The core package went from having type definitions and scaffolded services to a complete, testable migration engine.

### Technical Impact

**Architectural Soundness:**
The engines and services follow Effect-TS patterns correctly. PatternEngine and BoundaryEngine are focused, single-purpose modules. Services use proper Layer composition and dependency injection. The test suite validates both isolated units and integrated workflows.

**API Design:**
The breaking change to Effect-based ImportIndexResult queries was necessary and correct. Synchronous array returns were incompatible with the lazy-loading architecture. The migration path is straightforward (add `yield*`).

The index.ts expansion with TSDoc is high-quality documentation that will reduce friction for library consumers. Each export has context and examples.

**Test Coverage:**
Strong test coverage with a mix of unit tests (services in isolation) and integration tests (RuleRunner end-to-end) provides confidence in both components and system behavior.

Using real filesystem fixtures instead of mocks for integration tests is the right choice. It validates actual glob matching, file reading, and import parsing behavior.

### Practical Impact

**What Works Now:**

- Pattern rules can detect code constructs via AST traversal
- Boundary rules can enforce architectural constraints via import graphs
- File discovery with lazy loading prevents OOM on large codebases
- Rule execution is composable and testable

**What This Enables:**
The CLI package can now wire up these services and deliver working commands. Preset packages can define concrete rules using the helper functions. The architecture supports concurrent rule execution and incremental processing.

**Risks & Limitations:**

- Import graph building happens on-demand per rule, not globally. Multiple boundary rules will rebuild graphs. This is acceptable for MVP but may need optimization.
- No AST caching between rules. Pattern rules that analyze the same file will re-parse. Again, acceptable for now.
- Tests use `fileParallelism: false`, which may hide concurrency bugs. This was likely necessary to avoid filesystem conflicts but should be noted.

### Recommendation

This PR moves toward production readiness for the core package. The implementation is sound, well-tested, and properly documented.

**Merge when:** All CI checks pass.

**Next critical path:** CLI integration to make this functionality accessible to users.
