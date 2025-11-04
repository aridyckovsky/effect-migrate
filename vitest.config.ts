import { defineWorkspace } from "vitest/config"

export default defineWorkspace([
  {
    extends: "./packages/core/vitest.config.ts",
    test: {
      name: "@effect-migrate/core",
      root: "./packages/core"
    }
  },
  {
    extends: "./packages/cli/vitest.config.ts",
    test: {
      name: "@effect-migrate/cli",
      root: "./packages/cli"
    }
  },
  {
    extends: "./packages/preset-basic/vitest.config.ts",
    test: {
      name: "@effect-migrate/preset-basic",
      root: "./packages/preset-basic"
    }
  }
])
