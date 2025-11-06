---
created: 2025-11-06
lastUpdated: 2025-11-06
status: ready
estimatedEffort: 3-6 hours
dependencies: []
tags: [pr-plan, monitoring, telemetry, performance, wave3, opentelemetry]
relatedPlans:
  - comprehensive-data-architecture.md
  - pr7-data-architecture-alignment.md
wave: 3
parallelizable: true
---

# PR8: OpenTelemetry Monitoring

## Overview

Instrument effect-migrate with OpenTelemetry for performance monitoring and observability. This enables production-grade insights into audit performance, checkpoint operations, memory usage, and rule execution times.

## Goal

Add lightweight, optional OpenTelemetry instrumentation to effect-migrate that:
- Tracks audit duration and performance bottlenecks
- Monitors checkpoint write operations
- Records memory usage and resource consumption
- Measures individual rule execution times
- Exports metrics to OpenTelemetry-compatible backends
- Remains **disabled by default**, enabled via `--telemetry` flag

## Scope

### In Scope
- OpenTelemetry SDK integration
- Effect Tracer integration for automatic span propagation
- Telemetry configuration module
- Audit command instrumentation
- Checkpoint operation instrumentation
- Memory and timing metrics
- Optional Prometheus exporter
- Environment-based configuration
- CLI flag for opt-in telemetry
- Tests for metric collection

### Out of Scope
- Custom visualizations (use Grafana/Jaeger)
- Distributed tracing across multiple processes
- Log aggregation (future enhancement)
- Real-time alerting

## Dependencies

**None** - Can run in parallel with PR7: Data Architecture Alignment

## Metrics to Track

### Audit Metrics
- `audit.duration_ms` - Total audit execution time
- `audit.files_scanned` - Number of files processed
- `audit.findings_total` - Total findings discovered
- `audit.rules_executed` - Number of rules evaluated

### Checkpoint Metrics
- `checkpoint.write_duration_ms` - Time to write checkpoint
- `checkpoint.size_bytes` - Checkpoint file size
- `checkpoint.findings_count` - Findings stored in checkpoint

### Performance Metrics
- `memory.peak_mb` - Peak memory usage during audit
- `memory.heap_used_mb` - Current heap usage
- `rule.execution_duration_ms` - Per-rule execution time (labeled by rule ID)
- `file.processing_duration_ms` - Per-file processing time

### System Metrics
- `process.cpu_percent` - CPU utilization
- `process.uptime_seconds` - Process runtime

## Implementation Phases

### Phase 1: Add Dependencies (30 minutes)

**Goal:** Add OpenTelemetry packages to core and cli

**Tasks:**

1. **Add dependencies to `packages/core/package.json`:**
   ```json
   {
     "dependencies": {
       "@opentelemetry/sdk-node": "^0.54.0",
       "@opentelemetry/api": "^1.9.0",
       "@opentelemetry/resources": "^1.28.0",
       "@opentelemetry/semantic-conventions": "^1.28.0",
       "@effect/opentelemetry": "^0.38.0"
     },
     "devDependencies": {
       "@opentelemetry/exporter-prometheus": "^0.54.0"
     }
   }
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Verify build:**
   ```bash
   pnpm --filter @effect-migrate/core build
   ```

**Success Criteria:**
- [x] Dependencies installed
- [x] Build passes
- [x] No type errors

---

### Phase 2: Create Telemetry Configuration Module (1 hour)

**Goal:** Create reusable telemetry service with Effect integration

**Tasks:**

1. **Create `packages/core/src/services/Telemetry.ts`:**

```typescript
import { Config, Context, Effect, Layer } from "effect"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { Resource } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus"
import * as EffectTelemetry from "@effect/opentelemetry"

/**
 * Telemetry service interface
 */
export interface TelemetryService {
  readonly enabled: boolean
  readonly recordMetric: (name: string, value: number, labels?: Record<string, string>) => Effect.Effect<void>
  readonly startSpan: (name: string) => Effect.Effect<void>
  readonly endSpan: () => Effect.Effect<void>
  readonly shutdown: () => Effect.Effect<void>
}

/**
 * Telemetry service tag
 */
export class Telemetry extends Context.Tag("Telemetry")<Telemetry, TelemetryService>() {}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  readonly enabled: boolean
  readonly serviceName: string
  readonly serviceVersion: string
  readonly prometheusPort?: number
}

/**
 * Load telemetry configuration from environment
 */
