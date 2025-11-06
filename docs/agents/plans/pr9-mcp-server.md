---
created: 2025-11-06
lastUpdated: 2025-11-06
status: ready
type: pr-plan
prNumber: 9
wave: 3
estimatedHours: 6-10
dependencies: [pr6, pr7]
tags: [pr-plan, mcp, amp-integration, agents, wave3]
---

# PR9: MCP Server for Amp Integration

## Overview

Create a Model Context Protocol (MCP) server that exposes effect-migrate's SQLite database and analytics capabilities to AI coding agents like Amp. This enables agents to query checkpoints, analyze trends, and understand project migration status through standardized MCP tools and resources.

**Goal:** Build read-only MCP server for agent queries

**Estimated Effort:** 6-10 hours

**Dependencies:**
- PR6 (SQLite storage) - MCP exposes checkpoint data
- PR7 (Analytics engine) - MCP exposes trend analysis

**Related Documents:**
- [../concepts/comprehensive-data-architecture.md](../concepts/comprehensive-data-architecture.md) - Phase 5
- [../concepts/amp-integration.md](../concepts/amp-integration.md) - MCP integration patterns
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK

---

## Implementation Phases

### Phase 1: Create @effect-migrate/mcp-server Package (1.5 hours)

**Objective:** Set up new package with MCP SDK dependencies

**Tasks:**

1. **Create package structure**
   ```
   packages/mcp-server/
   ├── src/
   │   ├── index.ts              # Server entry point
   │   ├── server.ts             # MCP server implementation
   │   ├── tools/                # MCP tool handlers
   │   ├── resources/            # MCP resource handlers
   │   ├── prompts/              # MCP prompt handlers (future)
   │   └── types.ts              # MCP-specific types
   ├── package.json
   ├── tsconfig.json
   └── README.md
   ```

2. **Add dependencies**
   ```json
   {
     "name": "@effect-migrate/mcp-server",
     "version": "0.1.0",
     "type": "module",
     "dependencies": {
       "@modelcontextprotocol/sdk": "^1.0.0",
       "@effect-migrate/core": "workspace:*",
       "@effect-migrate/sqlite": "workspace:*",
       "@effect-migrate/analytics": "workspace:*",
       "effect": "^3.18.4",
       "@effect/platform": "^0.92.1",
       "@effect/platform-node": "^0.98.4"
     }
   }
   ```

3. **Configure build**
   - Extend `tsconfig.build.json`
   - Add bin entry for `effect-migrate-mcp` executable
   - Configure dual ESM output

4. **Add to workspace**
   - Update root `pnpm-workspace.yaml`
   - Add to root `package.json` scripts

**Success Criteria:**
- [x] Package builds without errors
- [x] Dependencies resolve correctly
- [x] Workspace references work

---

### Phase 2: Define MCP Endpoints (2 hours)

**Objective:** Implement MCP tools, resources, and prompts schema

#### MCP Tools

Tools are functions agents can call with arguments.

**Tool Definitions:**

1. **`checkpoint_latest`**
   - **Description:** Get the most recent checkpoint
   - **Input Schema:**
     ```typescript
     {
       format?: "summary" | "full" // Default: "summary"
     }
     ```
   - **Output:** Latest checkpoint with metadata
   - **Error Handling:** Return empty if no checkpoints

2. **`checkpoint_list`**
   - **Description:** List checkpoints with optional filters
   - **Input Schema:**
     ```typescript
     {
       limit?: number,        // Default: 10, max: 100
       offset?: number,       // Default: 0
       orderBy?: "timestamp" | "violations",
       order?: "asc" | "desc" // Default: "desc"
     }
     ```
   - **Output:** Array of checkpoint summaries with pagination

3. **`checkpoint_diff`**
   - **Description:** Compare two checkpoints
   - **Input Schema:**
     ```typescript
     {
       from: string,  // Checkpoint ID or "previous"
       to: string     // Checkpoint ID or "latest"
     }
     ```
   - **Output:** Delta report (violations added/removed/fixed)

4. **`analytics_trends`**
   - **Description:** Get time-series trends
   - **Input Schema:**
     ```typescript
     {
       metric: "violations" | "files" | "rules",
       period?: "day" | "week" | "month",  // Default: "week"
       limit?: number                       // Default: 30
     }
     ```
   - **Output:** Array of time-series data points

5. **`analytics_hotspots`**
   - **Description:** Get files or rules with most issues
   - **Input Schema:**
     ```typescript
     {
       type: "file" | "rule",
       limit?: number,           // Default: 10
       threshold?: number        // Minimum violations to include
     }
     ```
   - **Output:** Ranked list with violation counts

