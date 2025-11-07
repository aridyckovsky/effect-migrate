/**
 * Tests for Amp Results Normalizer
 *
 * Verifies normalization and expansion of audit results.
 */

import { describe, expect, it } from "@effect/vitest"
import {
  deriveResultKey,
  deriveResultKeys,
  expandResult,
  normalizeResults,
  rebuildGroups
} from "../../src/amp/normalizer.js"
import type { RuleResult } from "../../src/rules/types.js"

describe("normalizeResults", () => {
  describe("deterministic ordering", () => {
    it("rules are sorted alphabetically by id", () => {
      const results: RuleResult[] = [
        {
          id: "zebra-rule",
          ruleKind: "pattern",
          severity: "error",
          message: "Z",
          file: "file1.ts"
        },
        {
          id: "alpha-rule",
          ruleKind: "pattern",
          severity: "warning",
          message: "A",
          file: "file2.ts"
        },
        { id: "beta-rule", ruleKind: "pattern", severity: "error", message: "B", file: "file3.ts" }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.rules).toHaveLength(3)
      expect(normalized.rules[0].id).toBe("alpha-rule")
      expect(normalized.rules[1].id).toBe("beta-rule")
      expect(normalized.rules[2].id).toBe("zebra-rule")
    })

    it("files are sorted alphabetically by path", () => {
      const results: RuleResult[] = [
        { id: "rule1", ruleKind: "pattern", severity: "error", message: "Msg", file: "z-file.ts" },
        { id: "rule1", ruleKind: "pattern", severity: "error", message: "Msg", file: "a-file.ts" },
        { id: "rule1", ruleKind: "pattern", severity: "error", message: "Msg", file: "m-file.ts" }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.files).toHaveLength(3)
      expect(normalized.files[0]).toBe("a-file.ts")
      expect(normalized.files[1]).toBe("m-file.ts")
      expect(normalized.files[2]).toBe("z-file.ts")
    })

    it("result indices match sorted rule positions", () => {
      const results: RuleResult[] = [
        { id: "zulu", ruleKind: "pattern", severity: "error", message: "Z", file: "file.ts" },
        { id: "alpha", ruleKind: "pattern", severity: "warning", message: "A", file: "file.ts" }
      ]

      const normalized = normalizeResults(results)

      // Rules sorted: alpha=0, zulu=1
      expect(normalized.rules[0].id).toBe("alpha")
      expect(normalized.rules[1].id).toBe("zulu")

      // Result array order unchanged, but rule indices remapped
      expect(normalized.results[0].rule).toBe(1) // First result references zulu (now at index 1)
      expect(normalized.results[1].rule).toBe(0) // Second result references alpha (now at index 0)
    })

    it("result indices match sorted file positions", () => {
      const results: RuleResult[] = [
        { id: "rule", ruleKind: "pattern", severity: "error", message: "M", file: "z.ts" },
        { id: "rule", ruleKind: "pattern", severity: "error", message: "M", file: "a.ts" }
      ]

      const normalized = normalizeResults(results)

      // Files sorted: a.ts=0, z.ts=1
      expect(normalized.files[0]).toBe("a.ts")
      expect(normalized.files[1]).toBe("z.ts")

      // Result array order unchanged, but file indices remapped
      expect(normalized.results[0].file).toBe(1) // First result references z.ts (now at index 1)
      expect(normalized.results[1].file).toBe(0) // Second result references a.ts (now at index 0)
    })

    it("produces identical output for same inputs across multiple runs", () => {
      const results: RuleResult[] = [
        { id: "zeta", ruleKind: "pattern", severity: "error", message: "Z", file: "z-file.ts" },
        { id: "beta", ruleKind: "pattern", severity: "warning", message: "B", file: "b-file.ts" },
        { id: "alpha", ruleKind: "pattern", severity: "error", message: "A", file: "a-file.ts" }
      ]

      const run1 = normalizeResults(results)
      const run2 = normalizeResults(results)
      const run3 = normalizeResults(results)

      // All runs produce identical rule order
      expect(run1.rules.map(r => r.id)).toEqual(["alpha", "beta", "zeta"])
      expect(run2.rules.map(r => r.id)).toEqual(run1.rules.map(r => r.id))
      expect(run3.rules.map(r => r.id)).toEqual(run1.rules.map(r => r.id))

      // All runs produce identical file order
      expect(run1.files).toEqual(["a-file.ts", "b-file.ts", "z-file.ts"])
      expect(run2.files).toEqual(run1.files)
      expect(run3.files).toEqual(run1.files)

      // All runs produce identical result indices
      expect(run2.results).toEqual(run1.results)
      expect(run3.results).toEqual(run1.results)

      // All runs produce identical groups
      expect(run2.groups).toEqual(run1.groups)
      expect(run3.groups).toEqual(run1.groups)
    })

    it("shuffling input order yields identical normalized arrays and stable keys", () => {
      const results: RuleResult[] = [
        {
          id: "rule-c",
          ruleKind: "pattern",
          severity: "error",
          message: "C",
          file: "file-z.ts",
          range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } }
        },
        {
          id: "rule-a",
          ruleKind: "pattern",
          severity: "warning",
          message: "A",
          file: "file-x.ts",
          range: { start: { line: 5, column: 1 }, end: { line: 5, column: 10 } }
        },
        {
          id: "rule-b",
          ruleKind: "pattern",
          severity: "error",
          message: "B",
          file: "file-y.ts",
          range: { start: { line: 15, column: 3 }, end: { line: 15, column: 18 } }
        }
      ]

      // Shuffle input order
      const shuffled: RuleResult[] = [results[1], results[2], results[0]]

      const normalized1 = normalizeResults(results)
      const normalized2 = normalizeResults(shuffled)

      // Rules arrays should be identical (both sorted)
      expect(normalized1.rules).toEqual(normalized2.rules)
      expect(normalized1.rules.map(r => r.id)).toEqual(["rule-a", "rule-b", "rule-c"])

      // Files arrays should be identical (both sorted)
      expect(normalized1.files).toEqual(normalized2.files)
      expect(normalized1.files).toEqual(["file-x.ts", "file-y.ts", "file-z.ts"])

      // Results array preserves input order, so indices differ
      expect(normalized1.results).not.toEqual(normalized2.results)

      // BUT the stable keys should be identical when sorted (same logical results)
      const keys1 = deriveResultKeys(normalized1)
      const keys2 = deriveResultKeys(normalized2)

      // Convert to arrays and sort for comparison
      const keyArray1 = Array.from(keys1.values()).sort()
      const keyArray2 = Array.from(keys2.values()).sort()

      // Same set of keys regardless of input order
      expect(keyArray1).toEqual(keyArray2)

      // Verify we can expand back to original results (ignoring order)
      const expanded1 = normalized1.results.map(r =>
        expandResult(r, normalized1.rules, normalized1.files)
      )
      const expanded2 = normalized2.results.map(r =>
        expandResult(r, normalized2.rules, normalized2.files)
      )

      // Convert to sets of keys for order-independent comparison
      const expandedKeys1 = expanded1.map(r => `${r.id}|${r.file}|${r.message}`).sort()
      const expandedKeys2 = expanded2.map(r => `${r.id}|${r.file}|${r.message}`).sort()

      expect(expandedKeys1).toEqual(expandedKeys2)
    })

    it("groups rebuilt with sorted indices are correct", () => {
      const results: RuleResult[] = [
        { id: "rule-z", ruleKind: "pattern", severity: "error", message: "M", file: "z.ts" },
        { id: "rule-a", ruleKind: "pattern", severity: "warning", message: "M", file: "a.ts" },
        { id: "rule-z", ruleKind: "pattern", severity: "error", message: "M", file: "a.ts" }
      ]

      const normalized = normalizeResults(results)

      // Rules sorted: rule-a=0, rule-z=1
      // Files sorted: a.ts=0, z.ts=1
      expect(normalized.rules[0].id).toBe("rule-a")
      expect(normalized.rules[1].id).toBe("rule-z")
      expect(normalized.files[0]).toBe("a.ts")
      expect(normalized.files[1]).toBe("z.ts")

      // Results reference sorted indices:
      // Result 0: rule-z (index 1), z.ts (index 1)
      // Result 1: rule-a (index 0), a.ts (index 0)
      // Result 2: rule-z (index 1), a.ts (index 0)
      expect(normalized.results[0].rule).toBe(1)
      expect(normalized.results[0].file).toBe(1)
      expect(normalized.results[1].rule).toBe(0)
      expect(normalized.results[1].file).toBe(0)
      expect(normalized.results[2].rule).toBe(1)
      expect(normalized.results[2].file).toBe(0)

      // byRule groups should use sorted indices
      expect(normalized.groups.byRule["0"]).toEqual([1]) // rule-a (sorted to 0) has result 1
      expect(normalized.groups.byRule["1"]).toEqual([0, 2]) // rule-z (sorted to 1) has results 0, 2

      // byFile groups should use sorted indices
      expect(normalized.groups.byFile["0"]).toEqual([1, 2]) // a.ts (sorted to 0) has results 1, 2
      expect(normalized.groups.byFile["1"]).toEqual([0]) // z.ts (sorted to 1) has result 0
    })
  })

  describe("basic behavior", () => {
    it("deduplicates rules (multiple results with same rule ID → single RuleDef)", () => {
      const results: RuleResult[] = [
        {
          id: "no-async",
          ruleKind: "pattern",
          severity: "error",
          message: "Avoid async/await",
          file: "file1.ts",
          range: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } }
        },
        {
          id: "no-async",
          ruleKind: "pattern",
          severity: "error",
          message: "Avoid async/await",
          file: "file2.ts",
          range: { start: { line: 5, column: 1 }, end: { line: 5, column: 10 } }
        },
        {
          id: "no-promises",
          ruleKind: "pattern",
          severity: "warning",
          message: "Avoid Promise constructor",
          file: "file3.ts"
        }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.rules).toHaveLength(2)
      expect(normalized.results).toHaveLength(3)
      expect(normalized.rules[0].id).toBe("no-async")
      expect(normalized.rules[1].id).toBe("no-promises")
    })

    it("deduplicates files (multiple results in same file → single file path)", () => {
      const results: RuleResult[] = [
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Msg1",
          file: "file1.ts"
        },
        {
          id: "rule2",
          ruleKind: "pattern",
          severity: "warning",
          message: "Msg2",
          file: "file1.ts"
        },
        {
          id: "rule3",
          ruleKind: "pattern",
          severity: "error",
          message: "Msg3",
          file: "file2.ts"
        }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.files).toHaveLength(2)
      expect(normalized.files[0]).toBe("file1.ts")
      expect(normalized.files[1]).toBe("file2.ts")
    })

    it("results count equals input count", () => {
      const results: RuleResult[] = [
        { id: "rule1", ruleKind: "pattern", severity: "error", message: "Msg", file: "file1.ts" },
        { id: "rule2", ruleKind: "pattern", severity: "warning", message: "Msg", file: "file2.ts" },
        { id: "rule3", ruleKind: "pattern", severity: "error", message: "Msg", file: "file3.ts" }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.results).toHaveLength(results.length)
      expect(normalized.results.length).toBe(3)
    })

    it("groups.byFile has correct index mappings", () => {
      const results: RuleResult[] = [
        { id: "rule1", ruleKind: "pattern", severity: "error", message: "Msg", file: "file1.ts" },
        { id: "rule2", ruleKind: "pattern", severity: "warning", message: "Msg", file: "file1.ts" },
        { id: "rule3", ruleKind: "pattern", severity: "error", message: "Msg", file: "file2.ts" }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.groups.byFile["0"]).toEqual([0, 1]) // file1.ts (index 0) has results 0,1
      expect(normalized.groups.byFile["1"]).toEqual([2]) // file2.ts (index 1) has result 2
    })

    it("groups.byRule has correct index mappings", () => {
      const results: RuleResult[] = [
        { id: "rule1", ruleKind: "pattern", severity: "error", message: "Msg", file: "file1.ts" },
        { id: "rule1", ruleKind: "pattern", severity: "error", message: "Msg", file: "file2.ts" },
        { id: "rule2", ruleKind: "pattern", severity: "warning", message: "Msg", file: "file3.ts" }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.groups.byRule["0"]).toEqual([0, 1]) // rule1 (index 0) has results 0,1
      expect(normalized.groups.byRule["1"]).toEqual([2]) // rule2 (index 1) has result 2
    })

    it("summary counts are accurate (errors, warnings, totalFiles, totalFindings)", () => {
      const results: RuleResult[] = [
        { id: "rule1", ruleKind: "pattern", severity: "error", message: "Msg", file: "file1.ts" },
        { id: "rule2", ruleKind: "pattern", severity: "warning", message: "Msg", file: "file2.ts" },
        { id: "rule3", ruleKind: "pattern", severity: "error", message: "Msg", file: "file3.ts" },
        { id: "rule4", ruleKind: "pattern", severity: "warning", message: "Msg", file: "file1.ts" }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.summary).toEqual({
        errors: 2,
        warnings: 2,
        totalFiles: 3,
        totalFindings: 4
      })
    })

    it("handles info severity in results", () => {
      const results: RuleResult[] = [
        { id: "rule1", ruleKind: "pattern", severity: "error", message: "Msg", file: "file1.ts" },
        { id: "rule2", ruleKind: "pattern", severity: "info", message: "Hint", file: "file2.ts" },
        { id: "rule3", ruleKind: "pattern", severity: "warning", message: "Msg", file: "file3.ts" }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.rules).toHaveLength(3)
      expect(normalized.rules[1].severity).toBe("info")
      expect(normalized.summary).toEqual({
        errors: 1,
        warnings: 2, // info counts as warning in summary
        totalFiles: 3,
        totalFindings: 3
      })
    })

    it("verifies specific size optimizations (deduplication math)", () => {
      // Create 100 results from 10 rules across 20 files
      const ruleIds = Array.from({ length: 10 }, (_, i) => `rule-${i}`)
      const filePaths = Array.from({ length: 20 }, (_, i) => `file-${i}.ts`)

      const results: RuleResult[] = []
      for (let i = 0; i < 100; i++) {
        results.push({
          id: ruleIds[i % 10],
          ruleKind: "pattern",
          severity: "error",
          message: `Message for ${ruleIds[i % 10]}`,
          file: filePaths[i % 20],
          range: { start: { line: i, column: 1 }, end: { line: i, column: 10 } }
        })
      }

      const normalized = normalizeResults(results)

      // Verify deduplication
      expect(normalized.rules.length).toBe(10) // 100 → 10 unique rules
      expect(normalized.files.length).toBe(20) // 100 → 20 unique files
      expect(normalized.results.length).toBe(100) // Same number of results

      // Verify compact ranges (tuple vs object)
      const sampleResult = normalized.results[0]
      expect(sampleResult.range).toBeDefined()
      expect(Array.isArray(sampleResult.range)).toBe(true)
      expect(sampleResult.range?.length).toBe(4)

      // Verify size reduction by comparing JSON sizes
      const legacySize = JSON.stringify(results).length
      const normalizedSize = JSON.stringify(normalized).length
      const reduction = ((legacySize - normalizedSize) / legacySize) * 100

      expect(reduction).toBeGreaterThan(40) // Should exceed 40% reduction
      expect(normalizedSize).toBeLessThan(legacySize)
    })

    it("counts info severity as warnings in summary", () => {
      const results: RuleResult[] = [
        { id: "r1", ruleKind: "pattern", severity: "error", message: "E" },
        { id: "r2", ruleKind: "pattern", severity: "warning", message: "W" },
        { id: "r3", ruleKind: "pattern", severity: "info", message: "I" }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.summary.errors).toBe(1)
      expect(normalized.summary.warnings).toBe(2) // warning + info
      expect(normalized.summary.totalFindings).toBe(3)
    })
  })

  describe("expandResult correctness", () => {
    it("reconstructs full RuleResult from CompactResult", () => {
      const rules = [
        {
          id: "no-async",
          kind: "pattern",
          severity: "warning" as const,
          message: "Replace async/await",
          docsUrl: "https://effect.website"
        }
      ]
      const files = ["file1.ts"]
      const compact = {
        rule: 0,
        file: 0,
        range: [10, 5, 10, 20] as [number, number, number, number]
      }

      const expanded = expandResult(compact, rules, files)

      expect(expanded).toEqual({
        id: "no-async",
        ruleKind: "pattern",
        severity: "warning",
        message: "Replace async/await",
        file: "file1.ts",
        range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } },
        docsUrl: "https://effect.website"
      })
    })

    it("handles info severity correctly", () => {
      const rules = [
        {
          id: "migration-hint",
          kind: "pattern",
          severity: "info" as const,
          message: "Consider using Effect pattern here"
        }
      ]
      const files = ["file1.ts"]
      const compact = {
        rule: 0,
        file: 0,
        range: [5, 0, 5, 15] as [number, number, number, number]
      }

      const expanded = expandResult(compact, rules, files)

      expect(expanded.severity).toBe("info")
      expect(expanded).toEqual({
        id: "migration-hint",
        ruleKind: "pattern",
        severity: "info",
        message: "Consider using Effect pattern here",
        file: "file1.ts",
        range: { start: { line: 5, column: 0 }, end: { line: 5, column: 15 } }
      })
    })

    it("handles range tuple → range object conversion", () => {
      const rules = [
        {
          id: "rule1",
          kind: "pattern",
          severity: "error" as const,
          message: "Test message"
        }
      ]
      const compact = {
        rule: 0,
        range: [15, 3, 18, 25] as [number, number, number, number]
      }

      const expanded = expandResult(compact, rules, [])

      expect(expanded.range).toEqual({
        start: { line: 15, column: 3 },
        end: { line: 18, column: 25 }
      })
    })

    it("uses message override when present", () => {
      const rules = [
        {
          id: "rule1",
          kind: "pattern",
          severity: "error" as const,
          message: "Template message"
        }
      ]
      const compact = {
        rule: 0,
        message: "Custom message override"
      }

      const expanded = expandResult(compact, rules, [])

      expect(expanded.message).toBe("Custom message override")
    })

    it("preserves docsUrl and tags from RuleDef", () => {
      const rules = [
        {
          id: "rule1",
          kind: "pattern",
          severity: "warning" as const,
          message: "Test message",
          docsUrl: "https://docs.example.com/rule1",
          tags: ["migration", "async"]
        }
      ]
      const compact = {
        rule: 0,
        file: 0
      }

      const expanded = expandResult(compact, rules, ["file1.ts"])

      expect(expanded.docsUrl).toBe("https://docs.example.com/rule1")
      expect(expanded.tags).toEqual(["migration", "async"])
    })
  })

  describe("size reduction verification", () => {
    it("achieves >40% size reduction on large dataset", () => {
      // Generate 1000 findings across 50 files, 10 rules
      const results: RuleResult[] = []
      for (let i = 0; i < 1000; i++) {
        results.push({
          id: `rule-${i % 10}`,
          ruleKind: "pattern",
          severity: i % 3 === 0 ? "error" : "warning",
          message: `Message for rule ${i % 10}`,
          file: `src/file-${i % 50}.ts`,
          range: { start: { line: i, column: 1 }, end: { line: i, column: 10 } },
          docsUrl: `https://docs/${i % 10}`,
          tags: ["tag1", "tag2"]
        })
      }

      const normalized = normalizeResults(results)

      // Measure JSON sizes
      const normalizedSize = JSON.stringify(normalized).length
      const legacySize = JSON.stringify(results).length

      const reduction = ((legacySize - normalizedSize) / legacySize) * 100

      // Log for verification
      console.log(`Legacy size: ${legacySize} bytes`)
      console.log(`Normalized size: ${normalizedSize} bytes`)
      console.log(`Reduction: ${reduction.toFixed(1)}%`)

      expect(reduction).toBeGreaterThan(40) // At least 40% reduction
    })
  })

  describe("edge cases", () => {
    it("handles empty results array", () => {
      const normalized = normalizeResults([])

      expect(normalized.rules).toHaveLength(0)
      expect(normalized.files).toHaveLength(0)
      expect(normalized.results).toHaveLength(0)
      expect(normalized.groups.byFile).toEqual({})
      expect(normalized.groups.byRule).toEqual({})
      expect(normalized.summary).toEqual({
        errors: 0,
        warnings: 0,
        totalFiles: 0,
        totalFindings: 0
      })
    })

    it("handles file-less results (only in byRule, not byFile)", () => {
      const results: RuleResult[] = [
        { id: "global-rule", ruleKind: "docs", severity: "warning", message: "Missing docs" },
        {
          id: "file-rule",
          ruleKind: "pattern",
          severity: "error",
          message: "Pattern error",
          file: "file1.ts"
        }
      ]

      const normalized = normalizeResults(results)

      // Rules are sorted: file-rule=0, global-rule=1
      expect(normalized.rules[0].id).toBe("file-rule")
      expect(normalized.rules[1].id).toBe("global-rule")

      // File-less result should not appear in byFile
      expect(normalized.groups.byFile).not.toHaveProperty("undefined")
      expect(Object.keys(normalized.groups.byFile)).toHaveLength(1)
      expect(normalized.groups.byFile["0"]).toEqual([1]) // Only file-based result

      // But should appear in byRule (with sorted indices)
      expect(normalized.groups.byRule["0"]).toEqual([1]) // file-rule (sorted to 0) has result 1
      expect(normalized.groups.byRule["1"]).toEqual([0]) // global-rule (sorted to 1) has result 0
    })

    it("handles results without ranges", () => {
      const results: RuleResult[] = [
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "No range",
          file: "file1.ts"
        }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.results[0].range).toBeUndefined()

      // Verify expansion also handles missing range
      const expanded = expandResult(normalized.results[0], normalized.rules, normalized.files)
      expect(expanded.range).toBeUndefined()
    })

    it("handles message overrides correctly", () => {
      const results: RuleResult[] = [
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Custom message for this instance",
          file: "file1.ts"
        },
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Custom message for this instance", // Same message as template
          file: "file2.ts"
        }
      ]

      const normalized = normalizeResults(results)

      // First result should NOT have message override (matches template)
      expect(normalized.results[0].message).toBeUndefined()
      // Second result should also NOT have message override (matches template)
      expect(normalized.results[1].message).toBeUndefined()

      // Now test with actual override
      const resultsWithOverride: RuleResult[] = [
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Standard message",
          file: "file1.ts"
        },
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Different message for this one",
          file: "file2.ts"
        }
      ]

      const normalizedWithOverride = normalizeResults(resultsWithOverride)

      // First result: no override (matches template)
      expect(normalizedWithOverride.results[0].message).toBeUndefined()
      // Second result: has override (different from template)
      expect(normalizedWithOverride.results[1].message).toBe("Different message for this one")
    })

    it("handles results with tags and docsUrl", () => {
      const results: RuleResult[] = [
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Test",
          file: "file1.ts",
          docsUrl: "https://docs.example.com",
          tags: ["migration", "async"]
        }
      ]

      const normalized = normalizeResults(results)

      expect(normalized.rules[0].docsUrl).toBe("https://docs.example.com")
      expect(normalized.rules[0].tags).toEqual(["migration", "async"])
    })

    it("handles results with empty tags array", () => {
      const results: RuleResult[] = [
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Test",
          file: "file1.ts",
          tags: []
        }
      ]

      const normalized = normalizeResults(results)

      // Empty tags array should be omitted
      expect(normalized.rules[0].tags).toBeUndefined()
    })
  })

  describe("groups field (optional cache)", () => {
    it("groups should be present in normalized output", () => {
      const results: RuleResult[] = [
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Msg1",
          file: "file1.ts"
        },
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Msg1",
          file: "file2.ts"
        }
      ]

      const normalized = normalizeResults(results)

      // Groups should be present (current implementation always emits it)
      expect(normalized.groups).toBeDefined()
      expect(normalized.groups?.byFile).toBeDefined()
      expect(normalized.groups?.byRule).toBeDefined()

      // Verify structure
      expect(normalized.groups?.byFile["0"]).toEqual([0])
      expect(normalized.groups?.byFile["1"]).toEqual([1])
      expect(normalized.groups?.byRule["0"]).toEqual([0, 1])
    })
  })

  describe("deriveResultKey", () => {
    it("generates correct key format with all components", () => {
      const rules = [
        {
          id: "no-async-await",
          kind: "pattern",
          severity: "error" as const,
          message: "Use Effect.gen instead of async/await"
        }
      ]
      const files = ["src/index.ts"]
      const result = {
        rule: 0,
        file: 0,
        range: [10, 5, 10, 20] as [number, number, number, number]
      }

      const key = deriveResultKey(result, rules, files)

      expect(key).toBe(
        "no-async-await|src/index.ts|10:5-10:20|Use Effect.gen instead of async/await"
      )
    })

    it("handles result without file (empty filePath)", () => {
      const rules = [
        {
          id: "global-docs-rule",
          kind: "docs",
          severity: "warning" as const,
          message: "Missing documentation"
        }
      ]
      const files: string[] = []
      const result = {
        rule: 0,
        range: [5, 0, 5, 10] as [number, number, number, number]
      }

      const key = deriveResultKey(result, rules, files)

      expect(key).toBe("global-docs-rule||5:0-5:10|Missing documentation")
    })

    it("handles result without range (empty rangeStr)", () => {
      const rules = [
        {
          id: "file-level-rule",
          kind: "boundary",
          severity: "error" as const,
          message: "Disallowed import"
        }
      ]
      const files = ["src/utils.ts"]
      const result = {
        rule: 0,
        file: 0
      }

      const key = deriveResultKey(result, rules, files)

      expect(key).toBe("file-level-rule|src/utils.ts||Disallowed import")
    })

    it("handles result with message override", () => {
      const rules = [
        {
          id: "rule1",
          kind: "pattern",
          severity: "warning" as const,
          message: "Template message"
        }
      ]
      const files = ["src/index.ts"]
      const result = {
        rule: 0,
        file: 0,
        range: [10, 5, 10, 20] as [number, number, number, number],
        message: "Custom override message"
      }

      const key = deriveResultKey(result, rules, files)

      expect(key).toBe("rule1|src/index.ts|10:5-10:20|Custom override message")
    })

    it("handles result with no file and no range (minimal result)", () => {
      const rules = [
        {
          id: "minimal-rule",
          kind: "metrics",
          severity: "info" as const,
          message: "Metric collected"
        }
      ]
      const files: string[] = []
      const result = {
        rule: 0
      }

      const key = deriveResultKey(result, rules, files)

      expect(key).toBe("minimal-rule|||Metric collected")
    })

    it("generates deterministic keys for identical results", () => {
      const rules = [
        {
          id: "rule-a",
          kind: "pattern",
          severity: "error" as const,
          message: "Error message"
        }
      ]
      const files = ["file.ts"]
      const result = {
        rule: 0,
        file: 0,
        range: [15, 3, 15, 10] as [number, number, number, number]
      }

      const key1 = deriveResultKey(result, rules, files)
      const key2 = deriveResultKey(result, rules, files)
      const key3 = deriveResultKey(result, rules, files)

      expect(key1).toBe(key2)
      expect(key2).toBe(key3)
    })

    it("generates different keys for results with different ruleIds", () => {
      const rules = [
        {
          id: "rule-a",
          kind: "pattern",
          severity: "error" as const,
          message: "Message"
        },
        {
          id: "rule-b",
          kind: "pattern",
          severity: "error" as const,
          message: "Message"
        }
      ]
      const files = ["file.ts"]
      const result1 = {
        rule: 0,
        file: 0,
        range: [10, 5, 10, 20] as [number, number, number, number]
      }
      const result2 = {
        rule: 1,
        file: 0,
        range: [10, 5, 10, 20] as [number, number, number, number]
      }

      const key1 = deriveResultKey(result1, rules, files)
      const key2 = deriveResultKey(result2, rules, files)

      expect(key1).not.toBe(key2)
      expect(key1).toContain("rule-a|")
      expect(key2).toContain("rule-b|")
    })

    it("generates different keys for results at different locations", () => {
      const rules = [
        {
          id: "same-rule",
          kind: "pattern",
          severity: "error" as const,
          message: "Same message"
        }
      ]
      const files = ["file.ts"]
      const result1 = {
        rule: 0,
        file: 0,
        range: [10, 5, 10, 20] as [number, number, number, number]
      }
      const result2 = {
        rule: 0,
        file: 0,
        range: [15, 8, 15, 25] as [number, number, number, number]
      }

      const key1 = deriveResultKey(result1, rules, files)
      const key2 = deriveResultKey(result2, rules, files)

      expect(key1).not.toBe(key2)
      expect(key1).toContain("|10:5-10:20|")
      expect(key2).toContain("|15:8-15:25|")
    })

    it("keys remain stable when rule/file indices change", () => {
      // Scenario 1: Rule at index 0, file at index 0
      const rules1 = [
        {
          id: "my-rule",
          kind: "pattern",
          severity: "error" as const,
          message: "Error"
        }
      ]
      const files1 = ["my-file.ts"]
      const result1 = {
        rule: 0,
        file: 0,
        range: [10, 5, 10, 20] as [number, number, number, number]
      }

      // Scenario 2: Same rule at index 2, same file at index 3 (other rules/files added)
      const rules2 = [
        { id: "other-rule-1", kind: "pattern", severity: "error" as const, message: "Other" },
        { id: "other-rule-2", kind: "pattern", severity: "error" as const, message: "Other" },
        {
          id: "my-rule",
          kind: "pattern",
          severity: "error" as const,
          message: "Error"
        }
      ]
      const files2 = ["other-file-1.ts", "other-file-2.ts", "other-file-3.ts", "my-file.ts"]
      const result2 = {
        rule: 2,
        file: 3,
        range: [10, 5, 10, 20] as [number, number, number, number]
      }

      const key1 = deriveResultKey(result1, rules1, files1)
      const key2 = deriveResultKey(result2, rules2, files2)

      // Keys should be identical despite different indices
      expect(key1).toBe(key2)
      expect(key1).toBe("my-rule|my-file.ts|10:5-10:20|Error")
    })
  })

  describe("deriveResultKeys", () => {
    it("returns Map<number, string> with correct indices", () => {
      const findings = {
        rules: [
          {
            id: "rule1",
            kind: "pattern",
            severity: "error" as const,
            message: "Msg1"
          },
          {
            id: "rule2",
            kind: "pattern",
            severity: "warning" as const,
            message: "Msg2"
          }
        ],
        files: ["file1.ts", "file2.ts"],
        results: [
          { rule: 0, file: 0, range: [10, 5, 10, 20] as [number, number, number, number] },
          { rule: 1, file: 1, range: [15, 3, 15, 18] as [number, number, number, number] },
          { rule: 0, file: 1 }
        ],
        groups: { byFile: {}, byRule: {} },
        summary: { errors: 2, warnings: 1, totalFiles: 2, totalFindings: 3 }
      }

      const keyMap = deriveResultKeys(findings)

      expect(keyMap).toBeInstanceOf(Map)
      expect(keyMap.size).toBe(3)
      expect(keyMap.get(0)).toBe("rule1|file1.ts|10:5-10:20|Msg1")
      expect(keyMap.get(1)).toBe("rule2|file2.ts|15:3-15:18|Msg2")
      expect(keyMap.get(2)).toBe("rule1|file2.ts||Msg1")
    })

    it("returns empty Map for empty results", () => {
      const findings = {
        rules: [],
        files: [],
        results: [],
        groups: { byFile: {}, byRule: {} },
        summary: { errors: 0, warnings: 0, totalFiles: 0, totalFindings: 0 }
      }

      const keyMap = deriveResultKeys(findings)

      expect(keyMap).toBeInstanceOf(Map)
      expect(keyMap.size).toBe(0)
    })

    it("all keys are unique within a checkpoint", () => {
      const findings = {
        rules: [
          {
            id: "rule1",
            kind: "pattern",
            severity: "error" as const,
            message: "Error"
          }
        ],
        files: ["file1.ts", "file2.ts"],
        results: [
          { rule: 0, file: 0, range: [10, 5, 10, 20] as [number, number, number, number] },
          { rule: 0, file: 1, range: [10, 5, 10, 20] as [number, number, number, number] },
          { rule: 0, file: 0, range: [15, 3, 15, 18] as [number, number, number, number] }
        ],
        groups: { byFile: {}, byRule: {} },
        summary: { errors: 3, warnings: 0, totalFiles: 2, totalFindings: 3 }
      }

      const keyMap = deriveResultKeys(findings)

      const keys = Array.from(keyMap.values())
      const uniqueKeys = new Set(keys)

      expect(uniqueKeys.size).toBe(keys.length)
    })

    it("keys are stable for cross-checkpoint delta computation", () => {
      const results1: RuleResult[] = [
        {
          id: "rule-a",
          ruleKind: "pattern",
          severity: "error",
          message: "Error A",
          file: "file1.ts",
          range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } }
        },
        {
          id: "rule-b",
          ruleKind: "pattern",
          severity: "warning",
          message: "Warning B",
          file: "file2.ts",
          range: { start: { line: 15, column: 3 }, end: { line: 15, column: 18 } }
        }
      ]

      // Checkpoint 2: Same results but with additional rule/file (indices shift)
      const results2: RuleResult[] = [
        {
          id: "new-rule",
          ruleKind: "pattern",
          severity: "error",
          message: "New error",
          file: "new-file.ts",
          range: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } }
        },
        {
          id: "rule-a",
          ruleKind: "pattern",
          severity: "error",
          message: "Error A",
          file: "file1.ts",
          range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } }
        },
        {
          id: "rule-b",
          ruleKind: "pattern",
          severity: "warning",
          message: "Warning B",
          file: "file2.ts",
          range: { start: { line: 15, column: 3 }, end: { line: 15, column: 18 } }
        }
      ]

      const checkpoint1 = normalizeResults(results1)
      const checkpoint2 = normalizeResults(results2)

      const keys1 = deriveResultKeys(checkpoint1)
      const keys2 = deriveResultKeys(checkpoint2)

      // Find keys for the same logical results
      const keys1Values = Array.from(keys1.values())
      const keys2Values = Array.from(keys2.values())

      // Keys for rule-a result should be identical across checkpoints
      const ruleAKey1 = keys1Values.find(k => k.includes("rule-a"))
      const ruleAKey2 = keys2Values.find(k => k.includes("rule-a"))
      expect(ruleAKey1).toBe(ruleAKey2)

      // Keys for rule-b result should be identical across checkpoints
      const ruleBKey1 = keys1Values.find(k => k.includes("rule-b"))
      const ruleBKey2 = keys2Values.find(k => k.includes("rule-b"))
      expect(ruleBKey1).toBe(ruleBKey2)
    })

    it("enables efficient delta computation via Set operations", () => {
      const checkpoint1Results: RuleResult[] = [
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Error",
          file: "file1.ts",
          range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } }
        },
        {
          id: "rule2",
          ruleKind: "pattern",
          severity: "warning",
          message: "Warning",
          file: "file2.ts",
          range: { start: { line: 15, column: 3 }, end: { line: 15, column: 18 } }
        }
      ]

      const checkpoint2Results: RuleResult[] = [
        {
          id: "rule1",
          ruleKind: "pattern",
          severity: "error",
          message: "Error",
          file: "file1.ts",
          range: { start: { line: 10, column: 5 }, end: { line: 10, column: 20 } }
        },
        {
          id: "rule3",
          ruleKind: "pattern",
          severity: "error",
          message: "New error",
          file: "file3.ts",
          range: { start: { line: 20, column: 1 }, end: { line: 20, column: 10 } }
        }
      ]

      const checkpoint1 = normalizeResults(checkpoint1Results)
      const checkpoint2 = normalizeResults(checkpoint2Results)

      const keys1 = deriveResultKeys(checkpoint1)
      const keys2 = deriveResultKeys(checkpoint2)

      const keys1Set = new Set(keys1.values())
      const keys2Set = new Set(keys2.values())

      // Compute delta
      const added = [...keys2Set].filter(k => !keys1Set.has(k))
      const removed = [...keys1Set].filter(k => !keys2Set.has(k))
      const unchanged = [...keys1Set].filter(k => keys2Set.has(k))

      expect(added).toHaveLength(1)
      expect(removed).toHaveLength(1)
      expect(unchanged).toHaveLength(1)

      expect(added[0]).toContain("rule3|file3.ts|20:1-20:10|New error")
      expect(removed[0]).toContain("rule2|file2.ts|15:3-15:18|Warning")
      expect(unchanged[0]).toContain("rule1|file1.ts|10:5-10:20|Error")
    })

    it("handles FindingsGroup with message overrides", () => {
      const findings = {
        rules: [
          {
            id: "rule1",
            kind: "pattern",
            severity: "error" as const,
            message: "Template message"
          }
        ],
        files: ["file1.ts"],
        results: [
          { rule: 0, file: 0, range: [10, 5, 10, 20] as [number, number, number, number] },
          {
            rule: 0,
            file: 0,
            range: [15, 3, 15, 18] as [number, number, number, number],
            message: "Custom override"
          }
        ],
        groups: { byFile: {}, byRule: {} },
        summary: { errors: 2, warnings: 0, totalFiles: 1, totalFindings: 2 }
      }

      const keyMap = deriveResultKeys(findings)

      expect(keyMap.get(0)).toContain("|Template message")
      expect(keyMap.get(1)).toContain("|Custom override")
    })
  })

  describe("rebuildGroups", () => {
    it("rebuilds groups from results with files", () => {
      const findings = {
        rules: [
          { id: "rule1", kind: "pattern" as const, severity: "error" as const, message: "M1" },
          { id: "rule2", kind: "pattern" as const, severity: "warning" as const, message: "M2" }
        ],
        files: ["file1.ts", "file2.ts"],
        results: [
          { rule: 0, file: 0, range: [1, 1, 1, 10] as [number, number, number, number] },
          { rule: 1, file: 0, range: [2, 1, 2, 10] as [number, number, number, number] },
          { rule: 0, file: 1, range: [3, 1, 3, 10] as [number, number, number, number] }
        ],
        summary: { errors: 2, warnings: 1, totalFiles: 2, totalFindings: 3 }
      }

      const groups = rebuildGroups(findings)

      expect(groups.byFile["0"]).toEqual([0, 1])
      expect(groups.byFile["1"]).toEqual([2])
      expect(groups.byRule["0"]).toEqual([0, 2])
      expect(groups.byRule["1"]).toEqual([1])
    })

    it("rebuilds groups with file-less results", () => {
      const findings = {
        rules: [
          { id: "global-rule", kind: "docs" as const, severity: "info" as const, message: "M" }
        ],
        files: [],
        results: [
          { rule: 0 },
          { rule: 0 },
          { rule: 0 }
        ],
        summary: { errors: 0, warnings: 0, totalFiles: 0, totalFindings: 3 }
      }

      const groups = rebuildGroups(findings)

      expect(Object.keys(groups.byFile)).toHaveLength(0)
      expect(groups.byRule["0"]).toEqual([0, 1, 2])
    })

    it("rebuilds groups with mixed file-less and file results", () => {
      const findings = {
        rules: [
          { id: "rule1", kind: "pattern" as const, severity: "error" as const, message: "M1" },
          { id: "rule2", kind: "docs" as const, severity: "info" as const, message: "M2" }
        ],
        files: ["file1.ts"],
        results: [
          { rule: 0, file: 0, range: [1, 1, 1, 10] as [number, number, number, number] },
          { rule: 1 },
          { rule: 0, file: 0, range: [2, 1, 2, 10] as [number, number, number, number] }
        ],
        summary: { errors: 2, warnings: 0, totalFiles: 1, totalFindings: 3 }
      }

      const groups = rebuildGroups(findings)

      expect(groups.byFile["0"]).toEqual([0, 2])
      expect(groups.byRule["0"]).toEqual([0, 2])
      expect(groups.byRule["1"]).toEqual([1])
    })

    it("produces same groups as normalizeResults", () => {
      const results: RuleResult[] = [
        { id: "rule-a", ruleKind: "pattern", severity: "error", message: "A", file: "file1.ts" },
        { id: "rule-b", ruleKind: "pattern", severity: "warning", message: "B", file: "file2.ts" },
        { id: "rule-a", ruleKind: "pattern", severity: "error", message: "A", file: "file2.ts" }
      ]

      const normalized = normalizeResults(results)
      const rebuilt = rebuildGroups(normalized)

      expect(rebuilt).toEqual(normalized.groups)
    })
  })
})
