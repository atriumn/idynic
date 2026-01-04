// src/app/api/v1/openapi.json/route.ts

import { NextResponse } from "next/server";

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Idynic API",
    description: "API for Idynic - AI Career Companion",
    version: "1.0.0",
    contact: {
      name: "Idynic Support",
      url: "https://idynic.com",
    },
  },
  servers: [
    {
      url: "https://idynic.com/api/v1",
      description: "Production",
    },
  ],
  security: [
    {
      bearerAuth: [],
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key in format: idn_xxxxxxxx",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              request_id: { type: "string" },
            },
          },
        },
      },
      Profile: {
        type: "object",
        properties: {
          contact: {
            type: "object",
            properties: {
              name: { type: "string", nullable: true },
              email: { type: "string", nullable: true },
              phone: { type: "string", nullable: true },
              location: { type: "string", nullable: true },
              linkedin_url: { type: "string", nullable: true },
              github_url: { type: "string", nullable: true },
              website_url: { type: "string", nullable: true },
              logo_url: { type: "string", nullable: true },
            },
          },
          identity: { $ref: "#/components/schemas/Identity" },
          experience: {
            type: "array",
            items: { $ref: "#/components/schemas/WorkHistory" },
          },
          skills: {
            type: "array",
            items: { $ref: "#/components/schemas/Claim" },
          },
          education: {
            type: "array",
            items: { $ref: "#/components/schemas/Claim" },
          },
          certifications: {
            type: "array",
            items: { $ref: "#/components/schemas/Claim" },
          },
        },
      },
      Identity: {
        type: "object",
        nullable: true,
        description:
          "AI-generated professional identity snapshot synthesized from claims",
        properties: {
          archetype: {
            type: "string",
            nullable: true,
            description:
              "One of: Builder, Optimizer, Connector, Guide, Stabilizer, Specialist, Strategist, Advocate, Investigator, Performer",
          },
          headline: {
            type: "string",
            nullable: true,
            description: "6-10 word professional tagline",
          },
          bio: {
            type: "string",
            nullable: true,
            description: "2-3 sentence narrative in second person",
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "3-5 defining professional attributes",
          },
          matches: {
            type: "array",
            items: { type: "string" },
            description: "3 specific job titles the user would excel at",
          },
          generated_at: {
            type: "string",
            format: "date-time",
            description: "When the identity was last generated",
          },
        },
      },
      Claim: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          type: { type: "string" },
          label: { type: "string" },
          description: { type: "string", nullable: true },
          confidence: { type: "number" },
        },
      },
      WorkHistory: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          company: { type: "string" },
          title: { type: "string" },
          start_date: { type: "string", nullable: true },
          end_date: { type: "string", nullable: true },
          summary: { type: "string", nullable: true },
        },
      },
      Opportunity: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          company: { type: "string", nullable: true },
          url: { type: "string", nullable: true },
          status: { type: "string" },
          match_score: { type: "number", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/profile": {
      get: {
        summary: "Get user profile",
        tags: ["Profile"],
        responses: {
          "200": {
            description: "User profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Profile" },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
      patch: {
        summary: "Update profile contact info",
        tags: ["Profile"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  location: { type: "string" },
                  linkedin: { type: "string" },
                  github: { type: "string" },
                  website: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated contact info" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/claims": {
      get: {
        summary: "Get identity claims",
        tags: ["Claims"],
        responses: {
          "200": {
            description: "List of claims",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Claim" },
                },
              },
            },
          },
        },
      },
    },
    "/opportunities": {
      get: {
        summary: "List opportunities",
        tags: ["Opportunities"],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string" },
            description: "Filter by status",
          },
        ],
        responses: {
          "200": {
            description: "List of opportunities",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Opportunity" },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Add opportunity",
        tags: ["Opportunities"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["description"],
                properties: {
                  url: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Created opportunity" },
        },
      },
    },
    "/shared/{token}": {
      get: {
        summary: "Get shared profile (public)",
        tags: ["Shared"],
        security: [],
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Shared profile data" },
          "404": { description: "Not found" },
          "410": { description: "Expired or revoked" },
        },
      },
    },
    "/shared/{token}/summary": {
      get: {
        summary: "Get AI candidate summary (public)",
        tags: ["Shared"],
        security: [],
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "AI-generated summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    candidate_name: { type: "string" },
                    summary: { type: "string" },
                    generated_at: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}
