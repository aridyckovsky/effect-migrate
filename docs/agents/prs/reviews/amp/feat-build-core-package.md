---
created: 2025-11-04
lastUpdated: 2025-11-04
author: Generated via Amp (Review)
status: complete
thread: https://ampcode.com/threads/T-8caea766-5d87-4109-9b52-76715f25bd45
audience: Development team and AI coding agents
tags: [pr-review, core-package, import-index, file-discovery]
---

# PR Review: feat-build-core-package

1.  **[packages/core/src/services/ImportIndex.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/services/ImportIndex.ts)**: This file introduces a new `ImportIndex` service responsible for parsing and indexing import statements within project files, crucial for boundary rule enforcement.
2.  **[packages/core/src/services/FileDiscovery.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/services/FileDiscovery.ts)**: This file refactors the `FileDiscovery` service to be more robust, including improved glob matching, caching, and a new `buildFileIndex` method.
3.  **[packages/core/src/services/RuleRunner.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/services/RuleRunner.ts)**: This file modifies the `RuleRunner` service to integrate the new `ImportIndex` service and refactors how the import index is built and cached.
4.  **[packages/core/src/rules/helpers.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/rules/helpers.ts)**: This file updates the `makeBoundaryRule` helper to correctly use the `ImportIndexResult` interface, ensuring it can fetch imports.
5.  **[packages/core/src/index.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/index.ts)**: This file reorganizes and expands the public API of the `@effect-migrate/core` package, adding exports for new services and types.
6.  **[eslint.config.mjs](file:///Users/metis/Projects/effect-migrate/eslint.config.mjs)**: This file updates the ESLint configuration to include new directories to ignore and to configure the TypeScript parser to recognize project configurations.
7.  **[packages/cli/src/index.ts](file:///Users/metis/Projects/effect-migrate/packages/cli/src/index.ts)**: This file modifies the CLI's main entry point to correctly initialize and run the Effect program.
8.  **[package.json](file:///Users/metis/Projects/effect-migrate/package.json)**: This file updates the root `package.json` to change how tests are run, now using `pnpm -r run test`.
9.  **[packages/cli/package.json](file:///Users/metis/Projects/effect-migrate/packages/cli/package.json)**: This file updates the `cli` package's `package.json` to change test commands and update the `vitest` dependency.
10. **[packages/core/package.json](file:///Users/metis/Projects/effect-migrate/packages/core/package.json)**: This file updates the `core` package's `package.json` to change test commands and update the `vitest` dependency.
11. **[packages/preset-basic/package.json](file:///Users/metis/Projects/effect-migrate/packages/preset-basic/package.json)**: This file updates the `preset-basic` package's `package.json` to change test commands and update the `vitest` dependency.
12. **[packages/core/src/engines/BoundaryEngine.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/engines/BoundaryEngine.ts)**: This file introduces a new `BoundaryEngine` for running boundary-based rules, which relies on file discovery and import indexing.
13. **[packages/core/src/engines/PatternEngine.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/engines/PatternEngine.ts)**: This file introduces a new `PatternEngine` for running pattern-based rules, utilizing file discovery.
14. **[packages/preset-basic/src/index.ts](file:///Users/metis/Projects/effect-migrate/packages/preset-basic/src/index.ts)**: This file modifies the `preset-basic` export to include the `noAsyncAwait` rule.
15. **[packages/preset-basic/src/patterns.ts](file:///Users/metis/Projects/effect-migrate/packages/preset-basic/src/patterns.ts)**: This file defines the `noAsyncAwait` pattern rule, which checks for `async function` declarations.
16. **[vitest.config.ts](file:///Users/metis/Projects/effect-migrate/vitest.config.ts)**: This file introduces a new root `vitest.config.ts` to manage Vitest configurations for multiple packages.
17. **[packages/cli/test/version.test.ts](file:///Users/metis/Projects/effect-migrate/packages/cli/test/version.test.ts)**: This file adds a new test suite for the CLI package to verify its `package.json` and importability.
18. **[packages/cli/tsconfig.test.json](file:///Users/metis/Projects/effect-migrate/packages/cli/tsconfig.test.json)**: This file adds a new test-specific TypeScript configuration for the CLI package.
19. **[packages/core/test/rules.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/rules.test.ts)**: This file adds tests for the `makePatternRule` helper function.
20. **[packages/core/test/rules/helpers.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/rules/helpers.test.ts)**: This file adds comprehensive tests for the `makePatternRule` and `makeBoundaryRule` helper functions.
21. **[packages/core/test/schema/loader.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/schema/loader.test.ts)**: This file adds tests for the configuration loading mechanism, covering valid and invalid configurations.
22. **[packages/core/test/services/FileDiscovery.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/services/FileDiscovery.test.ts)**: This file adds tests for the refactored `FileDiscovery` service, covering its various functionalities.
23. **[packages/core/test/services/ImportIndex.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/services/ImportIndex.test.ts)**: This file adds tests for the new `ImportIndex` service, verifying its import parsing and indexing capabilities.
24. **[packages/core/test/services/RuleRunner.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/services/RuleRunner.test.ts)**: This file adds tests for the `RuleRunner` service, ensuring it correctly executes various types of rules.
25. **[packages/core/tsconfig.test.json](file:///Users/metis/Projects/effect-migrate/packages/core/tsconfig.test.json)**: This file adds a new test-specific TypeScript configuration for the core package.
26. **[packages/preset-basic/test/patterns.test.ts](file:///Users/metis/Projects/effect-migrate/packages/preset-basic/test/patterns.test.ts)**: This file adds tests for the `noAsyncAwait` pattern rule.
27. **[packages/preset-basic/tsconfig.test.json](file:///Users/metis/Projects/effect-migrate/packages/preset-basic/tsconfig.test.json)**: This file adds a new test-specific TypeScript configuration for the preset-basic package.
28. **[packages/core/test/fixtures/configs/invalid-config.json](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/configs/invalid-config.json)**: This file adds an invalid JSON configuration file for testing schema validation.
29. **[packages/core/test/fixtures/configs/valid-config.json](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/configs/valid-config.json)**: This file adds a valid JSON configuration file for testing schema loading.
30. **[packages/core/test/fixtures/sample-project/README.md](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/README.md)**: This file adds a README file to the sample project fixture.
31. **[packages/core/test/fixtures/sample-project/package.json](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/package.json)**: This file adds a package.json to the sample project fixture.
32. **[packages/core/test/fixtures/sample-project/src/index.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/src/index.ts)**: This file adds an example TypeScript file to the sample project fixture.
33. **[packages/core/test/fixtures/sample-project/src/legacy.js](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/src/legacy.js)**: This file adds an example JavaScript file to the sample project fixture.
34. **[packages/core/test/fixtures/sample-project/src/services/api.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/src/services/api.ts)**: This file adds an example TypeScript service file to the sample project fixture.
35. **[packages/core/test/fixtures/sample-project/src/utils/helper.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/src/utils/helper.ts)**: This file adds an example TypeScript helper file to the sample project fixture.
36. **[vitest.config.ts](file:///Users/metis/Projects/effect-migrate/vitest.config.ts)**: This file adds a root Vitest configuration file to manage tests across multiple packages.

## File Changes

### [packages/core/src/services/ImportIndex.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/services/ImportIndex.ts)

- **Key Functionality**: Introduces a new `ImportIndex` service to parse and index import statements within project files, enabling architectural constraint checks.
- **Major Notes**:
  - The `ImportIndex` service is implemented using Effect's `Layer` and `Context.Tag`.
  - It defines `IMPORT_PATTERNS` to capture various import syntaxes (ES6 `import`, `require`, dynamic `import()`).
  - It includes a `resolveImport` function to handle relative path resolution and prefix external packages with `pkg:`.
  - The `getImportIndex` method builds both forward (file -> imports) and reverse (module -> dependents) indices.
  - Caching is implemented for the import index based on globs and exclude patterns.
  - `getImportsOf` and `getDependentsOf` provide access to the built indices.
- **Questionable Code / Areas for Improvement**:
  - The `IMPORT_PATTERNS` regex could potentially be more robust or handle edge cases like comments containing import-like strings.
  - The `resolveImport` function's candidate generation could be more comprehensive, especially for module resolution beyond simple relative paths (though this might be out of scope for this service).
  - Error handling for file reading (`fileDiscovery.readFile`) within `parseFileImports` is done via `Effect.catchTag`, which is good, but the `ImportParseError` message could be more detailed.
  - The `lastBuiltIndices` global variable approach for caching might lead to unexpected behavior if `getImportIndex` is called multiple times with different parameters within the same execution context without clearing the cache. It might be better to manage the cache more explicitly within the service instance.
  - The `getImportIndex` method returns a `Map<string, ReadonlyArray<string>>` which represents the forward index. It might be more intuitive if it returned both forward and reverse indices, or if the `getDependentsOf` method implicitly built the reverse index when needed.

### [packages/core/src/services/FileDiscovery.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/services/FileDiscovery.ts)

- **Key Functionality**: Refactors the `FileDiscovery` service for improved glob matching, file content caching, and adds a `buildFileIndex` method.
- **Major Notes**:
  - The `FileDiscovery` service is now defined using `Context.Tag` and includes a `buildFileIndex` method.
  - Glob matching logic (`matchGlob`, `shouldInclude`) has been improved to handle `**/` and `{}` patterns more accurately.
  - File content is cached in memory using a `Map`.
  - `buildFileIndex` efficiently reads multiple files concurrently and returns a map of file paths to their content.
  - The `listFiles` method now returns sorted results.
- **Questionable Code / Areas for Improvement**:
  - The `matchGlob` function's regex construction could be complex and potentially error-prone. Thorough testing of various glob patterns is recommended.
  - The `getGlobBase` function might not cover all edge cases for determining the base directory for glob patterns.
  - The `FileDiscoveryLive` layer directly accesses `process.cwd()`. While common in Node.js applications, it might be slightly less pure. However, for a file system service, this is often acceptable.
  - The `TEXT_EXTENSIONS` set is hardcoded. It might be beneficial to make this configurable or more dynamic.
  - The `buildFileIndex` method filters for `textFiles` using `isTextFile` but then proceeds to read all files returned by `listFiles`. It should ideally only read files that `isTextFile` returns true for.

### [packages/core/src/services/RuleRunner.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/services/RuleRunner.ts)

- **Key Functionality**: Integrates the new `ImportIndex` service and refactors the import index building process within the `RuleRunner`.
- **Major Notes**:
  - The `RuleRunner` now depends on `ImportIndexService`.
  - The `getImportIndex` method in `RuleRunner` now calls `importIndexService.getImportIndex` and caches the result, ensuring the index is built only once per run.
  - The `RuleContext` passed to rules now correctly provides `getImports` and `getImporters` functions that utilize the cached import index.
  - The `RuleRunnerLive` layer now provides `ImportIndexLive`.
- **Questionable Code / Areas for Improvement**:
  - The `importIndexCache` is managed as a module-level variable. While it works for a single run, it might be cleaner to manage this cache within the `RuleRunner` instance itself or rely entirely on the `ImportIndex` service's internal caching.
  - The `getImportIndex` method logs "Building import index..." and then "✓ Indexed imports". This implies the index is built every time `getImportIndex` is called, even if it's cached. The logging could be more precise to reflect when the index is actually being built versus retrieved from cache.
  - The `RuleContext`'s `getImportIndex` function returns an `Effect.Effect<ImportIndexResult, any>`. This implies that the import index building itself can fail, which is handled by the `RuleRunner`.

### [packages/core/src/rules/helpers.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/rules/helpers.ts)

- **Key Functionality**: Updates the `makeBoundaryRule` helper to correctly use the `ImportIndexResult` interface, ensuring it can fetch imports.
- **Major Notes**:
  - The `makeBoundaryRule` function now correctly uses `yield* importIndex.getImports(file)` instead of assuming it returns an array directly.
  - Added logic to strip the `pkg:` prefix when searching for import paths within file content for more accurate matching.
- **Questionable Code / Areas for Improvement**:
  - The `importPath.startsWith("pkg:")` check is a bit of a heuristic. A more robust solution might involve normalizing paths before comparison.
  - The `importPath.slice(4)` assumes the prefix is always exactly "pkg:".

### [packages/core/src/index.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/index.ts)

- **Key Functionality**: Reorganizes and expands the public API of the `@effect-migrate/core` package, adding exports for new services and types.
- **Major Notes**:
  - The file now exports types, rule system types, rule helpers, configuration schema, configuration loading utilities, and services.
  - It provides JSDoc comments for better documentation and usage examples.
  - Exports for `FileDiscovery`, `ImportIndex`, `RuleRunner`, and their respective live implementations are added.
  - New engines (`BoundaryEngine`, `PatternEngine`) are implicitly made available through the services they depend on.
- **Questionable Code / Areas for Improvement**:
  - The extensive re-exporting can make it slightly harder to trace the origin of a specific type or function without careful navigation. However, this is a common pattern for organizing libraries.

### [eslint.config.mjs](file:///Users/metis/Projects/effect-migrate/eslint.config.mjs)

- **Key Functionality**: Updates the ESLint configuration to ignore the new `test/fixtures/**` directory and configures the TypeScript parser to recognize project configurations.
- **Major Notes**:
  - Added `**/test/fixtures/**` to the `ignores` array.
  - Changed `projectService: true` to a more explicit `project` array configuration for `parserOptions`, including `tsconfig.json`, `packages/*/tsconfig.json`, and `packages/*/tsconfig.test.json`.
- **Questionable Code / Areas for Improvement**:
  - The `project` configuration in `parserOptions` is now more specific. Ensure that all relevant `tsconfig.json` files are included, especially if the project structure evolves.

### [packages/cli/src/index.ts](file:///Users/metis/Projects/effect-migrate/packages/cli/src/index.ts)

- **Key Functionality**: Modifies the CLI's main entry point to correctly initialize and run the Effect program.
- **Major Notes**:
  - Renamed `runner` to `program` for clarity.
  - The `Command.run` call is now correctly invoked with `process.argv` before piping to `Effect.provide` and `NodeRuntime.runMain`.
- **Questionable Code / Areas for Improvement**:
  - No significant issues found. The change correctly applies the Effect runtime.

### [package.json](file:///Users/metis/Projects/effect-migrate/package.json)

- **Key Functionality**: Updates the root `package.json` to change how tests are run, now using `pnpm -r run test`.
- **Major Notes**:
  - The `test` script is changed from `vitest` to `pnpm -r run test`.
  - The `test:ci` script is changed from `vitest run` to `pnpm -r run test:ci`.
- **Questionable Code / Areas for Improvement**:
  - This change centralizes test execution logic. Ensure that all packages correctly define their `test` and `test:ci` scripts if they deviate from the default.

### [packages/cli/package.json](file:///Users/metis/Projects/effect-migrate/packages/cli/package.json)

- **Key Functionality**: Updates the `cli` package's `package.json` to change test commands and update the `vitest` dependency.
- **Major Notes**:
  - The `test` script is changed from `vitest` to `pnpm -r run test`.
  - The `test:ci` script is added and set to `vitest run`.
  - The `vitest` dependency version is updated from `latest` to `^3.2.4`.
- **Questionable Code / Areas for Improvement**:
  - The `test` script is now redundant if it just calls `pnpm -r run test`. It might be better to remove it or ensure it has a specific purpose.

### [packages/core/package.json](file:///Users/metis/Projects/effect-migrate/packages/core/package.json)

- **Key Functionality**: Updates the `core` package's `package.json` to change test commands and update the `vitest` dependency.
- **Major Notes**:
  - The `test` script is changed from `vitest` to `pnpm -r run test`.
  - The `test:ci` script is added and set to `vitest run`.
  - The `vitest` dependency version is updated from `latest` to `^3.2.4`.
- **Questionable Code / Areas for Improvement**:
  - Similar to `packages/cli/package.json`, the `test` script might be redundant.

### [packages/preset-basic/package.json](file:///Users/metis/Projects/effect-migrate/packages/preset-basic/package.json)

- **Key Functionality**: Updates the `preset-basic` package's `package.json` to change test commands and update the `vitest` dependency.
- **Major Notes**:
  - The `test` script is changed from `vitest` to `pnpm -r run test`.
  - The `test:ci` script is added and set to `vitest run`.
  - The `vitest` dependency version is updated from `latest` to `^3.2.4`.
- **Questionable Code / Areas for Improvement**:
  - The `test` script might be redundant.

### [packages/core/src/engines/BoundaryEngine.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/engines/BoundaryEngine.ts)

- **Key Functionality**: Introduces a new `BoundaryEngine` for running boundary-based rules, which relies on file discovery and import indexing.
- **Major Notes**:
  - This engine orchestrates the discovery of files, building of an import index, and running of boundary rules against matching files.
  - It filters rules by `kind === "boundary"` and applies them based on `config.boundaries` matching the `from` pattern.
  - It utilizes the `FileDiscoveryService` and `ImportIndexService` interfaces.
- **Questionable Code / Areas for Improvement**:
  - The `matchGlob` function is duplicated here and in `FileDiscovery.ts`. It should be centralized.
  - The `RuleContext` provided to the rules includes `getImportIndex: () => Effect.succeed(indexResult)`. This implies the import index is built upfront for all files, which might be inefficient if only a subset of files are relevant to boundary rules. The `RuleRunner` already handles building the index, so this might be redundant or could be simplified.
  - Error handling for `discovery.listFiles` and `discovery.readFile` is done via `Effect.catchAll(() => Effect.succeed([]))` or similar, which might mask underlying issues. It might be better to let these errors propagate or handle them more explicitly.

### [packages/core/src/engines/PatternEngine.ts](file:///Users/metis/Projects/effect-migrate/packages/core/src/engines/PatternEngine.ts)

- **Key Functionality**: Introduces a new `PatternEngine` for running pattern-based rules, utilizing file discovery.
- **Major Notes**:
  - This engine discovers files and runs pattern-based rules against them.
  - It filters rules by `kind === "pattern"`.
  - It provides a `RuleContext` to each rule, including file access and a placeholder for import index functionality.
- **Questionable Code / Areas for Improvement**:
  - The `getImportIndex` in the `RuleContext` returns a stub that always returns empty arrays. This is likely intentional as pattern rules don't typically need import information, but it's worth noting.
  - Similar to `BoundaryEngine`, error handling for `discovery.listFiles` could be more robust.

### [packages/preset-basic/src/index.ts](file:///Users/metis/Projects/effect-migrate/packages/preset-basic/src/index.ts)

- **Key Functionality**: Modifies the `preset-basic` export to include the `noAsyncAwait` rule.
- **Major Notes**:
  - The `noAsyncAwait` rule is now exported from this file.
  - `patternRules` is also exported, which likely includes `noAsyncAwait`.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/preset-basic/src/patterns.ts](file:///Users/metis/Projects/effect-migrate/packages/preset-basic/src/patterns.ts)

- **Key Functionality**: Defines the `noAsyncAwait` pattern rule, which checks for `async function` declarations.
- **Major Notes**:
  - The `noAsyncAwait` rule is implemented using `makePatternRule`.
  - It targets files matching `**/*.ts` and uses the regex `/async\s+function/g`.
  - It has a severity of "warning" and a message suggesting `Effect.gen`.
- **Questionable Code / Areas for Improvement**:
  - The rule currently only checks for `async function`. It might be beneficial to also check for `async () => ...` or `async () => { ... }` syntax if those are also considered anti-patterns.
  - The rule doesn't explicitly ignore `async` functions within `Effect.gen` blocks. While the tests suggest it might implicitly handle this due to how `readFile` is used, it's worth confirming or adding explicit exclusion if needed.

### [vitest.config.ts](file:///Users/metis/Projects/effect-migrate/vitest.config.ts)

- **Key Functionality**: Introduces a root `vitest.config.ts` to manage Vitest configurations for multiple packages.
- **Major Notes**:
  - Uses `defineConfig` from `vitest/config`.
  - Defines `projects` to configure Vitest for `@effect-migrate/core`, `@effect-migrate/cli`, and `@effect-migrate/preset-basic` separately.
  - Sets `environment: "node"`, `globals: true`, and specifies `include` paths for each project.
- **Questionable Code / Areas for Improvement**:
  - The `fileParallelism: false` setting in the core project's test config might be a workaround for specific issues. It's generally better to have tests run in parallel if possible for faster execution. Investigate if this is still necessary.
  - The `testTimeout: 5000` might be too low for some integration tests, especially those involving file system operations or network requests. Consider increasing it or making it configurable per project if needed.

### [packages/cli/test/version.test.ts](file:///Users/metis/Projects/effect-migrate/packages/cli/test/version.test.ts)

- **Key Functionality**: Adds a new test suite for the CLI package to verify its `package.json` and importability.
- **Major Notes**:
  - Tests that `package.json` has a valid name and version format.
  - Tests that the CLI module can be imported successfully.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/cli/tsconfig.test.json](file:///Users/metis/Projects/effect-migrate/packages/cli/tsconfig.test.json)

- **Key Functionality**: Adds a new test-specific TypeScript configuration for the CLI package.
- **Major Notes**:
  - Extends `../../tsconfig.base.json`.
  - Sets `composite: false` and `noEmit: true`.
  - Includes `test/**/*` and `src/**/*`.
  - Excludes `node_modules` and `build`.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/core/test/rules.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/rules.test.ts)

- **Key Functionality**: Adds tests for the `makePatternRule` helper function.
- **Major Notes**:
  - Tests the basic creation of a rule and its `run` function.
  - Includes a mock context to simulate file reading and pattern matching.
- **Questionable Code / Areas for Improvement**:
  - This file seems to be a precursor to the more comprehensive `packages/core/test/rules/helpers.test.ts`. It might be redundant.

### [packages/core/test/rules/helpers.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/rules/helpers.test.ts)

- **Key Functionality**: Adds comprehensive tests for the `makePatternRule` and `makeBoundaryRule` helper functions.
- **Major Notes**:
  - Covers various scenarios for `makePatternRule`, including string/regex patterns, negative patterns, multiple files, location calculation, and optional fields.
  - Covers various scenarios for `makeBoundaryRule`, including disallowed imports, glob patterns in `disallow`, multiple disallowed patterns, line information, optional fields, and no violations.
  - Uses a `createMockContext` helper for better test setup.
- **Questionable Code / Areas for Improvement**:
  - The `createMockContext`'s glob matching logic is reimplemented. It should ideally leverage the actual `FileDiscovery` logic or be thoroughly validated.
  - The `importIndex` mock in `createMockContext` is a simple `Record<string, string[]>`. For more complex scenarios, a more sophisticated mock might be needed.

### [packages/core/test/schema/loader.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/schema/loader.test.ts)

- **Key Functionality**: Adds tests for the configuration loading mechanism, covering valid and invalid configurations.
- **Major Notes**:
  - Tests loading valid JSON, non-existent files, and invalid JSON.
  - Verifies schema validation, default values, pattern string to RegExp transformation, and optional fields.
  - Includes tests for concurrency range validation and path configuration.
- **Questionable Code / Areas for Improvement**:
  - The test for unsupported file extensions (`test.xml`) writes to the file system. Ensure proper cleanup (`fs.remove`) is always performed, even on error.
  - The `getFixturePath` helper uses `__dirname`, which might behave differently in different module systems (CommonJS vs. ESM). Using `import.meta.url` is generally preferred for ESM.

### [packages/core/test/services/FileDiscovery.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/services/FileDiscovery.test.ts)

- **Key Functionality**: Adds tests for the refactored `FileDiscovery` service, covering its various functionalities.
- **Major Notes**:
  - Tests `listFiles` with various glob patterns, exclude patterns, and multiple globs.
  - Verifies file content caching and reading.
  - Tests `isTextFile` for different extensions.
  - Tests `buildFileIndex` for concurrency and inclusion of only text files.
  - Checks for sorted output and edge cases like empty glob arrays.
- **Questionable Code / Areas for Improvement**:
  - The tests rely on a specific project structure (`test/fixtures/sample-project`). Ensure this structure is stable or adapt tests if it changes.
  - The `testDir` is derived from `import.meta.url`, which is good practice for ESM.

### [packages/core/test/services/ImportIndex.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/services/ImportIndex.test.ts)

- **Key Functionality**: Adds tests for the new `ImportIndex` service, verifying its import parsing and indexing capabilities.
- **Major Notes**:
  - Tests extraction of ES6 imports, `require()`, relative imports, and external package prefixes (`pkg:`).
  - Verifies index caching, forward index (`getImportsOf`), and reverse index (`getDependentsOf`).
  - Includes tests for files with no imports/dependents and handling of export statements.
  - Checks exclusion patterns and concurrent file processing.
  - Tests graceful failure when the index is not built.
- **Questionable Code / Areas for Improvement**:
  - The tests rely on the `sample-project` fixture. Ensure its structure and content are representative of common import scenarios.
  - The `TestLayer` setup might need adjustment if `FileDiscoveryLive` or `NodeContext.layer` have specific requirements not met by the default setup.

### [packages/core/test/services/RuleRunner.test.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/services/RuleRunner.test.ts)

- **Key Functionality**: Adds tests for the `RuleRunner` service, ensuring it correctly executes various types of rules.
- **Major Notes**:
  - Tests running pattern and boundary rules.
  - Verifies concurrent rule execution and merging of results.
  - Checks concurrency settings, handling of rules with no matches, and empty rule arrays.
  - Tests import index caching across boundary rules.
  - Validates exclusion from config and graceful handling of rule errors.
  - Asserts that the correct context is provided to rules.
  - Checks that results include all required fields.
- **Questionable Code / Areas for Improvement**:
  - The tests rely heavily on the `sample-project` fixture. Ensure its content accurately reflects scenarios that trigger the rules being tested.
  - The `TestLayer` setup might need careful review to ensure all dependencies are correctly provided.

### [packages/core/tsconfig.test.json](file:///Users/metis/Projects/effect-migrate/packages/core/tsconfig.test.json)

- **Key Functionality**: Adds a new test-specific TypeScript configuration for the core package.
- **Major Notes**:
  - Extends `../../tsconfig.base.json`.
  - Sets `composite: false` and `noEmit: true`.
  - Includes `test/**/*` and `src/**/*`.
  - Excludes `node_modules`, `build`, and `test/fixtures/**`.
- **Questionable Code / Areas for Improvement**:
  - Excluding `test/fixtures/**` is important for test compilation but means these files won't be type-checked by this config. Ensure they are handled correctly by other configurations if needed.

### [packages/preset-basic/test/patterns.test.ts](file:///Users/metis/Projects/effect-migrate/packages/preset-basic/test/patterns.test.ts)

- **Key Functionality**: Adds tests for the `noAsyncAwait` pattern rule.
- **Major Notes**:
  - Tests the rule's configuration and its ability to detect `async function` declarations.
  - Includes a test case to ensure `Effect.gen` code is ignored.
- **Questionable Code / Areas for Improvement**:
  - The mock context for `noAsyncAwait` uses a hardcoded `readFile` result. For more complex scenarios, consider using the `sample-project` fixture or generating dynamic content.

### [packages/preset-basic/tsconfig.test.json](file:///Users/metis/Projects/effect-migrate/packages/preset-basic/tsconfig.test.json)

- **Key Functionality**: Adds a new test-specific TypeScript configuration for the preset-basic package.
- **Major Notes**:
  - Extends `../../tsconfig.base.json`.
  - Sets `composite: false` and `noEmit: true`.
  - Includes `test/**/*` and `src/**/*`.
  - Excludes `node_modules` and `build`.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/core/test/fixtures/configs/invalid-config.json](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/configs/invalid-config.json)

- **Key Functionality**: Adds an invalid JSON configuration file for testing schema validation.
- **Major Notes**:
  - Contains incorrect types for `version` (string instead of number) and `paths.exclude` (string instead of array).
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/core/test/fixtures/configs/valid-config.json](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/configs/valid-config.json)

- **Key Functionality**: Adds a valid JSON configuration file for testing schema loading.
- **Major Notes**:
  - Includes common configuration options like `version`, `paths`, `patterns`, and `concurrency`.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/core/test/fixtures/sample-project/README.md](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/README.md)

- **Key Functionality**: Adds a README file to the sample project fixture.
- **Major Notes**:
  - Simple README content.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/core/test/fixtures/sample-project/package.json](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/package.json)

- **Key Functionality**: Adds a package.json to the sample project fixture.
- **Major Notes**:
  - Basic package.json with `name`, `version`, and `type: "module"`.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/core/test/fixtures/sample-project/src/index.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/src/index.ts)

- **Key Functionality**: Adds an example TypeScript file to the sample project fixture.
- **Major Notes**:
  - Contains an `async function` (`fetchData`) and code using `Effect.gen`.
  - Imports from `./utils/helper`.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/core/test/fixtures/sample-project/src/legacy.js](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/src/legacy.js)

- **Key Functionality**: Adds an example JavaScript file to the sample project fixture.
- **Major Notes**:
  - Uses `require()` for Node.js modules (`fs`, `path`).
  - Exports a `readConfig` function.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/core/test/fixtures/sample-project/src/services/api.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/src/services/api.ts)

- **Key Functionality**: Adds an example TypeScript service file to the sample project fixture.
- **Major Notes**:
  - Uses `Effect.gen` and imports from `./utils/helper`.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [packages/core/test/fixtures/sample-project/src/utils/helper.ts](file:///Users/metis/Projects/effect-migrate/packages/core/test/fixtures/sample-project/src/utils/helper.ts)

- **Key Functionality**: Adds an example TypeScript helper file to the sample project fixture.
- **Major Notes**:
  - Exports a simple `Effect.succeed` function and an `async function legacyHelper`.
- **Questionable Code / Areas for Improvement**:
  - No issues found.

### [vitest.config.ts](file:///Users/metis/Projects/effect-migrate/vitest.config.ts)

- **Key Functionality**: Adds a root Vitest configuration file to manage tests across multiple packages.
- **Major Notes**:
  - Configures Vitest to run tests for `@effect-migrate/core`, `@effect-migrate/cli`, and `@effect-migrate/preset-basic` as separate projects.
  - Sets up common test options like `environment: "node"` and `globals: true`.
- **Questionable Code / Areas for Improvement**:
  - No issues found.