#### MCP Resources

Resources are URIs agents can read.

**Resource Definitions:**

1. **`effect-migrate://checkpoints/{id}`**
   - **Description:** Read specific checkpoint by ID
   - **URI Template:** `effect-migrate://checkpoints/{checkpointId}`
   - **Content Type:** `application/json`
   - **Response:** Full checkpoint data

2. **`effect-migrate://summary`**
   - **Description:** Overall project migration status
   - **URI:** `effect-migrate://summary`
   - **Content Type:** `application/json`
   - **Response:**
     ```typescript
     {
       totalCheckpoints: number,
       latestCheckpoint: CheckpointSummary,
       trends: {
         violations: TrendDirection,
         files: TrendDirection
       },
       topHotspots: HotspotSummary[]
     }
     ```

3. **`effect-migrate://checkpoints` (list)**
   - **Description:** List all available checkpoint URIs
   - **URI:** `effect-migrate://checkpoints`
   - **Content Type:** `application/json`
   - **Response:** Array of `{ id, uri, timestamp }`

#### MCP Prompts

Prompts are agent guidance templates (future enhancement).

**Planned Prompts:**

1. **`analyze_migration_status`**
   - Guides agent to assess project migration health
   - Uses `checkpoint_latest` + `analytics_trends`

2. **`investigate_regression`**
   - Helps agent find cause of violation increases
   - Uses `checkpoint_diff` + `analytics_hotspots`

**Note:** Prompts are optional for initial release; focus on tools/resources.

**Implementation Structure:**

```typescript
// src/tools/checkpointLatest.ts
import { Effect } from "effect"
import type { CheckpointRepository } from "@effect-migrate/sqlite"

export const checkpointLatestTool = (repo: CheckpointRepository) => ({
  name: "checkpoint_latest",
  description: "Get the most recent migration checkpoint",
  inputSchema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["summary", "full"],
        default: "summary"
      }
    }
  },
  handler: (args: { format?: "summary" | "full" }) =>
    Effect.gen(function* () {
      const latest = yield* repo.getLatest()
      if (!latest) return { content: [{ type: "text", text: "No checkpoints found" }] }
      
      const data = args.format === "full" ? latest : {
        id: latest.id,
        timestamp: latest.timestamp,
        totalViolations: latest.totalViolations,
        filesWithViolations: latest.filesWithViolations
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      }
    })
})
```

**Success Criteria:**
- [x] All 5 tools defined with input schemas
- [x] All 3 resources defined with URI patterns
- [x] Tools return MCP-compliant responses
- [x] Resources handle 404 gracefully

---

### Phase 3: Implement Read-Only Operations (2 hours)

**Objective:** Wire tools/resources to SQLite and analytics services

**Tasks:**

1. **Create service layer**
   ```typescript
   // src/services/McpQueryService.ts
   export interface McpQueryService {
     readonly getLatestCheckpoint: (format: "summary" | "full") => Effect.Effect<CheckpointData>
     readonly listCheckpoints: (opts: ListOptions) => Effect.Effect<CheckpointList>
     readonly compareCheckpoints: (from: string, to: string) => Effect.Effect<DiffReport>
     readonly getTrends: (opts: TrendOptions) => Effect.Effect<TrendSeries>
     readonly getHotspots: (opts: HotspotOptions) => Effect.Effect<Hotspot[]>
   }
   ```

2. **Implement service with Effect.gen**
   ```typescript
   export const McpQueryServiceLive = Layer.effect(
     McpQueryService,
     Effect.gen(function* () {
       const checkpointRepo = yield* CheckpointRepository
       const analyticsService = yield* AnalyticsService
       
       return {
         getLatestCheckpoint: (format) => /* ... */,
         listCheckpoints: (opts) => /* ... */,
         // etc.
       }
     })
   )
   ```

3. **Wire to MCP tool handlers**
   - Each tool handler calls McpQueryService
   - Convert Effect errors to MCP error responses
   - Format output as MCP content blocks

4. **Handle resource URIs**
   ```typescript
   // src/resources/checkpointResource.ts
   export const checkpointResourceHandler = (queryService: McpQueryService) =>
     (uri: string) =>
       Effect.gen(function* () {
         const match = uri.match(/^effect-migrate:\/\/checkpoints\/(.+)$/)
         if (!match) return { error: "Invalid URI" }
         
         const checkpoint = yield* queryService.getCheckpointById(match[1])
         return {
           contents: [{
             uri,
             mimeType: "application/json",
             text: JSON.stringify(checkpoint, null, 2)
           }]
         }
       })
   ```

