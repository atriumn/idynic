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
