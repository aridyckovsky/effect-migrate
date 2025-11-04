import * as effectEslint from "@effect/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/.git/**",
      "**/build/**",
      "**/test/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
  },
  // Include Effect's dprint formatting config
  ...effectEslint.configs.dprint,
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/*.config.ts", "**/*.config.js", "**/*.config.mjs"],
    extends: [tseslint.configs.base],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Configure dprint formatting
      "@effect/dprint": [
        "error",
        {
          config: {
            indentWidth: 2,
            lineWidth: 100,
            semiColons: "asi",
            quoteStyle: "alwaysDouble",
            trailingCommas: "never",
            operatorPosition: "maintain",
            "arrowFunction.useParentheses": "preferNone",
          },
        },
      ],
      // Enforce no barrel imports from effect packages
      "@effect/no-import-from-barrel-package": ["error", {
        packageNames: ["effect", "@effect/platform", "@effect/cli", "@effect/platform-node"],
      }],
    },
  },
);
