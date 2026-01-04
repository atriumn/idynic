import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

// Create mocks
const mockSupabaseFrom = vi.fn();
const mockValidateApiKey = vi.fn();
const mockCheckTailoredProfileLimit = vi.fn();
const mockInngestSend = vi.fn();

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

// Mock billing/check-usage
vi.mock("@/lib/billing/check-usage", () => ({
  checkTailoredProfileLimit: (...args: unknown[]) =>
    mockCheckTailoredProfileLimit(...args),
}));

// Mock Inngest
vi.mock("@/inngest", () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
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
    body?: unknown;
  } = {},
): NextRequest {
  const { method = "POST", headers = {}, body } = options;

  const requestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  };

  return new NextRequest(new URL(url, "http://localhost:3000"), requestInit);
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

const mockCachedProfile = {
  id: "profile-123",
  narrative: "I am excited to apply for the Senior Engineer role...",
  resume_data: {
    contact: { name: "John Doe", email: "john@example.com" },
    experience: [],
    skills: [],
  },
  created_at: "2024-01-01T00:00:00Z",
};

const mockJob = {
  id: "job-123",
  user_id: "user-123",
  job_type: "tailor",
  opportunity_id: "opp-123",
  status: "pending",
};

describe("Tailor API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({ userId: "user-123" });
    // Default: allow usage
    mockCheckTailoredProfileLimit.mockResolvedValue({ allowed: true });
    mockInngestSend.mockResolvedValue(undefined);
  });

  describe("POST /api/v1/opportunities/[id]/tailor", () => {
    it("returns job_id for async processing when no cached profile exists", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: mockOpportunity, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "tailored_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "document_jobs") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockJob, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } =
        await import("@/app/api/v1/opportunities/[id]/tailor/route");
      const request = createMockRequest(
        "/api/v1/opportunities/opp-123/tailor",
        {
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

      const response = (await POST(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: {
          job_id: string;
          status: string;
          message: string;
        };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.job_id).toBe("job-123");
      expect(body.data.status).toBe("processing");
      expect(body.data.message).toBe("Tailoring in progress");
    });

    it("triggers Inngest event with correct data", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: mockOpportunity, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "tailored_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "document_jobs") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockJob, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } =
        await import("@/app/api/v1/opportunities/[id]/tailor/route");
      const request = createMockRequest(
        "/api/v1/opportunities/opp-123/tailor",
        {
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

      await POST(request, { params: Promise.resolve({ id: "opp-123" }) });

      expect(mockInngestSend).toHaveBeenCalledWith({
        name: "tailor/process",
        data: {
          jobId: "job-123",
          userId: "user-123",
          opportunityId: "opp-123",
          regenerate: false,
        },
      });
    });

    it("returns cached profile immediately when available (sync)", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: mockOpportunity, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "tailored_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({
                      data: mockCachedProfile,
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } =
        await import("@/app/api/v1/opportunities/[id]/tailor/route");
      const request = createMockRequest(
        "/api/v1/opportunities/opp-123/tailor",
        {
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

      const response = (await POST(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: {
          id: string;
          opportunity: typeof mockOpportunity;
          narrative: string;
          resume_data: unknown;
          cached: boolean;
          created_at: string;
        };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("profile-123");
      expect(body.data.narrative).toContain("Senior Engineer");
      expect(body.data.cached).toBe(true);
      // Inngest should NOT be triggered for cached profile
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("triggers async processing when regenerate flag is true even with cached profile", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: mockOpportunity, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "tailored_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({
                      data: mockCachedProfile,
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "document_jobs") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockJob, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } =
        await import("@/app/api/v1/opportunities/[id]/tailor/route");
      const request = createMockRequest(
        "/api/v1/opportunities/opp-123/tailor",
        {
          headers: { Authorization: "Bearer idn_test123" },
          body: { regenerate: true },
        },
      );

      const response = (await POST(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: {
          job_id: string;
          status: string;
        };
      }>(response);

      expect(body.success).toBe(true);
      expect(body.data.job_id).toBe("job-123");
      expect(body.data.status).toBe("processing");
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: "tailor/process",
        data: expect.objectContaining({
          regenerate: true,
        }),
      });
    });

    it("handles empty request body gracefully (defaults to regenerate=false)", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: mockOpportunity, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "tailored_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "document_jobs") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockJob, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } =
        await import("@/app/api/v1/opportunities/[id]/tailor/route");

      // Request with no body
      const request = new NextRequest(
        new URL(
          "/api/v1/opportunities/opp-123/tailor",
          "http://localhost:3000",
        ),
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

      const response = (await POST(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;

      expect(response.status).toBe(200);
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

      const { POST } =
        await import("@/app/api/v1/opportunities/[id]/tailor/route");
      const request = createMockRequest("/api/v1/opportunities/opp-123/tailor");

      const response = (await POST(request, {
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

      const { POST } =
        await import("@/app/api/v1/opportunities/[id]/tailor/route");
      const request = createMockRequest(
        "/api/v1/opportunities/nonexistent/tailor",
        {
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

      const response = (await POST(request, {
        params: Promise.resolve({ id: "nonexistent" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(404);
      expect(body.error.code).toBe("not_found");
    });

    it("returns 403 when billing limit is reached", async () => {
      mockCheckTailoredProfileLimit.mockResolvedValue({
        allowed: false,
        reason: "Monthly limit reached",
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: mockOpportunity, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "tailored_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } =
        await import("@/app/api/v1/opportunities/[id]/tailor/route");
      const request = createMockRequest(
        "/api/v1/opportunities/opp-123/tailor",
        {
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

      const response = (await POST(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(403);
      expect(body.error.code).toBe("limit_reached");
      expect(body.error.message).toBe("Monthly limit reached");
    });

    it("returns 500 when job creation fails", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: mockOpportunity, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "tailored_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "document_jobs") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({
                    data: null,
                    error: { message: "DB error" },
                  }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } =
        await import("@/app/api/v1/opportunities/[id]/tailor/route");
      const request = createMockRequest(
        "/api/v1/opportunities/opp-123/tailor",
        {
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

      const response = (await POST(request, {
        params: Promise.resolve({ id: "opp-123" }),
      })) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(500);
      expect(body.error.code).toBe("server_error");
    });

    it("includes opportunity info in cached response", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: mockOpportunity, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "tailored_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({
                      data: mockCachedProfile,
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } =
        await import("@/app/api/v1/opportunities/[id]/tailor/route");
      const request = createMockRequest(
        "/api/v1/opportunities/opp-123/tailor",
        {
          headers: { Authorization: "Bearer idn_test123" },
        },
      );

      const response = (await POST(request, {
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
  });
});
