# @effect-migrate/preset-basic

Default Effect migration rules for detecting legacy patterns and enforcing architectural boundaries.

## Installation

```bash
pnpm add -D @effect-migrate/preset-basic
```

## Usage

Add the preset to your `effect-migrate.config.ts`:

```typescript
import type { Config } from "@effect-migrate/core"

export default {
  version: 1,
  presets: ["@effect-migrate/preset-basic"],
  paths: {
    root: ".",
    include: ["src/**/*.ts"]
  }
} satisfies Config
```

The preset automatically loads all pattern and boundary rules, plus sensible config defaults.

## What's Included

### Pattern Rules (5 rules)

Pattern rules detect legacy code patterns that should be migrated to Effect equivalents.

#### `no-async-await`

**Detects:** `async` function declarations and arrow functions

**Why:** async/await cannot be interrupted, retried, or composed with Effects. Effect.gen provides all async/await benefits plus interruption, retry, and structured concurrency.

**Example violation:**

```typescript
// ❌ Detected
async function fetchUser(id: string) {
  const response = await fetch(`/users/${id}`)
  return response.json()
}
```

**Fix:**

```typescript
// ✅ Use Effect.gen
const fetchUser = (id: string) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise(() => fetch(`/users/${id}`))
    const data = yield* Effect.tryPromise(() => response.json())
    return data
  })
```

---

#### `no-new-promise`

**Detects:** `new Promise<T>(...)` constructor calls

**Why:** Raw Promises lack resource safety and composability. Effect provides better abstractions for async operations.

**Example violation:**

```typescript
// ❌ Detected
function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
```

**Fix:**

```typescript
// ✅ Use Effect.sleep
const delay = (ms: number) => Effect.sleep(Duration.millis(ms))

// ✅ Or Effect.async for custom async operations
const delay = (ms: number) =>
  Effect.async<void>((resume) => {
    const id = setTimeout(() => resume(Effect.void), ms)
    return Effect.sync(() => clearTimeout(id))
  })
```

---

#### `no-try-catch`

**Detects:** `try { ... } catch` blocks

**Why:** try/catch doesn't compose well with Effects and loses type information. Effect.catchAll and Effect.catchTag provide typed error handling.

**Example violation:**

```typescript
// ❌ Detected
function parseJSON(text: string) {
  try {
    return JSON.parse(text)
  } catch (error) {
    return null
  }
}
```

**Fix:**

```typescript
// ✅ Use Effect.try
const parseJSON = (text: string) =>
  Effect.try({
    try: () => JSON.parse(text),
    catch: (error) => new ParseError({ message: String(error) })
  })

// ✅ Or handle specific error types
const program = Effect.gen(function* () {
  const data = yield* parseJSON(text).pipe(
    Effect.catchTag("ParseError", () => Effect.succeed(null))
  )
  return data
})
```

---

#### `no-barrel-import-effect`

**Detects:** `import { ... } from "effect"` (barrel imports)

**Why:** Barrel imports hurt tree-shaking and increase bundle size. Import from specific modules for better optimization.

**Example violation:**

```typescript
// ❌ Detected
import { Effect, Console, pipe } from "effect"
```

**Fix:**

```typescript
// ✅ Import from specific modules
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import { pipe } from "effect/Function"
```

---

#### `no-fs-promises`

**Detects:** `from "fs/promises"` or `from "node:fs/promises"` imports

**Why:** Direct Node.js filesystem imports couple code to Node.js. Use @effect/platform FileSystem for cross-platform compatibility and resource safety.

**Example violation:**

```typescript
// ❌ Detected
import { readFile } from "fs/promises"

async function loadConfig(path: string) {
  const content = await readFile(path, "utf-8")
  return JSON.parse(content)
}
```

**Fix:**

```typescript
// ✅ Use @effect/platform FileSystem
import { FileSystem } from "@effect/platform"
import * as Effect from "effect/Effect"

const loadConfig = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString(path)
    return JSON.parse(content)
  })
```

---

### Boundary Rules (4 rules)

Boundary rules enforce architectural constraints to maintain clean separation between Effect and platform-specific code.

#### `no-node-in-services`

**Severity:** Error

**Enforces:** Service layer (`src/services/**/*.ts`) cannot import Node.js built-ins (`node:*`)

**Why:** Services should be platform-agnostic for testability and reusability.

**Example violation:**