5. **Add database path configuration**
   - Read from environment variable `EFFECT_MIGRATE_DB_PATH`
   - Default to `./.effect-migrate/checkpoints.db`
   - Validate database exists before starting server

**Error Handling:**

- **Database not found:** Return friendly error with setup instructions
- **Invalid checkpoint ID:** Return 404 with suggestion to list checkpoints
- **Query failures:** Log error, return sanitized message to agent

**Success Criteria:**
- [x] All tools query SQLite via service layer
- [x] All resources return valid JSON content
- [x] Errors are user-friendly and actionable
- [x] No database writes (read-only guarantee)

---

### Phase 4: Server Startup and stdio Transport (1.5 hours)

**Objective:** Create MCP server with stdio transport for Amp integration

**Tasks:**

1. **Implement MCP server**
   ```typescript
   // src/server.ts
   import { Server } from "@modelcontextprotocol/sdk/server/index.js"
   import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
   import { Effect, Layer } from "effect"
   
   export const createMcpServer = Effect.gen(function* () {
     const queryService = yield* McpQueryService
     
     const server = new Server(
       {
         name: "effect-migrate",
         version: "0.1.0"
       },
       {
         capabilities: {
           tools: {},
           resources: {}
         }
       }
     )
     
     // Register tools
     server.setRequestHandler(ListToolsRequestSchema, async () => ({
       tools: [
         checkpointLatestTool.definition,
         checkpointListTool.definition,
         checkpointDiffTool.definition,
         analyticsTrendsTool.definition,
         analyticsHotspotsTool.definition
       ]
     }))
     
     server.setRequestHandler(CallToolRequestSchema, async (request) => {
       const handler = toolHandlers[request.params.name]
       if (!handler) throw new Error(`Unknown tool: ${request.params.name}`)
       
       return yield* Effect.runPromise(
         handler(request.params.arguments).pipe(
           Effect.provide(/* layers */)
         )
       )
     })
     
     // Register resources
     server.setRequestHandler(ListResourcesRequestSchema, async () => ({
       resources: [
         { uri: "effect-migrate://summary", name: "Migration Summary" },
         { uri: "effect-migrate://checkpoints", name: "Checkpoint List" },
         {
           uri: "effect-migrate://checkpoints/{id}",
           name: "Specific Checkpoint",
           description: "Read checkpoint by ID"
         }
       ]
     }))
     
     server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
       return yield* Effect.runPromise(
         handleResourceRead(request.params.uri).pipe(
           Effect.provide(/* layers */)
         )
       )
     })
     
     return server
   })
   ```

2. **Create entry point**
   ```typescript
   // src/index.ts
   import { NodeRuntime } from "@effect/platform-node"
   import { Effect } from "effect"
   import { createMcpServer } from "./server.js"
   
   const program = Effect.gen(function* () {
     const server = yield* createMcpServer
     
     const transport = new StdioServerTransport()
     yield* Effect.promise(() => server.connect(transport))
     
     yield* Effect.log("effect-migrate MCP server running on stdio")
   })
   
   program.pipe(
     Effect.provide(/* all layers */),
     NodeRuntime.runMain
   )
   ```

3. **Add bin executable**
   ```json
   // package.json
   {
     "bin": {
       "effect-migrate-mcp": "./dist/index.js"
     }
   }
   ```

4. **Add shebang to built file**
   - Add `#!/usr/bin/env node` to `dist/index.js` in build step
   - Ensure executable permissions

5. **Test stdio communication**
   ```bash
   # Start server
   node dist/index.js
   
   # Send MCP request via stdin
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
   ```

**Success Criteria:**
- [x] Server starts without errors
- [x] stdio transport receives/sends JSON-RPC messages
- [x] Tools and resources respond correctly
- [x] Server shuts down gracefully on SIGINT

---

### Phase 5: Package and Integration (1 hour)

**Objective:** Publish as npm package for Amp installation

**Tasks:**

1. **Update package.json metadata**
   ```json
   {
     "name": "@effect-migrate/mcp-server",
     "version": "0.1.0",
     "description": "MCP server exposing effect-migrate checkpoints to AI agents",
     "keywords": ["mcp", "model-context-protocol", "effect", "migration", "amp"],
     "repository": {
       "type": "git",
       "url": "https://github.com/aridyckovsky/effect-migrate",
       "directory": "packages/mcp-server"
     },
     "author": "Ari Dyckovsky",
     "license": "MIT"
   }
   ```

2. **Write README.md**
   - Installation instructions
   - Amp integration setup
   - Tool usage examples
   - Troubleshooting (database path, permissions)