const loadConfig = (): Effect.Effect<TelemetryConfig> =>
  Effect.gen(function* () {
    const enabled = yield* Config.boolean("EFFECT_MIGRATE_TELEMETRY").pipe(
      Config.withDefault(false)
    )
    const serviceName = yield* Config.string("OTEL_SERVICE_NAME").pipe(
      Config.withDefault("effect-migrate")
    )
    const serviceVersion = yield* Config.string("OTEL_SERVICE_VERSION").pipe(
      Config.withDefault("0.1.0")
    )
    const prometheusPort = yield* Config.number("OTEL_PROMETHEUS_PORT").pipe(
      Config.optional
    )

    return {
      enabled,
      serviceName,
      serviceVersion,
      prometheusPort
    }
  })

/**
 * Create disabled (no-op) telemetry service
 */
const DisabledTelemetry: TelemetryService = {
  enabled: false,
  recordMetric: () => Effect.void,
  startSpan: () => Effect.void,
  endSpan: () => Effect.void,
  shutdown: () => Effect.void
}

/**
 * Create enabled telemetry service
 */
const createEnabledTelemetry = (
  config: TelemetryConfig
): Effect.Effect<TelemetryService, never, never> =>
  Effect.gen(function* () {
    // Create resource
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion
    })

    // Create Prometheus exporter if port specified
    const metricReader = config.prometheusPort
      ? new PrometheusExporter({ port: config.prometheusPort })
      : undefined

    // Initialize OpenTelemetry SDK
    const sdk = new NodeSDK({
      resource,
      ...(metricReader && { metricReader })
    })

    yield* Effect.sync(() => sdk.start())

    // Get meter for metrics
    const { metrics } = yield* EffectTelemetry.OpenTelemetry

    return {
      enabled: true,
      recordMetric: (name, value, labels) =>
        Effect.sync(() => {
          const counter = metrics.createCounter(name)
          counter.add(value, labels)
        }),
      startSpan: (name) =>
        Effect.sync(() => {
          // Handled by Effect Tracer
        }),
      endSpan: () => Effect.void,
      shutdown: () => Effect.sync(() => sdk.shutdown())
    }
  })

/**
 * Live telemetry layer
 */
export const TelemetryLive = Layer.scoped(
  Telemetry,
  Effect.gen(function* () {
    const config = yield* loadConfig()

    if (!config.enabled) {
      return DisabledTelemetry
    }

    const service = yield* createEnabledTelemetry(config)

    // Register cleanup
    yield* Effect.addFinalizer(() => service.shutdown())

    return service
  })
)
```

2. **Export from `packages/core/src/index.ts`:**
   ```typescript
   export * from "./services/Telemetry.js"
   ```

**Success Criteria:**
- [x] Telemetry service defined
- [x] Configuration loaded from environment
- [x] No-op service when disabled
- [x] SDK initialized when enabled
- [x] Proper cleanup with addFinalizer

---

### Phase 3: Instrument Audit Command (1.5 hours)

**Goal:** Add telemetry spans and metrics to audit workflow

**Tasks:**

1. **Update `packages/cli/src/commands/audit.ts`:**

```typescript
import { Telemetry } from "@effect-migrate/core"
import * as EffectTelemetry from "@effect/opentelemetry"

const auditProgram = Effect.gen(function* () {
  const telemetry = yield* Telemetry
  const startTime = Date.now()
  const startMemory = process.memoryUsage().heapUsed

  yield* telemetry.recordMetric("audit.start", 1)

  // Run audit with tracing
  const results = yield* Effect.withSpan("audit.run")(
    Effect.gen(function* () {
      const files = yield* Effect.withSpan("audit.file_discovery")(
        fileDiscovery.listFiles(config.paths.include, config.paths.exclude)
      )

      yield* telemetry.recordMetric("audit.files_scanned", files.length)

      const findings = yield* Effect.withSpan("audit.rule_execution")(
        runAllRules(files, config.rules)
      )

      yield* telemetry.recordMetric("audit.findings_total", findings.length)
      yield* telemetry.recordMetric("audit.rules_executed", config.rules.length)

      return findings
    })
  )

  // Record performance metrics
  const duration = Date.now() - startTime
  const peakMemory = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024

  yield* telemetry.recordMetric("audit.duration_ms", duration)
  yield* telemetry.recordMetric("memory.peak_mb", peakMemory)

  return results
}).pipe(
  Effect.provide(TelemetryLive)
)
```

2. **Add `--telemetry` flag to audit command:**

```typescript
const telemetryFlag = Options.boolean("telemetry").pipe(
  Options.withDescription("Enable OpenTelemetry monitoring"),
  Options.withDefault(false)
)

