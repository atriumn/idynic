import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

// Create mocks
const mockSupabaseFrom = vi.fn();
const mockValidateApiKey = vi.fn();
const mockChatCreate = vi.fn();
const mockGenerateEmbedding = vi.fn();
const mockCreateOpportunity = vi.fn();
const mockInngestSend = vi.fn();

// Mock createOpportunity
vi.mock("@/lib/opportunities/create-opportunity", () => ({
  createOpportunity: (...args: unknown[]) => mockCreateOpportunity(...args),
}));

// Mock Inngest
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}));

// Mock OpenAI
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockChatCreate,
        },
      };
    },
  };
});

// Mock Supabase service role client
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn().mockImplementation(() => ({
    from: mockSupabaseFrom,
  })),
}));

// Mock auth module
vi.mock("@/lib/api/auth", () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  isAuthError: (result: unknown) => result instanceof Response,
}));

// Mock embeddings
vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
}));

// Mock response helpers
vi.mock("@/lib/api/response", () => ({
  apiSuccess: (data: unknown, meta?: Record<string, unknown>) => {
    return new Response(
      JSON.stringify({ success: true, data, ...(meta && { meta }) }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
  apiError: (code: string, message: string, status: number) => {
    return new Response(
      JSON.stringify({ success: false, error: { code, message } }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
  ApiErrors: {
    notFound: (resource: string) => {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "not_found", message: `${resource} not found` },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  },
}));

function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): NextRequest {
  const { method = "GET", headers = {}, body } = options;

  const requestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body && method !== "GET" ? JSON.stringify(body) : undefined,
  };

  return new NextRequest(new URL(url, "http://localhost:3000"), requestInit);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

const mockOpportunities = [
  {
    id: "opp-1",
    title: "Senior Engineer",
    company: "Tech Corp",
    url: "https://example.com/job/1",
    description: "Looking for senior engineer...",
    requirements: { mustHave: [], niceToHave: [], responsibilities: [] },
    status: "tracking",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "opp-2",
    title: "Staff Engineer",
    company: "Startup Inc",
    url: null,
    description: "Staff engineer role...",
    requirements: { mustHave: [], niceToHave: [], responsibilities: [] },
    status: "applied",
    created_at: "2024-01-02T00:00:00Z",
  },
];

describe("Opportunities API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({ userId: "user-123" });
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
  });

  describe("GET /api/v1/opportunities", () => {
    it("returns list of opportunities", async () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({ data: mockOpportunities, error: null }),
          }),
        }),
      }));

      const { GET } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: typeof mockOpportunities;
        count: number;
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].title).toBe("Senior Engineer");
    });

    it("filters by status", async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => ({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [mockOpportunities[1]],
              error: null,
            }),
          }),
        })),
      });

      mockSupabaseFrom.mockImplementation(() => ({
        select: selectMock,
      }));

      const { GET } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest(
        "/api/v1/opportunities?status=applied",
        {
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

      const response = (await GET(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: typeof mockOpportunities;
      }>(response);

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe("applied");
    });

    it("returns 401 when API key is missing", async () => {
      const authError = new Response(
        JSON.stringify({
          success: false,
          error: { code: "unauthorized", message: "Missing API key" },
        }),
        { status: 401 },
      );

      mockValidateApiKey.mockResolvedValue(authError);

      const { GET } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities");

      const response = (await GET(request)) as NextResponse;

      expect(response.status).toBe(401);
    });

    it("returns empty array on database error", async () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      }));

      const { GET } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: unknown[];
        count: number;
      }>(response);

      expect(response.status).toBe(200);
      expect(body.data).toEqual([]);
    });

    it("adds match_score placeholder to each opportunity", async () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({ data: [mockOpportunities[0]], error: null }),
          }),
        }),
      }));

      const { GET } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: Array<{ match_score: null }>;
      }>(response);

      expect(body.data[0].match_score).toBeNull();
    });
  });

  describe("POST /api/v1/opportunities", () => {
    beforeEach(() => {
      // Mock createOpportunity to return success by default
      mockCreateOpportunity.mockResolvedValue({
        success: true,
        data: {
          opportunity: {
            id: "new-opp-123",
            title: "Senior Software Engineer",
            company: "Acme Corp",
            status: "tracking",
            source: "manual",
            created_at: "2024-01-01T00:00:00Z",
          },
          requirements: {
            mustHave: [
              { text: "5+ years Python", type: "experience" },
              { text: "Bachelor's in CS", type: "education" },
            ],
            niceToHave: [{ text: "AWS Certified", type: "certification" }],
            responsibilities: ["Lead technical design"],
          },
          enrichedDescription: "Job description...",
        },
      });

      mockInngestSend.mockResolvedValue(undefined);
    });

    it("creates opportunity and triggers company research", async () => {
      const { POST } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        method: "POST",
        headers: { Authorization: "Bearer idn_test123" },
        body: {
          description: "Senior Software Engineer at Acme Corp...",
          url: "https://jobs.example.com/123",
        },
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: {
          id: string;
          title: string;
          company: string;
          requirements: { must_have_count: number; nice_to_have_count: number };
        };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("new-opp-123");
      expect(body.data.title).toBe("Senior Software Engineer");
      expect(body.data.requirements.must_have_count).toBe(2);
      expect(body.data.requirements.nice_to_have_count).toBe(1);

      // Should trigger Inngest for company research
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: "opportunity/research-company",
        data: expect.objectContaining({
          opportunityId: "new-opp-123",
          companyName: "Acme Corp",
        }),
      });
    });

    it("does not trigger company research when no company", async () => {
      mockCreateOpportunity.mockResolvedValue({
        success: true,
        data: {
          opportunity: {
            id: "new-opp-123",
            title: "Remote Position",
            company: null, // No company
            status: "tracking",
            source: "manual",
            created_at: "2024-01-01T00:00:00Z",
          },
          requirements: { mustHave: [], niceToHave: [], responsibilities: [] },
          enrichedDescription: "Job description...",
        },
      });

      const { POST } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        method: "POST",
        headers: { Authorization: "Bearer idn_test123" },
        body: { description: "Remote position..." },
      });

      const response = (await POST(request)) as NextResponse;

      expect(response.status).toBe(200);
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("returns validation error from createOpportunity", async () => {
      mockCreateOpportunity.mockResolvedValue({
        success: false,
        error: {
          code: "validation_error",
          message: "URL or description is required",
        },
      });

      const { POST } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        method: "POST",
        headers: { Authorization: "Bearer idn_test123" },
        body: {},
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
    });

    it("returns 401 when API key is missing", async () => {
      const authError = new Response(
        JSON.stringify({
          success: false,
          error: { code: "unauthorized", message: "Missing API key" },
        }),
        { status: 401 },
      );

      mockValidateApiKey.mockResolvedValue(authError);

      const { POST } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        method: "POST",
        body: { description: "Test job" },
      });

      const response = (await POST(request)) as NextResponse;

      expect(response.status).toBe(401);
    });

    it("returns duplicate error with existing opportunity", async () => {
      mockCreateOpportunity.mockResolvedValue({
        success: false,
        error: {
          code: "duplicate",
          message: "This opportunity already exists",
          existing: { id: "existing-123", title: "Senior Engineer" },
        },
      });

      const { POST } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        method: "POST",
        headers: { Authorization: "Bearer idn_test123" },
        body: { description: "Duplicate job..." },
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        error: { code: string; message: string };
        data: { existing: { id: string } };
      }>(response);

      expect(response.status).toBe(409);
      expect(body.error.code).toBe("duplicate");
      expect(body.data.existing.id).toBe("existing-123");
    });

    it("returns scraping_failed error", async () => {
      mockCreateOpportunity.mockResolvedValue({
        success: false,
        error: {
          code: "scraping_failed",
          message: "Could not scrape URL",
        },
      });

      const { POST } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        method: "POST",
        headers: { Authorization: "Bearer idn_test123" },
        body: { url: "https://invalid-url.com" },
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("scraping_failed");
    });

    it("returns server_error on unexpected failure", async () => {
      mockCreateOpportunity.mockResolvedValue({
        success: false,
        error: {
          code: "server_error",
          message: "Database error",
        },
      });

      const { POST } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        method: "POST",
        headers: { Authorization: "Bearer idn_test123" },
        body: { description: "Job description..." },
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(500);
      expect(body.error.code).toBe("server_error");
    });

    it("calls createOpportunity with correct parameters", async () => {
      const { POST } = await import("@/app/api/v1/opportunities/route");
      const request = createMockRequest("/api/v1/opportunities", {
        method: "POST",
        headers: { Authorization: "Bearer idn_test123" },
        body: {
          description: "Job description",
          url: "https://example.com/job",
        },
      });

      await POST(request);

      expect(mockCreateOpportunity).toHaveBeenCalledWith(
        expect.anything(), // supabase client
        {
          userId: "user-123",
          url: "https://example.com/job",
          description: "Job description",
        },
      );
    });
  });
});

