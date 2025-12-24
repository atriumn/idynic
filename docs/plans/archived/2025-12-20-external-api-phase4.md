# External API Phase 4: MCP Server

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** Done
**Goal:** Create an MCP server package that exposes Idynic functionality to AI assistants like Claude Desktop.

## Progress (Last reviewed: 2025-12-24)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: Package Setup | ✅ Complete | Verified packages/mcp-server/ |
| Task 2: Create MCP Server | ✅ Complete | src/index.ts exists |
| Task 3: Implement Tools | ✅ Complete | |
| Task 4: Documentation | ✅ Complete | README.md exists |

### Drift Notes
None - implementation matches plan

**Architecture:** Standalone npm package using `@modelcontextprotocol/sdk` that wraps the REST API. Uses stdio transport for Claude Desktop integration. Tools map 1:1 to REST endpoints.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, node-fetch, zod

---

## Task 1: Package Setup

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/src/index.ts`

**Step 1: Create package directory**

```bash
mkdir -p packages/mcp-server/src
```

**Step 2: Create package.json**

```json
{
  "name": "@idynic/mcp-server",
  "version": "0.1.0",
  "description": "MCP server for Idynic - AI career companion",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "idynic-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "keywords": ["mcp", "idynic", "career", "ai"],
  "author": "Atriumn",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create minimal entry point**

```typescript
#!/usr/bin/env node
// packages/mcp-server/src/index.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "idynic",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Idynic MCP server started");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
```

**Step 5: Install dependencies and build**

```bash
cd packages/mcp-server && npm install && npm run build
```

**Step 6: Commit**

```bash
git add packages/mcp-server
git commit -m "feat(mcp): scaffold MCP server package"
```

---

## Task 2: REST Client Wrapper

**Files:**
- Create: `packages/mcp-server/src/client.ts`

**Step 1: Create the API client**

```typescript
// packages/mcp-server/src/client.ts

export interface ApiResponse<T> {
  data: T;
  meta?: {
    request_id?: string;
    count?: number;
    has_more?: boolean;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
}

export class IdynicClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl = "https://idynic.com/api/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    return (data as ApiResponse<T>).data;
  }

  // Profile
  async getProfile() {
    return this.request<ProfileData>("GET", "/profile");
  }

  async updateProfile(updates: ProfileUpdate) {
    return this.request<ProfileData>("PATCH", "/profile", updates);
  }

  // Claims
  async getClaims() {
    return this.request<Claim[]>("GET", "/claims");
  }

  // Opportunities
  async listOpportunities(status?: string) {
    const query = status ? `?status=${status}` : "";
    return this.request<Opportunity[]>("GET", `/opportunities${query}`);
  }

  async getOpportunity(id: string) {
    return this.request<Opportunity>("GET", `/opportunities/${id}`);
  }

  async addOpportunity(data: { url?: string; description: string }) {
    return this.request<Opportunity>("POST", "/opportunities", data);
  }

  async getMatch(id: string) {
    return this.request<MatchAnalysis>("GET", `/opportunities/${id}/match`);
  }

  async getTailoredProfile(id: string) {
    return this.request<TailoredProfile>(
      "GET",
      `/opportunities/${id}/tailored-profile`
    );
  }

  async createShareLink(id: string) {
    return this.request<ShareLink>("POST", `/opportunities/${id}/share`);
  }

  // Work History
  async listWorkHistory() {
    return this.request<WorkHistoryEntry[]>("GET", "/profile/work-history");
  }

  async updateWorkHistory(id: string, updates: WorkHistoryUpdate) {
    return this.request<WorkHistoryEntry>(
      "PATCH",
      `/profile/work-history/${id}`,
      updates
    );
  }

  // SSE endpoints (return raw response for streaming)
  async tailorProfile(id: string): Promise<Response> {
    const url = `${this.baseUrl}/opportunities/${id}/tailor`;
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  async addAndTailor(data: {
    url?: string;
    description: string;
  }): Promise<Response> {
    const url = `${this.baseUrl}/opportunities/add-and-tailor`;
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }

  async addTailorShare(data: {
    url?: string;
    description: string;
  }): Promise<Response> {
    const url = `${this.baseUrl}/opportunities/add-tailor-share`;
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }
}

// Types
export interface ProfileData {
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin_url: string | null;
    github_url: string | null;
    website_url: string | null;
  };
  experience: WorkHistoryEntry[];
  skills: Claim[];
  education: Claim[];
  certifications: Claim[];
}

export interface ProfileUpdate {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface Claim {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
}

export interface Opportunity {
  id: string;
  title: string;
  company: string | null;
  url: string | null;
  status: string;
  match_score: number | null;
  created_at: string;
}

export interface MatchAnalysis {
  score: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export interface TailoredProfile {
  id: string;
  opportunity_id: string;
  summary: string | null;
  experience: unknown[];
  skills: string[];
  created_at: string;
}

export interface ShareLink {
  token: string;
  url: string;
  expires_at: string | null;
}

export interface WorkHistoryEntry {
  id: string;
  company: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  summary: string | null;
}

export interface WorkHistoryUpdate {
  company?: string;
  title?: string;
  start_date?: string;
  end_date?: string | null;
  summary?: string | null;
}
```

**Step 2: Verify and commit**

```bash
cd packages/mcp-server && npm run build
git add packages/mcp-server/src/client.ts
git commit -m "feat(mcp): add REST API client wrapper"
```

---

## Task 3: Tools Implementation

**Files:**
- Create: `packages/mcp-server/src/tools.ts`
- Modify: `packages/mcp-server/src/index.ts`

**Step 1: Create tools module**

```typescript
// packages/mcp-server/src/tools.ts

import { z } from "zod";
import type { IdynicClient } from "./client.js";

// Tool definitions
export const tools = [
  {
    name: "get_profile",
    description:
      "Get the user's full profile including contact info, work history, skills, and education",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "update_profile",
    description: "Update the user's contact information",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Full name" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        location: { type: "string", description: "City, State or location" },
        linkedin: { type: "string", description: "LinkedIn profile URL" },
        github: { type: "string", description: "GitHub profile URL" },
        website: { type: "string", description: "Personal website URL" },
      },
      required: [],
    },
  },
  {
    name: "get_claims",
    description:
      "Get the user's identity claims - skills, achievements, education, and certifications with confidence scores",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_opportunities",
    description: "List all tracked job opportunities with match scores",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description:
            "Filter by status: tracking, applied, interviewing, offered, rejected, withdrawn",
        },
      },
      required: [],
    },
  },
  {
    name: "get_opportunity",
    description: "Get details of a specific job opportunity",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Opportunity ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "add_opportunity",
    description:
      "Add a new job opportunity by URL or pasting the job description text",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Job posting URL (optional)" },
        description: {
          type: "string",
          description: "Job description text (required)",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "analyze_match",
    description:
      "Get match analysis for a job opportunity - shows strengths, gaps, and recommendations",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Opportunity ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_tailored_profile",
    description: "Get the tailored profile/resume for a specific opportunity",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Opportunity ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_share_link",
    description:
      "Create a shareable link for a tailored profile that can be sent to recruiters",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Opportunity ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "add_and_tailor",
    description:
      "Add a job opportunity and immediately generate a tailored profile for it (combines add + tailor)",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Job posting URL (optional)" },
        description: {
          type: "string",
          description: "Job description text (required)",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "add_tailor_share",
    description:
      "Add a job opportunity, generate tailored profile, and create a share link (all-in-one)",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Job posting URL (optional)" },
        description: {
          type: "string",
          description: "Job description text (required)",
        },
      },
      required: ["description"],
    },
  },
];

// Zod schemas for validation
const updateProfileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().url().optional(),
  github: z.string().url().optional(),
  website: z.string().url().optional(),
});

const opportunityIdSchema = z.object({
  id: z.string().uuid(),
});

const addOpportunitySchema = z.object({
  url: z.string().url().optional(),
  description: z.string().min(50),
});

const listOpportunitiesSchema = z.object({
  status: z.string().optional(),
});

// Tool execution
export async function executeTool(
  client: IdynicClient,
  name: string,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "get_profile": {
        const profile = await client.getProfile();
        return {
          content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
        };
      }

      case "update_profile": {
        const updates = updateProfileSchema.parse(args);
        const profile = await client.updateProfile(updates);
        return {
          content: [
            {
              type: "text",
              text: `Profile updated successfully:\n${JSON.stringify(profile, null, 2)}`,
            },
          ],
        };
      }

      case "get_claims": {
        const claims = await client.getClaims();
        return {
          content: [{ type: "text", text: JSON.stringify(claims, null, 2) }],
        };
      }

      case "list_opportunities": {
        const { status } = listOpportunitiesSchema.parse(args);
        const opportunities = await client.listOpportunities(status);
        return {
          content: [
            { type: "text", text: JSON.stringify(opportunities, null, 2) },
          ],
        };
      }

      case "get_opportunity": {
        const { id } = opportunityIdSchema.parse(args);
        const opportunity = await client.getOpportunity(id);
        return {
          content: [{ type: "text", text: JSON.stringify(opportunity, null, 2) }],
        };
      }

      case "add_opportunity": {
        const data = addOpportunitySchema.parse(args);
        const opportunity = await client.addOpportunity(data);
        return {
          content: [
            {
              type: "text",
              text: `Opportunity added:\n${JSON.stringify(opportunity, null, 2)}`,
            },
          ],
        };
      }

      case "analyze_match": {
        const { id } = opportunityIdSchema.parse(args);
        const match = await client.getMatch(id);
        return {
          content: [{ type: "text", text: JSON.stringify(match, null, 2) }],
        };
      }

      case "get_tailored_profile": {
        const { id } = opportunityIdSchema.parse(args);
        const profile = await client.getTailoredProfile(id);
        return {
          content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
        };
      }

      case "create_share_link": {
        const { id } = opportunityIdSchema.parse(args);
        const link = await client.createShareLink(id);
        return {
          content: [
            {
              type: "text",
              text: `Share link created: ${link.url}\nExpires: ${link.expires_at || "Never"}`,
            },
          ],
        };
      }

      case "add_and_tailor": {
        const data = addOpportunitySchema.parse(args);
        const response = await client.addAndTailor(data);
        const result = await consumeSSEStream(response);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "add_tailor_share": {
        const data = addOpportunitySchema.parse(args);
        const response = await client.addTailorShare(data);
        const result = await consumeSSEStream(response);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
}

// Helper to consume SSE stream and extract final result
async function consumeSSEStream(response: Response): Promise<string> {
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  const events: string[] = [];
  let finalResult: unknown = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.done) {
            finalResult = parsed;
          } else if (parsed.highlight) {
            events.push(parsed.highlight);
          } else if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch {
          // Ignore parse errors for incomplete chunks
        }
      }
    }
  }

  if (finalResult) {
    return `Completed!\n\nProgress:\n${events.join("\n")}\n\nResult:\n${JSON.stringify(finalResult, null, 2)}`;
  }

  return `Completed with ${events.length} events`;
}
```

**Step 2: Update index.ts to register tools**

```typescript
#!/usr/bin/env node
// packages/mcp-server/src/index.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { IdynicClient } from "./client.js";
import { tools, executeTool } from "./tools.js";

// Get API key from environment
const apiKey = process.env.IDYNIC_API_KEY;
const baseUrl = process.env.IDYNIC_API_URL || "https://idynic.com/api/v1";

if (!apiKey) {
  console.error("Error: IDYNIC_API_KEY environment variable is required");
  process.exit(1);
}

const client = new IdynicClient(apiKey, baseUrl);

const server = new Server(
  {
    name: "idynic",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Execute tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return executeTool(client, name, args);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Idynic MCP server started");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
```

**Step 3: Verify and commit**

```bash
cd packages/mcp-server && npm run build
git add packages/mcp-server/src
git commit -m "feat(mcp): implement MCP tools for all REST endpoints"
```

---

## Task 4: Resources Implementation

**Files:**
- Create: `packages/mcp-server/src/resources.ts`
- Modify: `packages/mcp-server/src/index.ts`

**Step 1: Create resources module**

```typescript
// packages/mcp-server/src/resources.ts

import type { IdynicClient } from "./client.js";

export const resourceTemplates = [
  {
    uriTemplate: "idynic://profile",
    name: "User Profile",
    description: "Current user's profile with contact info and work history",
    mimeType: "application/json",
  },
  {
    uriTemplate: "idynic://claims",
    name: "Identity Claims",
    description: "User's skills, education, and certifications with confidence",
    mimeType: "application/json",
  },
  {
    uriTemplate: "idynic://opportunities",
    name: "Opportunities",
    description: "List of tracked job opportunities",
    mimeType: "application/json",
  },
  {
    uriTemplate: "idynic://opportunities/{id}",
    name: "Opportunity Details",
    description: "Details of a specific opportunity",
    mimeType: "application/json",
  },
  {
    uriTemplate: "idynic://opportunities/{id}/match",
    name: "Match Analysis",
    description: "Match analysis for a specific opportunity",
    mimeType: "application/json",
  },
  {
    uriTemplate: "idynic://opportunities/{id}/tailored",
    name: "Tailored Profile",
    description: "Tailored profile for a specific opportunity",
    mimeType: "application/json",
  },
  {
    uriTemplate: "idynic://work-history",
    name: "Work History",
    description: "User's work history entries",
    mimeType: "application/json",
  },
];

export async function readResource(
  client: IdynicClient,
  uri: string
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  try {
    // Parse URI
    const url = new URL(uri);
    const path = url.pathname;

    let data: unknown;

    if (uri === "idynic://profile") {
      data = await client.getProfile();
    } else if (uri === "idynic://claims") {
      data = await client.getClaims();
    } else if (uri === "idynic://opportunities") {
      data = await client.listOpportunities();
    } else if (uri === "idynic://work-history") {
      data = await client.listWorkHistory();
    } else if (path.startsWith("//opportunities/")) {
      const parts = path.split("/");
      const id = parts[2];

      if (parts[3] === "match") {
        data = await client.getMatch(id);
      } else if (parts[3] === "tailored") {
        data = await client.getTailoredProfile(id);
      } else {
        data = await client.getOpportunity(id);
      }
    } else {
      throw new Error(`Unknown resource: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `Error reading resource: ${message}`,
        },
      ],
    };
  }
}
```

**Step 2: Update index.ts to register resources**

```typescript
#!/usr/bin/env node
// packages/mcp-server/src/index.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { IdynicClient } from "./client.js";
import { tools, executeTool } from "./tools.js";
import { resourceTemplates, readResource } from "./resources.js";