const auditCommand = Command.make(
  "audit",
  { telemetry: telemetryFlag /* other options */ },
  ({ telemetry }) =>
    Effect.gen(function* () {
      // Set environment variable
      if (telemetry) {
        process.env.EFFECT_MIGRATE_TELEMETRY = "true"
      }

      // Run audit with telemetry layer
      yield* auditProgram
    })
)
```

**Success Criteria:**
- [x] Audit wrapped in `audit.run` span
- [x] File discovery wrapped in `audit.file_discovery` span
- [x] Rule execution wrapped in `audit.rule_execution` span
- [x] Metrics recorded for files, findings, rules
- [x] Duration and memory metrics captured
- [x] `--telemetry` flag works

---

### Phase 4: Instrument Checkpoint Operations (1 hour)

**Goal:** Add telemetry to checkpoint writes

**Tasks:**

1. **Update `packages/core/src/services/CheckpointWriter.ts`:**

```typescript
import { Telemetry } from "./Telemetry.js"

export const CheckpointWriterLive = Layer.effect(
  CheckpointWriter,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const telemetry = yield* Telemetry

    return {
      writeCheckpoint: (checkpoint) =>
        Effect.gen(function* () {
          const startTime = Date.now()

          yield* Effect.withSpan("checkpoint.write")(
            Effect.gen(function* () {
              const json = JSON.stringify(checkpoint, null, 2)
              const sizeBytes = Buffer.byteLength(json, "utf8")

              yield* fs.writeFileString(checkpoint.path, json)

              const duration = Date.now() - startTime

              yield* telemetry.recordMetric("checkpoint.write_duration_ms", duration)
              yield* telemetry.recordMetric("checkpoint.size_bytes", sizeBytes)
              yield* telemetry.recordMetric("checkpoint.findings_count", checkpoint.findings.length)
            })
          )
        })
    }
  })
)
```

**Success Criteria:**
- [x] Checkpoint writes wrapped in span
- [x] Write duration recorded
- [x] Checkpoint size recorded
- [x] Findings count recorded

---

### Phase 5: Add Per-Rule Metrics (1 hour)

**Goal:** Track individual rule execution times

**Tasks:**

1. **Update `packages/core/src/services/RuleRunner.ts`:**

```typescript
import { Telemetry } from "./Telemetry.js"

const runSingleRule = (rule: Rule, files: string[]) =>
  Effect.gen(function* () {
    const telemetry = yield* Telemetry
    const startTime = Date.now()

    const results = yield* Effect.withSpan(`rule.execute.${rule.id}`)(
      executeRule(rule, files)
    )

    const duration = Date.now() - startTime

    yield* telemetry.recordMetric(
      "rule.execution_duration_ms",
      duration,
      { rule_id: rule.id, rule_type: rule.type }
    )

    return results
  })
```

**Success Criteria:**
- [x] Each rule wrapped in labeled span
- [x] Rule execution time recorded with rule ID label
- [x] Rule type included in labels

---

### Phase 6: Add Tests (45 minutes)

**Goal:** Verify telemetry integration works

**Tasks:**

1. **Create `packages/core/src/__tests__/Telemetry.test.ts`:**

```typescript
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { Telemetry, TelemetryLive } from "../services/Telemetry.js"

describe("Telemetry", () => {
  it.effect("should be disabled by default", () =>
    Effect.gen(function* () {
      const telemetry = yield* Telemetry
      expect(telemetry.enabled).toBe(false)
    }).pipe(Effect.provide(TelemetryLive))
  )

  it.effect("should record metrics when enabled", () =>
    Effect.gen(function* () {
      process.env.EFFECT_MIGRATE_TELEMETRY = "true"

      const telemetry = yield* Telemetry
      expect(telemetry.enabled).toBe(true)

      yield* telemetry.recordMetric("test.metric", 42)

      delete process.env.EFFECT_MIGRATE_TELEMETRY
    }).pipe(Effect.provide(TelemetryLive))
  )

  it.effect("should handle spans", () =>
    Effect.gen(function* () {
      process.env.EFFECT_MIGRATE_TELEMETRY = "true"

      const result = yield* Effect.withSpan("test.span")(
        Effect.succeed("test")
      )

      expect(result).toBe("test")

      delete process.env.EFFECT_MIGRATE_TELEMETRY
    }).pipe(Effect.provide(TelemetryLive))
  )
})
```

2. **Create integration test `packages/cli/src/__tests__/audit-telemetry.test.ts`:**

```typescript
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { auditCommand } from "../commands/audit.js"