describe("Opportunity [id] API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({ userId: "user-123" });
  });

  describe("GET /api/v1/opportunities/[id]", () => {
    it("returns single opportunity", async () => {
      const mockOpportunity = {
        id: "opp-123",
        title: "Senior Engineer",
        company: "Tech Corp",
        url: "https://example.com/job",
        description: "Full job description...",
        requirements: { mustHave: [], niceToHave: [] },
        status: "tracking",
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: mockOpportunity, error: null }),
            }),
          }),
        }),
      }));

      const { GET } = await import("@/app/api/v1/opportunities/[id]/route");
      const request = createMockRequest("/api/v1/opportunities/opp-123", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: typeof mockOpportunity;
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("opp-123");
      expect(body.data.title).toBe("Senior Engineer");
    });

    it("returns 404 when opportunity not found", async () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
            }),
          }),
        }),
      }));

      const { GET } = await import("@/app/api/v1/opportunities/[id]/route");
      const request = createMockRequest("/api/v1/opportunities/nonexistent", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request, {
        params: Promise.resolve({ id: "nonexistent" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(404);
      expect(body.error.code).toBe("not_found");
    });

    it("returns 401 when API key is missing", async () => {
      const authError = new Response(
        JSON.stringify({
          success: false,
          error: { code: "unauthorized", message: "Missing API key" },
        }),
        { status: 401 },
      );

      mockValidateApiKey.mockResolvedValue(authError);

      const { GET } = await import("@/app/api/v1/opportunities/[id]/route");
      const request = createMockRequest("/api/v1/opportunities/opp-123");

      const response = (await GET(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;

      expect(response.status).toBe(401);
    });

    it("only returns opportunities owned by user", async () => {
      // Simulates user trying to access another user's opportunity
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          eq: vi.fn().mockImplementation((field, value) => {
            // Returns chainable eq that filters by both id AND user_id
            return {
              eq: vi.fn().mockImplementation(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Not found" },
                }),
              })),
            };
          }),
        }),
      }));

      const { GET } = await import("@/app/api/v1/opportunities/[id]/route");
      const request = createMockRequest(
        "/api/v1/opportunities/other-user-opp",
        {
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

      const response = (await GET(request, {
        params: Promise.resolve({ id: "other-user-opp" }),
      })) as NextResponse;

      expect(response.status).toBe(404);
    });
  });
});