3. **Create Amp configuration example**
   ```json
   // .amp/mcp-servers.json
   {
     "mcpServers": {
       "effect-migrate": {
         "command": "npx",
         "args": ["@effect-migrate/mcp-server"],
         "env": {
           "EFFECT_MIGRATE_DB_PATH": "${workspaceFolder}/.effect-migrate/checkpoints.db"
         }
       }
     }
   }
   ```

4. **Add changeset**
   ```bash
   pnpm changeset
   # Select: @effect-migrate/mcp-server
   # Type: minor
   # Summary: "Add MCP server for Amp integration with checkpoint and analytics tools"
   ```

5. **Document in main README**
   - Add "Amp Integration" section
   - Link to MCP server package
   - Explain agent-assisted migration workflows

6. **Create integration test**
   ```typescript
   // src/__tests__/integration.test.ts
   import { spawn } from "child_process"
   
   test("MCP server responds to tools/list", async () => {
     const server = spawn("node", ["dist/index.js"])
     
     const request = JSON.stringify({
       jsonrpc: "2.0",
       id: 1,
       method: "tools/list"
     }) + "\n"
     
     server.stdin.write(request)
     
     const response = await new Promise((resolve) => {
       server.stdout.once("data", (data) => {
         resolve(JSON.parse(data.toString()))
       })
     })
     
     expect(response).toMatchObject({
       jsonrpc: "2.0",
       id: 1,
       result: {
         tools: expect.arrayContaining([
           expect.objectContaining({ name: "checkpoint_latest" })
         ])
       }
     })
     
     server.kill()
   })
   ```

**Success Criteria:**
- [x] Package builds for publication
- [x] README has clear Amp setup instructions
- [x] Integration test passes
- [x] Changeset created

---

## Testing Strategy

### Unit Tests

**Service Layer Tests:**

```typescript
// src/__tests__/McpQueryService.test.ts
import { layer } from "@effect/vitest"
import { Effect } from "effect"

layer(McpQueryServiceLive)("McpQueryService", (it) => {
  it.effect("getLatestCheckpoint returns most recent", () =>
    Effect.gen(function* () {
      const service = yield* McpQueryService
      
      // Setup: Create checkpoints
      const repo = yield* CheckpointRepository
      yield* repo.save({ timestamp: "2025-11-01", violations: 10 })
      yield* repo.save({ timestamp: "2025-11-05", violations: 5 })
      
      const latest = yield* service.getLatestCheckpoint("summary")
      
      expect(latest.timestamp).toBe("2025-11-05")
      expect(latest.violations).toBe(5)
    })
  )
  
  it.effect("listCheckpoints respects limit and offset", () =>
    Effect.gen(function* () {
      const service = yield* McpQueryService
      
      const list = yield* service.listCheckpoints({ limit: 2, offset: 1 })
      
      expect(list.items).toHaveLength(2)
      expect(list.total).toBeGreaterThanOrEqual(3)
    })
  )
})
```

**Tool Handler Tests:**

```typescript
// src/__tests__/tools/checkpointLatest.test.ts
it.effect("checkpoint_latest tool returns valid MCP response", () =>
  Effect.gen(function* () {
    const tool = checkpointLatestTool(mockQueryService)
    
    const response = yield* tool.handler({ format: "summary" })
    
    expect(response).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"id":')
        }
      ]
    })
  })
)
```

### Integration Tests

**MCP Protocol Compliance:**

```typescript
// src/__tests__/mcp-protocol.test.ts
import { spawn } from "child_process"

describe("MCP Protocol", () => {
  let serverProcess: ChildProcess
  
  beforeEach(() => {
    serverProcess = spawn("node", ["dist/index.js"], {
      env: { EFFECT_MIGRATE_DB_PATH: "./test-fixtures/test.db" }
    })
  })
  
  afterEach(() => {
    serverProcess.kill()
  })
  
  test("responds to initialize request", async () => {
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" }
      }
    }
    
    const response = await sendRequest(serverProcess, request)
    
    expect(response.result).toMatchObject({
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {}
      },
      serverInfo: {
        name: "effect-migrate",
        version: expect.any(String)
      }
    })
  })
  
  test("tools/list returns all tools", async () => {
    const response = await sendRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    })
    
    expect(response.result.tools).toHaveLength(5)
    expect(response.result.tools.map(t => t.name)).toEqual([
      "checkpoint_latest",
      "checkpoint_list",
      "checkpoint_diff",
      "analytics_trends",
      "analytics_hotspots"
    ])
  })
  
  test("tools/call executes checkpoint_latest", async () => {
    const response = await sendRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "checkpoint_latest",
        arguments: { format: "summary" }
      }
    })
    
    expect(response.result.content).toBeDefined()
    expect(response.result.content[0].type).toBe("text")
  })
  
  test("resources/list returns all resources", async () => {
    const response = await sendRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 4,
      method: "resources/list"
    })
    
    expect(response.result.resources).toContainEqual(
      expect.objectContaining({ uri: "effect-migrate://summary" })
    )
  })
  
  test("resources/read handles checkpoint resource", async () => {
    const response = await sendRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 5,
      method: "resources/read",
      params: {
        uri: "effect-migrate://summary"
      }
    })
    
    expect(response.result.contents[0].mimeType).toBe("application/json")
    expect(JSON.parse(response.result.contents[0].text)).toMatchObject({
      totalCheckpoints: expect.any(Number),
      latestCheckpoint: expect.any(Object)
    })
  })
})
```

