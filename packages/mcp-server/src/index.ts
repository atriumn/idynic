#!/usr/bin/env node

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