// Get API key from environment
const apiKey = process.env.IDYNIC_API_KEY;
const baseUrl = process.env.IDYNIC_API_URL || "https://idynic.com/api/v1";

if (!apiKey) {
  console.error("Error: IDYNIC_API_KEY environment variable is required");
  process.exit(1);
}

const client = new IdynicClient(apiKey, baseUrl);

const server = new Server(
  {
    name: "idynic",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Execute tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return executeTool(client, name, args);
});

// List available resource templates
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return { resourceTemplates };
});

// Read resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  return readResource(client, request.params.uri);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Idynic MCP server started");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
```

**Step 3: Verify and commit**

```bash
cd packages/mcp-server && npm run build
git add packages/mcp-server/src
git commit -m "feat(mcp): implement MCP resources for profile, claims, opportunities"
```

---

## Task 5: CLI Entry Point & README

**Files:**
- Modify: `packages/mcp-server/package.json` (add bin and files)
- Create: `packages/mcp-server/README.md`

**Step 1: Update package.json for publishing**

Ensure bin is properly set and add files array:

```json
{
  "name": "@idynic/mcp-server",
  "version": "0.1.0",
  "description": "MCP server for Idynic - AI career companion",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "idynic-mcp": "dist/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["mcp", "idynic", "career", "ai", "claude"],
  "author": "Atriumn",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/atriumn/idynic.git",
    "directory": "packages/mcp-server"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 2: Create README**

```markdown
# @idynic/mcp-server

MCP (Model Context Protocol) server for [Idynic](https://idynic.com) - your AI career companion.

## Installation

```bash
npm install -g @idynic/mcp-server
```

Or run directly with npx:

```bash
npx @idynic/mcp-server
```

## Configuration

### Environment Variables

- `IDYNIC_API_KEY` (required): Your Idynic API key
- `IDYNIC_API_URL` (optional): API base URL (defaults to https://idynic.com/api/v1)

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "idynic": {
      "command": "npx",
      "args": ["@idynic/mcp-server"],
      "env": {
        "IDYNIC_API_KEY": "idn_your_api_key_here"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_profile` | Get your full profile |
| `update_profile` | Update contact information |
| `get_claims` | Get your identity claims (skills, education, etc.) |
| `list_opportunities` | List tracked job opportunities |
| `get_opportunity` | Get details of a specific opportunity |
| `add_opportunity` | Add a new job opportunity |
| `analyze_match` | Get match analysis for a job |
| `get_tailored_profile` | Get tailored profile for a job |
| `create_share_link` | Create shareable link for a profile |
| `add_and_tailor` | Add job + generate tailored profile |
| `add_tailor_share` | Add + tailor + create share link |

## Available Resources

| URI | Description |
|-----|-------------|
| `idynic://profile` | Your profile data |
| `idynic://claims` | Your identity claims |
| `idynic://opportunities` | Your tracked opportunities |
| `idynic://opportunities/{id}` | Specific opportunity |
| `idynic://opportunities/{id}/match` | Match analysis |
| `idynic://opportunities/{id}/tailored` | Tailored profile |
| `idynic://work-history` | Your work history |

## Getting an API Key

1. Log in to [Idynic](https://idynic.com)
2. Go to Settings > API Keys
3. Create a new key
4. Copy the key (it's only shown once!)

## License

MIT
```

**Step 3: Commit**

```bash
git add packages/mcp-server
git commit -m "docs(mcp): add README and prepare for npm publishing"
```

---

## Task 6: Integration Testing

**Step 1: Test locally with Claude Desktop config**

Create a test config that points to local dev server:

```json
{
  "mcpServers": {
    "idynic-dev": {
      "command": "node",
      "args": ["/path/to/idynic/packages/mcp-server/dist/index.js"],
      "env": {
        "IDYNIC_API_KEY": "idn_your_test_key",
        "IDYNIC_API_URL": "http://localhost:3000/api/v1"
      }
    }
  }
}
```

**Step 2: Test tool listing**

Restart Claude Desktop and verify the Idynic server appears with all tools listed.

**Step 3: Test key operations**

- Get profile
- List opportunities
- Add opportunity
- Analyze match

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(mcp): complete Phase 4 - MCP server implementation"
```

---

## Summary

Phase 4 delivers:
- `packages/mcp-server` - Standalone npm package
- REST API client wrapper
- 11 MCP tools mirroring REST endpoints
- 7 MCP resource templates
- CLI entry point for npx/global install
- Claude Desktop configuration docs

**Files created:**
- `packages/mcp-server/package.json`
- `packages/mcp-server/tsconfig.json`
- `packages/mcp-server/src/index.ts`
- `packages/mcp-server/src/client.ts`
- `packages/mcp-server/src/tools.ts`
- `packages/mcp-server/src/resources.ts`
- `packages/mcp-server/README.md`

**Next:** Phase 5 - Recruiter & Polish
