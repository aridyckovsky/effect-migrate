import { AmpAuditContext, AmpContextIndex, SCHEMA_VERSION } from "@effect-migrate/core/schema"
import { describe, expect, it } from "@effect/vitest"
import * as Schema from "effect/Schema"

describe("Schema Version Registry", () => {
  it("SCHEMA_VERSION is defined", () => {
    expect(SCHEMA_VERSION).toBe("0.2.0")
  })

  it("index schema accepts valid structure", () => {
    const validIndex = {
      schemaVersion: "0.2.0",
      toolVersion: "0.3.0",
      projectRoot: ".",
      timestamp: new Date().toISOString(),
      files: {
        audit: "./audit.json"
      }
    }

    const result = Schema.decodeUnknownSync(AmpContextIndex)(validIndex)
    expect(result.schemaVersion).toBe("0.2.0")
  })

  it("audit schema accepts schemaVersion and revision", () => {
    const validAudit = {
      schemaVersion: "0.2.0",
      revision: 1,
      toolVersion: "0.3.0",
      projectRoot: ".",
      timestamp: new Date().toISOString(),
      findings: {
        rules: [],
        files: [],
        results: [],
        groups: {
          byFile: {},
          byRule: {}
        },
        summary: { errors: 0, warnings: 0, info: 0, totalFiles: 0, totalFindings: 0 }
      },
      config: {
        rulesEnabled: ["no-async-await"],
        failOn: ["error"]
      }
    }

    const result = Schema.decodeUnknownSync(AmpAuditContext)(validAudit)
    expect(result.schemaVersion).toBe("0.2.0")
    expect(result.revision).toBe(1)
  })
})