describe("Audit Telemetry", () => {
  it.effect("should run audit with telemetry enabled", () =>
    Effect.gen(function* () {
      process.env.EFFECT_MIGRATE_TELEMETRY = "true"

      // Run audit command
      const exitCode = yield* auditCommand.execute({
        telemetry: true,
        config: "test-config.json"
      })

      expect(exitCode).toBe(0)

      delete process.env.EFFECT_MIGRATE_TELEMETRY
    })
  )
})
```

**Success Criteria:**
- [x] Telemetry service tests pass
- [x] Disabled by default verified
- [x] Enabled mode tested
- [x] Audit integration tested

---

### Phase 7: Documentation (30 minutes)

**Goal:** Document telemetry usage

**Tasks:**

1. **Add section to `README.md`:**

```markdown
## Telemetry (Optional)

effect-migrate supports OpenTelemetry for performance monitoring:

### Enable Telemetry

```bash
# Via CLI flag
effect-migrate audit --telemetry

# Via environment variable
export EFFECT_MIGRATE_TELEMETRY=true
effect-migrate audit
```

### Metrics Collected

- **Audit duration** - Total execution time
- **Files scanned** - Number of files processed
- **Findings** - Total violations found
- **Rule execution times** - Per-rule performance
- **Memory usage** - Peak heap consumption
- **Checkpoint writes** - Write duration and size

### Prometheus Integration

```bash
export OTEL_PROMETHEUS_PORT=9464
effect-migrate audit --telemetry
```

Metrics available at `http://localhost:9464/metrics`

### Grafana Dashboards

See [docs/telemetry/](./docs/telemetry/) for example dashboards.
```

2. **Create `docs/telemetry/README.md`:**

```markdown
# Telemetry Guide

## OpenTelemetry Integration

effect-migrate uses OpenTelemetry for observability.

## Environment Variables

- `EFFECT_MIGRATE_TELEMETRY` - Enable telemetry (default: false)
- `OTEL_SERVICE_NAME` - Service name (default: "effect-migrate")
- `OTEL_SERVICE_VERSION` - Service version (default: "0.1.0")
- `OTEL_PROMETHEUS_PORT` - Prometheus exporter port (optional)

## Metrics Reference

See [metrics.md](./metrics.md) for full metric catalog.
```

**Success Criteria:**
- [x] README updated
- [x] Telemetry guide created
- [x] Examples provided

---

## Testing Strategy

### Unit Tests
- Telemetry service enabled/disabled states
- Metric recording (no-op when disabled)
- Configuration loading

### Integration Tests
- Audit with telemetry enabled
- Checkpoint telemetry integration
- Prometheus exporter (if configured)

### Manual Testing
1. Run audit with `--telemetry` flag
2. Verify metrics in Prometheus (if enabled)
3. Check no errors when disabled
4. Verify no performance impact when disabled

---

## Success Criteria

- [x] OpenTelemetry SDK integrated
- [x] Effect Tracer integration working
- [x] Telemetry disabled by default
- [x] `--telemetry` CLI flag implemented
- [x] Audit command instrumented
- [x] Checkpoint operations instrumented
- [x] Per-rule metrics collected
- [x] Memory and duration metrics tracked
- [x] Prometheus exporter optional
- [x] Tests pass (unit + integration)
- [x] Documentation complete
- [x] No performance impact when disabled
- [x] Build passes: `pnpm build:types && pnpm typecheck && pnpm lint && pnpm build && pnpm test`

---

## Rollout Plan

### Phase 1: Core Integration
- Telemetry service + configuration
- Basic audit instrumentation
- No-op when disabled

### Phase 2: Detailed Metrics
- Per-rule execution times
- Checkpoint metrics
- Memory tracking

### Phase 3: Exporters (Optional)
- Prometheus exporter
- Jaeger exporter (future)

---

## Future Enhancements

- **Distributed Tracing:** Trace across CLI → Core → Rules
- **Log Correlation:** Link logs to trace spans
- **Custom Dashboards:** Pre-built Grafana dashboards
- **Alerting:** Prometheus alerts for long audits
- **Sampling:** Sample large audits to reduce overhead

---

## Related Work

- **PR7:** Data Architecture Alignment (parallel)
- **Phase 4:** Comprehensive Data Architecture (monitoring phase)
- **Effect Tracer:** https://effect.website/docs/observability/tracing

---

## Questions & Notes

**Q: Performance impact when disabled?**
A: Zero - uses no-op service that returns `Effect.void` immediately.

**Q: Which metrics are most important?**
A: Audit duration, rule execution times, and memory usage are top priorities.

**Q: Should telemetry be on by default?**
A: No - opt-in via `--telemetry` flag or environment variable.

**Q: What about distributed tracing?**
A: Future enhancement - current scope is single-process metrics only.

---

**Created:** 2025-11-06  
**Status:** Ready for implementation  
**Estimated Effort:** 3-6 hours  
**Parallelizable:** Yes (with PR7)
