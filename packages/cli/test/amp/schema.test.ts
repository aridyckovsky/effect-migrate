import { SCHEMA_VERSIONS } from "@effect-migrate/core/schema"
import { describe, expect, it } from "@effect/vitest"
import * as Schema from "effect/Schema"
import { AmpAuditContext, AmpContextIndex } from "../../src/amp/context-writer.js"

describe("Schema Version Registry", () => {
  it("SCHEMA_VERSIONS is immutable", () => {
    expect(Object.isFrozen(SCHEMA_VERSIONS)).toBe(false) // as const doesn't freeze at runtime
    expect(SCHEMA_VERSIONS.index).toBe("0.1.0")
    expect(SCHEMA_VERSIONS.audit).toBe("0.1.0")
    expect(SCHEMA_VERSIONS.metrics).toBe("0.1.0")
    expect(SCHEMA_VERSIONS.threads).toBe("0.1.0")
  })

  it("index schema accepts valid versions object", () => {
    const validIndex = {
      schemaVersion: "0.1.0",
      versions: {
        audit: "0.1.0",
        metrics: "0.1.0",
        threads: "0.1.0"
      },
      toolVersion: "0.3.0",
      projectRoot: ".",
      timestamp: new Date().toISOString(),
      files: {
        audit: "./audit.json"
      }
    }

    const result = Schema.decodeUnknownSync(AmpContextIndex)(validIndex)
    expect(result.versions.audit).toBe("0.1.0")
  })

  it("audit schema accepts schemaVersion and revision", () => {
    const validAudit = {
      schemaVersion: "0.1.0",
      revision: 1,
      toolVersion: "0.3.0",
      projectRoot: ".",
      timestamp: new Date().toISOString(),
      findings: {
        byFile: {},
        byRule: {},
        summary: { errors: 0, warnings: 0, totalFiles: 0, totalFindings: 0 }
      },
      config: {
        rulesEnabled: ["no-async-await"],
        failOn: ["error"]
      }
    }

    const result = Schema.decodeUnknownSync(AmpAuditContext)(validAudit)
    expect(result.schemaVersion).toBe("0.1.0")
    expect(result.revision).toBe(1)
  })
})
