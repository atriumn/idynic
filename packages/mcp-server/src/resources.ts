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