### Manual Testing

**Test with Amp:**

1. Install MCP server in test project:
   ```bash
   cd /path/to/test-project
   pnpm add -D @effect-migrate/mcp-server
   ```

2. Configure Amp:
   ```json
   // .amp/mcp-servers.json
   {
     "mcpServers": {
       "effect-migrate": {
         "command": "npx",
         "args": ["@effect-migrate/mcp-server"]
       }
     }
   }
   ```

3. Restart Amp

4. Test queries:
   - "What's the latest migration checkpoint?"
   - "Show me trends in violations over the last month"
   - "Which files have the most violations?"
   - "Compare checkpoints X and Y"

**Expected Behavior:**
- Amp recognizes effect-migrate tools
- Queries return formatted data
- Agent can reason about migration status

---

## Success Criteria Checklist

### Functional Requirements

- [ ] MCP server starts and listens on stdio
- [ ] All 5 tools implemented and working
- [ ] All 3 resources implemented and working
- [ ] Tools query SQLite via service layer
- [ ] Resources return valid JSON content
- [ ] Error handling is graceful and informative

### Quality Requirements

- [ ] Unit tests for all service methods
- [ ] Integration tests for MCP protocol compliance
- [ ] Type safety maintained (strict mode passes)
- [ ] No database writes (read-only guarantee enforced)
- [ ] Concurrency-safe (multiple tool calls don't conflict)

### Documentation

- [ ] README with installation and setup
- [ ] Tool usage examples
- [ ] Amp integration guide
- [ ] Troubleshooting section
- [ ] API documentation for each tool/resource

### Publishing

- [ ] Package builds without errors
- [ ] Changeset created
- [ ] npm package ready for publication
- [ ] Version in package.json matches changeset

### Integration Testing

- [ ] Manual test with Amp succeeds
- [ ] Tools return expected data formats
- [ ] Agent can successfully query checkpoints
- [ ] Resource URIs resolve correctly

---

## Follow-Up Work

### Future Enhancements

1. **Write Operations (Future PR)**
   - Add `checkpoint_delete` tool
   - Add `checkpoint_annotate` tool for agent notes
   - Require confirmation for destructive operations

2. **Prompts (Future PR)**
   - Implement `analyze_migration_status` prompt
   - Implement `investigate_regression` prompt
   - Add prompt templates for common agent tasks

3. **Subscriptions (Future PR)**
   - Subscribe to checkpoint creation events
   - Notify agent when new checkpoints are saved
   - Real-time trend updates

4. **Advanced Queries (Future PR)**
   - Full-text search across violation messages
   - Custom analytics queries
   - Export to CSV/JSON for external tools

### Optimization Opportunities

- Cache frequently accessed checkpoints
- Paginate large result sets
- Add query timeouts for safety
- Implement rate limiting for expensive operations

---

## Notes

### MCP SDK Version

Using `@modelcontextprotocol/sdk` v1.0.0+ which supports:
- JSON-RPC 2.0
- stdio transport
- Tools, Resources, Prompts
- Error handling patterns

### Security Considerations

- **Read-only by design:** No write operations in initial release
- **Database path validation:** Prevent path traversal attacks
- **Input sanitization:** Validate all tool arguments
- **Error message sanitization:** Don't leak filesystem paths

### Amp Integration Tips

- Test with Amp's MCP inspector for debugging
- Use clear tool descriptions for agent understanding
- Return structured data (JSON) for easy parsing
- Include examples in tool descriptions

### Effect Patterns

- Use `Effect.gen` for service implementations
- Provide all dependencies via Layers
- Convert Effect errors to MCP error responses
- Log all tool calls for debugging

---

**Status:** Ready for implementation\
**Blocking:** PR6 (SQLite), PR7 (Analytics)\
**Blocks:** None (enables agent workflows)
