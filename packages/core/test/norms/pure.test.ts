import { describe, expect, it } from "@effect/vitest"
import * as Option from "effect/Option"
import {
  type CheckpointData,
  computeDirectoryStats,
  detectExtinctNorms,
  determineStatus,
  dirKeyFromPath,
  findCleanTimestamp,
  type NormData
} from "../../src/norms/pure.js"

describe("pure helpers", () => {
  describe("dirKeyFromPath", () => {
    it("should extract directory at depth 2", () => {
      expect(dirKeyFromPath("src/services/UserService.ts", 2)).toBe("src/services")
      expect(dirKeyFromPath("packages/core/src/index.ts", 2)).toBe("packages/core")
    })

    it("should handle different depths", () => {
      expect(dirKeyFromPath("src/services/auth/UserService.ts", 3)).toBe("src/services/auth")
      expect(dirKeyFromPath("src/index.ts", 1)).toBe("src")
      expect(dirKeyFromPath("packages/core/src/services/file.ts", 4)).toBe(
        "packages/core/src/services"
      )
    })

    it("should handle edge cases", () => {
      expect(dirKeyFromPath("file.ts", 1)).toBe("file.ts")
      expect(dirKeyFromPath("src/file.ts", 5)).toBe("src/file.ts")
    })
  })

  describe("detectExtinctNorms", () => {
    it("should detect rule that went to zero and stayed there", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/UserService.ts"],
            results: [{ rule: 0, file: 0, range: [1, 1, 1, 10] }]
          }
        },
        {
          checkpointId: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/UserService.ts"],
            results: [] // Fixed!
          }
        },
        {
          checkpointId: "cp-3",
          timestamp: "2025-11-03T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/UserService.ts"],
            results: [] // Still zero
          }
        }
      ]

      // lookbackWindow=1 to test with minimal data
      const norms = detectExtinctNorms(checkpoints, "src/services", 1)

      expect(norms).toHaveLength(1)
      expect(norms[0].ruleId).toBe("no-async")
      expect(norms[0].ruleKind).toBe("pattern")
      expect(norms[0].severity).toBe("error")
      expect(norms[0].violationsFixed).toBe(1)
      expect(norms[0].establishedAt).toBe("2025-11-02T10:00:00Z")
    })

    it("should require lookback window consensus", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/file.ts"],
            results: [{ rule: 0, file: 0 }]
          }
        },
        {
          checkpointId: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/file.ts"],
            results: [] // Fixed
          }
        },
        {
          checkpointId: "cp-3",
          timestamp: "2025-11-03T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/file.ts"],
            results: [{ rule: 0, file: 0 }] // Regressed!
          }
        }
      ]

      // With lookbackWindow=1, last checkpoint has violations, so NO norm
      const norms = detectExtinctNorms(checkpoints, "src/services", 1)
      expect(norms).toHaveLength(0)
    })

    it("should require prior non-zero violations", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/file.ts"],
            results: [] // Always clean
          }
        },
        {
          checkpointId: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/file.ts"],
            results: [] // Still clean
          }
        }
      ]

      // No norm because it was never dirty
      const norms = detectExtinctNorms(checkpoints, "src/services", 1)
      expect(norms).toHaveLength(0)
    })

    it("should filter by directory correctly", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/UserService.ts", "src/utils/helper.ts"],
            results: [
              { rule: 0, file: 0 }, // src/services
              { rule: 0, file: 1 } // src/utils
            ]
          }
        },
        {
          checkpointId: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/UserService.ts", "src/utils/helper.ts"],
            results: [
              { rule: 0, file: 1 } // Only src/utils still has violations
            ]
          }
        },
        {
          checkpointId: "cp-3",
          timestamp: "2025-11-03T10:00:00Z",
          findings: {
            rules: [{ id: "no-async", kind: "pattern", severity: "error", message: "No async" }],
            files: ["src/services/UserService.ts", "src/utils/helper.ts"],
            results: [{ rule: 0, file: 1 }]
          }
        }
      ]

      // src/services became clean
      const serviceNorms = detectExtinctNorms(checkpoints, "src/services", 1)
      expect(serviceNorms).toHaveLength(1)
      expect(serviceNorms[0].violationsFixed).toBe(1)

      // src/utils still has violations
      const utilsNorms = detectExtinctNorms(checkpoints, "src/utils", 1)
      expect(utilsNorms).toHaveLength(0)
    })

    it("should track multiple rules independently", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [
              { id: "no-async", kind: "pattern", severity: "error", message: "No async" },
              { id: "no-promise", kind: "pattern", severity: "warning", message: "No promise" }
            ],
            files: ["src/services/file.ts"],
            results: [
              { rule: 0, file: 0 }, // no-async
              { rule: 1, file: 0 } // no-promise
            ]
          }
        },
        {
          checkpointId: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          findings: {
            rules: [
              { id: "no-async", kind: "pattern", severity: "error", message: "No async" },
              { id: "no-promise", kind: "pattern", severity: "warning", message: "No promise" }
            ],
            files: ["src/services/file.ts"],
            results: [
              { rule: 1, file: 0 } // Only no-promise remains
            ]
          }
        },
        {
          checkpointId: "cp-3",
          timestamp: "2025-11-03T10:00:00Z",
          findings: {
            rules: [
              { id: "no-async", kind: "pattern", severity: "error", message: "No async" },
              { id: "no-promise", kind: "pattern", severity: "warning", message: "No promise" }
            ],
            files: ["src/services/file.ts"],
            results: [] // Both fixed
          }
        },
        {
          checkpointId: "cp-4",
          timestamp: "2025-11-04T10:00:00Z",
          findings: {
            rules: [
              { id: "no-async", kind: "pattern", severity: "error", message: "No async" },
              { id: "no-promise", kind: "pattern", severity: "warning", message: "No promise" }
            ],
            files: ["src/services/file.ts"],
            results: []
          }
        }
      ]

      const norms = detectExtinctNorms(checkpoints, "src/services", 1)
      expect(norms).toHaveLength(2)

      const asyncNorm = norms.find(n => n.ruleId === "no-async")
      const promiseNorm = norms.find(n => n.ruleId === "no-promise")

      expect(asyncNorm).toBeDefined()
      expect(asyncNorm?.establishedAt).toBe("2025-11-02T10:00:00Z")
      expect(asyncNorm?.violationsFixed).toBe(1)

      expect(promiseNorm).toBeDefined()
      expect(promiseNorm?.establishedAt).toBe("2025-11-03T10:00:00Z")
      expect(promiseNorm?.violationsFixed).toBe(1)
    })

    it("should handle empty checkpoints", () => {
      const norms = detectExtinctNorms([], "src/services", 5)
      expect(norms).toHaveLength(0)
    })

    it("should include docsUrl when available", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [
              {
                id: "no-async",
                kind: "pattern",
                severity: "error",
                message: "No async",
                docsUrl: "https://docs.example.com/no-async"
              }
            ],
            files: ["src/services/file.ts"],
            results: [{ rule: 0, file: 0 }]
          }
        },
        {
          checkpointId: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          findings: {
            rules: [
              {
                id: "no-async",
                kind: "pattern",
                severity: "error",
                message: "No async",
                docsUrl: "https://docs.example.com/no-async"
              }
            ],
            files: ["src/services/file.ts"],
            results: []
          }
        }
      ]

      const norms = detectExtinctNorms(checkpoints, "src/services", 1)
      expect(norms).toHaveLength(1)
      expect(norms[0].docsUrl).toBe("https://docs.example.com/no-async")
    })
  })

  describe("computeDirectoryStats", () => {
    it("should compute stats from latest checkpoint", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: [
              "src/services/UserService.ts",
              "src/services/AuthService.ts",
              "src/utils/helper.ts"
            ],
            results: [
              { rule: 0, file: 0 },
              { rule: 0, file: 1 },
              { rule: 0, file: 2 }
            ]
          }
        },
        {
          checkpointId: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: [
              "src/services/UserService.ts",
              "src/services/AuthService.ts",
              "src/utils/helper.ts"
            ],
            results: [
              { rule: 0, file: 0 } // Only UserService has violations now
            ]
          }
        }
      ]

      const stats = computeDirectoryStats(checkpoints, "src/services")
      expect(stats.total).toBe(2) // UserService + AuthService
      expect(stats.withViolations).toBe(1) // UserService
      expect(stats.clean).toBe(1) // AuthService
    })

    it("should handle directory with no files", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: ["src/utils/helper.ts"],
            results: []
          }
        }
      ]

      const stats = computeDirectoryStats(checkpoints, "src/services")
      expect(stats.total).toBe(0)
      expect(stats.clean).toBe(0)
      expect(stats.withViolations).toBe(0)
    })

    it("should handle empty checkpoints", () => {
      const stats = computeDirectoryStats([], "src/services")
      expect(stats.total).toBe(0)
      expect(stats.clean).toBe(0)
      expect(stats.withViolations).toBe(0)
    })

    it("should count file only once even with multiple violations", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: ["src/services/UserService.ts", "src/services/AuthService.ts"],
            results: [
              { rule: 0, file: 0, range: [1, 1, 1, 10] },
              { rule: 0, file: 0, range: [2, 1, 2, 10] },
              { rule: 0, file: 0, range: [3, 1, 3, 10] }
            ]
          }
        }
      ]

      const stats = computeDirectoryStats(checkpoints, "src/services")
      expect(stats.total).toBe(2)
      expect(stats.withViolations).toBe(1) // UserService counted once
      expect(stats.clean).toBe(1) // AuthService
    })
  })

  describe("determineStatus", () => {
    it("should return migrated when clean with norms", () => {
      const stats = { total: 10, clean: 10, withViolations: 0 }
      const norms: NormData[] = [
        {
          ruleId: "test",
          ruleKind: "pattern",
          severity: "error" as const,
          establishedAt: "2025-11-01T10:00:00Z",
          violationsFixed: 5
        }
      ]
      const status = determineStatus(stats, norms)
      expect(status).toBe("migrated")
    })

    it("should return in-progress when violations remain", () => {
      const stats = { total: 10, clean: 5, withViolations: 5 }
      const norms: NormData[] = [
        {
          ruleId: "test",
          ruleKind: "pattern",
          severity: "error" as const,
          establishedAt: "2025-11-01T10:00:00Z",
          violationsFixed: 5
        }
      ]
      const status = determineStatus(stats, norms)
      expect(status).toBe("in-progress")
    })

    it("should return in-progress when clean files exist but no norms", () => {
      const stats = { total: 10, clean: 5, withViolations: 5 }
      const norms: never[] = []
      const status = determineStatus(stats, norms)
      expect(status).toBe("in-progress")
    })

    it("should return not-started when no files", () => {
      const stats = { total: 0, clean: 0, withViolations: 0 }
      const norms: never[] = []
      const status = determineStatus(stats, norms)
      expect(status).toBe("not-started")
    })

    it("should return not-started when no activity", () => {
      const stats = { total: 10, clean: 0, withViolations: 10 }
      const norms: never[] = []
      const status = determineStatus(stats, norms)
      expect(status).toBe("not-started")
    })
  })

  describe("findCleanTimestamp", () => {
    it("should find when directory became clean", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: ["src/services/file.ts"],
            results: [{ rule: 0, file: 0 }]
          }
        },
        {
          checkpointId: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: ["src/services/file.ts"],
            results: []
          }
        },
        {
          checkpointId: "cp-3",
          timestamp: "2025-11-03T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: ["src/services/file.ts"],
            results: []
          }
        }
      ]

      const cleanTimestamp = findCleanTimestamp(checkpoints, "src/services")
      expect(Option.isSome(cleanTimestamp)).toBe(true)
      if (Option.isSome(cleanTimestamp)) {
        expect(cleanTimestamp.value).toBe("2025-11-02T10:00:00Z")
      }
    })

    it("should return None if never clean", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: ["src/services/file.ts"],
            results: [{ rule: 0, file: 0 }]
          }
        },
        {
          checkpointId: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: ["src/services/file.ts"],
            results: [{ rule: 0, file: 0 }]
          }
        }
      ]

      const cleanTimestamp = findCleanTimestamp(checkpoints, "src/services")
      expect(Option.isNone(cleanTimestamp)).toBe(true)
    })

    it("should return None if became clean then regressed", () => {
      const checkpoints: CheckpointData[] = [
        {
          checkpointId: "cp-1",
          timestamp: "2025-11-01T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: ["src/services/file.ts"],
            results: [{ rule: 0, file: 0 }]
          }
        },
        {
          checkpointId: "cp-2",
          timestamp: "2025-11-02T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: ["src/services/file.ts"],
            results: []
          }
        },
        {
          checkpointId: "cp-3",
          timestamp: "2025-11-03T10:00:00Z",
          findings: {
            rules: [{ id: "test", kind: "pattern", severity: "error", message: "Test" }],
            files: ["src/services/file.ts"],
            results: [{ rule: 0, file: 0 }] // Regressed!
          }
        }
      ]

      const cleanTimestamp = findCleanTimestamp(checkpoints, "src/services")
      expect(Option.isNone(cleanTimestamp)).toBe(true)
    })

    it("should handle empty checkpoints", () => {
      const cleanTimestamp = findCleanTimestamp([], "src/services")
      expect(Option.isNone(cleanTimestamp)).toBe(true)
    })
  })
})
