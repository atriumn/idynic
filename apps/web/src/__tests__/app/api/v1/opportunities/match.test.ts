import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

// Create mocks
const mockSupabaseFrom = vi.fn();
const mockValidateApiKey = vi.fn();
const mockComputeOpportunityMatches = vi.fn();

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

// Mock match computation
vi.mock("@/lib/ai/match-opportunity-api", () => ({
  computeOpportunityMatchesWithClient: (...args: unknown[]) =>
    mockComputeOpportunityMatches(...args),
}));

// Mock response helpers
vi.mock("@/lib/api/response", () => ({
  apiSuccess: (data: unknown) => {
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
  } = {},
): NextRequest {
  const { method = "GET", headers = {} } = options;

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

const mockOpportunity = {
  id: "opp-123",
  title: "Senior Engineer",
  company: "Tech Corp",
};

const mockMatchResult = {
  overallScore: 85,
  mustHaveScore: 90,
  niceToHaveScore: 75,
  strengths: [
    {
      requirement: { text: "5+ years experience", type: "experience" },
      bestMatch: {
        label: "Senior Developer",
        type: "experience",
        similarity: 0.95,
      },
    },
    {
      requirement: { text: "React expertise", type: "skill" },
      bestMatch: {
        label: "React",
        type: "skill",
        similarity: 0.92,
      },
    },
  ],
  gaps: [
    { text: "Kubernetes experience", type: "skill", category: "mustHave" },
    {
      text: "AWS certification",
      type: "certification",
      category: "niceToHave",
    },
  ],
};

describe("Match API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({ userId: "user-123" });
    mockComputeOpportunityMatches.mockResolvedValue(mockMatchResult);
  });

  describe("GET /api/v1/opportunities/[id]/match", () => {
    it("returns match scores and analysis", async () => {
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

      const { GET } =
        await import("@/app/api/v1/opportunities/[id]/match/route");
      const request = createMockRequest("/api/v1/opportunities/opp-123/match", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: {
          opportunity: typeof mockOpportunity;
          scores: { overall: number; must_have: number; nice_to_have: number };
          strengths: Array<{
            requirement: string;
            match: { claim: string; similarity: number } | null;
          }>;
          gaps: Array<{ requirement: string; type: string; category: string }>;
        };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.scores.overall).toBe(85);
      expect(body.data.scores.must_have).toBe(90);
      expect(body.data.scores.nice_to_have).toBe(75);
      expect(body.data.strengths).toHaveLength(2);
      expect(body.data.gaps).toHaveLength(2);
    });

    it("returns opportunity info in response", async () => {
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

      const { GET } =
        await import("@/app/api/v1/opportunities/[id]/match/route");
      const request = createMockRequest("/api/v1/opportunities/opp-123/match", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: { opportunity: { id: string; title: string; company: string } };
      }>(response);

      expect(body.data.opportunity.id).toBe("opp-123");
      expect(body.data.opportunity.title).toBe("Senior Engineer");
      expect(body.data.opportunity.company).toBe("Tech Corp");
    });

    it("formats strength similarities as percentages", async () => {
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

      const { GET } =
        await import("@/app/api/v1/opportunities/[id]/match/route");
      const request = createMockRequest("/api/v1/opportunities/opp-123/match", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: { strengths: Array<{ match: { similarity: number } | null }> };
      }>(response);

      expect(body.data.strengths[0].match?.similarity).toBe(95); // 0.95 * 100
      expect(body.data.strengths[1].match?.similarity).toBe(92); // 0.92 * 100
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

      const { GET } =
        await import("@/app/api/v1/opportunities/[id]/match/route");
      const request = createMockRequest("/api/v1/opportunities/opp-123/match");

      const response = (await GET(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;

      expect(response.status).toBe(401);
    });

    it("returns 404 when opportunity not found", async () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({
                  data: null,
                  error: { message: "Not found" },
                }),
            }),
          }),
        }),
      }));

      const { GET } =
        await import("@/app/api/v1/opportunities/[id]/match/route");
      const request = createMockRequest(
        "/api/v1/opportunities/nonexistent/match",
        {
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

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

    it("limits strengths to top 5", async () => {
      const manyStrengths = Array.from({ length: 10 }, (_, i) => ({
        requirement: { text: `Requirement ${i}`, type: "skill" },
        bestMatch: {
          label: `Match ${i}`,
          type: "skill",
          similarity: 0.9 - i * 0.05,
        },
      }));

      mockComputeOpportunityMatches.mockResolvedValue({
        ...mockMatchResult,
        strengths: manyStrengths,
      });

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

      const { GET } =
        await import("@/app/api/v1/opportunities/[id]/match/route");
      const request = createMockRequest("/api/v1/opportunities/opp-123/match", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: { strengths: unknown[] };
      }>(response);

      expect(body.data.strengths).toHaveLength(5);
    });

    it("handles strengths with null bestMatch", async () => {
      mockComputeOpportunityMatches.mockResolvedValue({
        ...mockMatchResult,
        strengths: [
          {
            requirement: { text: "Some requirement", type: "skill" },
            bestMatch: null,
          },
        ],
      });

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

      const { GET } =
        await import("@/app/api/v1/opportunities/[id]/match/route");
      const request = createMockRequest("/api/v1/opportunities/opp-123/match", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: { strengths: Array<{ match: null }> };
      }>(response);

      expect(body.data.strengths[0].match).toBeNull();
    });

    it("passes correct params to computeOpportunityMatches", async () => {
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

      const { GET } =
        await import("@/app/api/v1/opportunities/[id]/match/route");
      const request = createMockRequest("/api/v1/opportunities/opp-123/match", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      await GET(request, { params: Promise.resolve({ id: "opp-123" }) });

      expect(mockComputeOpportunityMatches).toHaveBeenCalledWith(
        expect.anything(), // supabase client
        "opp-123",
        "user-123",
      );
    });
  });
});
