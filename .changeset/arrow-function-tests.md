---
"@effect-migrate/preset-basic": patch
---

Add comprehensive tests for async arrow function detection in noAsyncAwait rule. The rule already supported arrow functions, but tests only covered `async function` declarations. Now includes tests for:
- Arrow functions without parameters: `async () => {}`
- Arrow functions with multiple parameters: `async (id, name) => {}`
- Arrow functions with single parameter: `async x => {}`
