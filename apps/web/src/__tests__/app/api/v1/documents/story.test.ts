import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

// Create mocks
const mockSupabaseFrom = vi.fn();
const mockValidateApiKey = vi.fn();
const mockInngestSend = vi.fn();

// Mock Supabase
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn().mockImplementation(() => ({
    from: mockSupabaseFrom,
  })),
}));

// Mock auth
vi.mock("@/lib/api/auth", () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  isAuthError: (result: unknown) => result instanceof Response,
}));

// Mock Inngest
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
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

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

describe("Story Upload API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({ userId: "user-123" });
    mockInngestSend.mockResolvedValue(undefined);

    // Default Supabase mocks
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "document_jobs") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "job-123" },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
  });

  describe("POST /api/v1/documents/story", () => {
    it("returns 401 when API key is missing", async () => {
      const authError = new Response(
        JSON.stringify({
          success: false,
          error: { code: "unauthorized", message: "Missing API key" },
        }),
        { status: 401 },
      );

      mockValidateApiKey.mockResolvedValue(authError);

      const { POST } = await import("@/app/api/v1/documents/story/route");

      const request = createMockRequest("/api/v1/documents/story", {
        headers: { Authorization: "Bearer invalid" },
        body: { text: "A".repeat(300) },
      });

      const response = (await POST(request)) as NextResponse;

      expect(response.status).toBe(401);
    });

    it("returns job_id on successful upload", async () => {
      const { POST } = await import("@/app/api/v1/documents/story/route");

      const request = createMockRequest("/api/v1/documents/story", {
        headers: { Authorization: "Bearer idn_test123" },
        body: { text: "A".repeat(300) },
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: { job_id: string; status: string; message: string };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.job_id).toBe("job-123");
      expect(body.data.status).toBe("processing");
    });

    it("triggers Inngest on successful upload", async () => {
      const { POST } = await import("@/app/api/v1/documents/story/route");

      const storyText = "A".repeat(300);
      const request = createMockRequest("/api/v1/documents/story", {
        headers: { Authorization: "Bearer idn_test123" },
        body: { text: storyText },
      });

      await POST(request);

      expect(mockInngestSend).toHaveBeenCalledWith({
        name: "story/process",
        data: expect.objectContaining({
          jobId: "job-123",
          userId: "user-123",
          text: storyText,
        }),
      });
    });

    it("returns 400 when story text is missing", async () => {
      const { POST } = await import("@/app/api/v1/documents/story/route");

      const request = createMockRequest("/api/v1/documents/story", {
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
      expect(body.error.message).toBe("No story text provided");
    });

    it("returns 400 when story is too short (< 200 chars)", async () => {
      const { POST } = await import("@/app/api/v1/documents/story/route");

      const request = createMockRequest("/api/v1/documents/story", {
        headers: { Authorization: "Bearer idn_test123" },
        body: { text: "Too short" },
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toBe("Story must be at least 200 characters");
    });

    it("returns 400 when story is too long (> 10000 chars)", async () => {
      const { POST } = await import("@/app/api/v1/documents/story/route");

      const request = createMockRequest("/api/v1/documents/story", {
        headers: { Authorization: "Bearer idn_test123" },
        body: { text: "A".repeat(10001) },
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toBe(
        "Story must be less than 10,000 characters",
      );
    });

    it("returns 409 for duplicate stories", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "documents") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "existing-doc", created_at: "2024-01-01" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } = await import("@/app/api/v1/documents/story/route");

      const request = createMockRequest("/api/v1/documents/story", {
        headers: { Authorization: "Bearer idn_test123" },
        body: { text: "A".repeat(300) },
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(409);
      expect(body.error.code).toBe("duplicate");
      expect(body.error.message).toContain("Duplicate");
    });

    it("returns 400 when text is not a string", async () => {
      const { POST } = await import("@/app/api/v1/documents/story/route");

      const request = createMockRequest("/api/v1/documents/story", {
        headers: { Authorization: "Bearer idn_test123" },
        body: { text: 12345 }, // Number instead of string
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toBe("No story text provided");
    });

    it("returns 500 on job creation error", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "documents") {
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
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Insert failed" },
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } = await import("@/app/api/v1/documents/story/route");

      const request = createMockRequest("/api/v1/documents/story", {
        headers: { Authorization: "Bearer idn_test123" },
        body: { text: "A".repeat(300) },
      });

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(500);
      expect(body.error.code).toBe("server_error");
    });
  });
});