```typescript
// ❌ src/services/ConfigService.ts
import { readFileSync } from "node:fs"
```

**Fix:**

```typescript
// ✅ Use @effect/platform abstraction
import { FileSystem } from "@effect/platform"
```

**Docs:** https://effect.website/docs/guides/platform/overview

---

#### `no-platform-node-in-core`

**Severity:** Error

**Enforces:** Core logic (`src/core/**/*.ts`) cannot import `@effect/platform-node`

**Why:** Core modules should depend on platform-agnostic abstractions only.

**Example violation:**

```typescript
// ❌ src/core/parser.ts
import { FileSystem } from "@effect/platform-node"
```

**Fix:**

```typescript
// ✅ Import from platform-agnostic package
import { FileSystem } from "@effect/platform"
```

**Docs:** https://effect.website/docs/guides/platform/platform-specific

---

#### `no-fs-promises` (boundary)

**Severity:** Warning

**Enforces:** Source files (`src/**/*.ts`) should not import `fs/promises`, `node:fs/promises`, or `node:fs`

**Why:** Direct filesystem imports couple code to Node.js. Use @effect/platform FileSystem service.

**Fix:** Use `FileSystem` from `@effect/platform` (see pattern rule example above)

**Docs:** https://effect.website/docs/guides/platform/file-system

---

#### `no-node-path`

**Severity:** Warning

**Enforces:** Source files (`src/**/*.ts`) should not import `path` or `node:path`

**Why:** Direct path imports couple code to Node.js. Use @effect/platform Path service for cross-platform path handling.

**Example violation:**

```typescript
// ❌ Detected
import path from "path"

const joined = path.join("src", "index.ts")
```

**Fix:**

```typescript
// ✅ Use @effect/platform Path
import { Path } from "@effect/platform"
import * as Effect from "effect/Effect"

const program = Effect.gen(function* () {
  const path = yield* Path.Path
  const joined = path.join("src", "index.ts")
  return joined
})
```

**Docs:** https://effect.website/docs/guides/platform/path

---

## Config Defaults

The preset provides sensible defaults that are merged with your config:

```typescript
{
  paths: {
    exclude: ["node_modules/**", "dist/**", ".next/**", "coverage/**", ".git/**", "build/**"]
  }
}
```

**You can override or extend these:**

```typescript
export default {
  version: 1,
  presets: ["@effect-migrate/preset-basic"],
  paths: {
    exclude: ["vendor/**"] // Extends preset excludes
  }
} satisfies Config
```

## Rule Summary

| Rule ID                     | Type     | Severity | Detects                         |
| --------------------------- | -------- | -------- | ------------------------------- |
| `no-async-await`            | pattern  | warning  | async functions                 |
| `no-new-promise`            | pattern  | warning  | new Promise() constructor       |
| `no-try-catch`              | pattern  | warning  | try/catch blocks                |
| `no-barrel-import-effect`   | pattern  | warning  | import from "effect"            |
| `no-fs-promises`            | pattern  | warning  | import from "fs/promises"       |
| `no-node-in-services`       | boundary | error    | node:\* in src/services/\*\*/\* |
| `no-platform-node-in-core`  | boundary | error    | @effect/platform-node in core   |
| `no-fs-promises` (boundary) | boundary | warning  | fs/promises in src/\*\*/\*      |
| `no-node-path`              | boundary | warning  | node:path in src/\*\*/\*        |

## Disabling Rules

To disable specific preset rules, filter them out after loading:

```typescript
import { presetBasic } from "@effect-migrate/preset-basic"

export default {
  version: 1,
  presets: [], // Don't use preset field
  // Manually load and filter
  patterns: presetBasic.rules
    .filter((rule) => rule.kind === "pattern" && rule.id !== "no-barrel-import-effect")
    .map((rule) => ({
      id: rule.id
      // ... convert to config format
    }))
} satisfies Config
```

Or use `@effect-migrate-ignore` comments in your code to suppress specific violations:

```typescript
// @effect-migrate-ignore
async function legacyFunction() {
  // This won't trigger no-async-await
}
```

## Creating Custom Presets

To create your own preset, export an object matching the `Preset` interface:

```typescript
import type { Preset } from "@effect-migrate/core"

export const myPreset: Preset = {
  rules: [
    // Your custom rules
  ],
  defaults: {
    paths: {
      exclude: ["vendor/**"]
    }
  }
}

export default myPreset
```

## License

MIT
