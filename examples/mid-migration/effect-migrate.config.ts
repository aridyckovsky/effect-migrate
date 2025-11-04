import { defineConfig } from "@effect-migrate/core"
import { basicPreset } from "@effect-migrate/preset-basic"

export default defineConfig({
  version: 1,
  paths: {
    root: "./src",
    exclude: ["node_modules/**", "dist/**"]
  },
  presets: [basicPreset]
})
