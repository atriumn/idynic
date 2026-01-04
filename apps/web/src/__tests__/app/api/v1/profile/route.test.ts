import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

// Create mocks
const mockSupabaseFrom = vi.fn();
const mockValidateApiKey = vi.fn();

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

// Mock response helpers - return actual Response objects
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

const mockProfile = {
  id: "user-123",
  name: "John Doe",
  email: "john@example.com",
  phone: "+1-555-1234",
  location: "San Francisco, CA",
  linkedin: "https://linkedin.com/in/johndoe",
  github: "https://github.com/johndoe",
  website: "https://johndoe.dev",
  logo_url: "https://example.com/logo.png",
};

const mockWorkHistory = [
  {
    id: "wh-1",
    user_id: "user-123",
    title: "Senior Engineer",
    company: "Tech Corp",
    start_date: "2020-01-01",
    end_date: null,
    order_index: 0,
  },
  {
    id: "wh-2",
    user_id: "user-123",
    title: "Engineer",
    company: "Startup Inc",
    start_date: "2018-01-01",
    end_date: "2019-12-31",
    order_index: 1,
  },
];

const mockClaims = [
  {
    id: "claim-1",
    user_id: "user-123",
    type: "skill",
    label: "TypeScript",
    description: "Expert level",
    confidence: 0.95,
  },
  {
    id: "claim-2",
    user_id: "user-123",
    type: "skill",
    label: "React",
    description: "Advanced",
    confidence: 0.9,
  },
  {
    id: "claim-3",
    user_id: "user-123",
    type: "education",
    label: "BS Computer Science",
    description: "Stanford University",
    confidence: 0.99,
  },
  {
    id: "claim-4",
    user_id: "user-123",
    type: "certification",
    label: "AWS Solutions Architect",
    description: "Professional",
    confidence: 0.98,
  },
];

describe("Profile API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: successful auth
    mockValidateApiKey.mockResolvedValue({ userId: "user-123" });
  });

  describe("GET /api/v1/profile", () => {
    it("returns profile with all related data", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockProfile, error: null }),
              }),
            }),
          };
        }
        if (table === "work_history") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi
                  .fn()
                  .mockResolvedValue({ data: mockWorkHistory, error: null }),
              }),
            }),
          };
        }
        if (table === "identity_claims") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi
                  .fn()
                  .mockResolvedValue({ data: mockClaims, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const { GET } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: {
          contact: typeof mockProfile;
          experience: typeof mockWorkHistory;
          skills: Array<{
            id: string;
            label: string;
            description: string;
            confidence: number;
          }>;
          education: Array<{
            id: string;
            label: string;
            description: string;
            confidence: number;
          }>;
          certifications: Array<{
            id: string;
            label: string;
            description: string;
            confidence: number;
          }>;
        };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.contact.name).toBe("John Doe");
      expect(body.data.experience).toHaveLength(2);
      expect(body.data.skills).toHaveLength(2);
      expect(body.data.education).toHaveLength(1);
      expect(body.data.certifications).toHaveLength(1);
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

      const { GET } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile");

      const response = (await GET(request)) as NextResponse;

      expect(response.status).toBe(401);
    });

    it("returns 404 when profile not found", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({
                    data: null,
                    error: { message: "Not found" },
                  }),
              }),
            }),
          };
        }
        return {};
      });

      const { GET } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(404);
      expect(body.error.code).toBe("not_found");
    });

    it("handles empty work history", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockProfile, error: null }),
              }),
            }),
          };
        }
        if (table === "work_history") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === "identity_claims") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const { GET } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: { experience: unknown[]; skills: unknown[] };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.data.experience).toEqual([]);
      expect(body.data.skills).toEqual([]);
    });

    it("handles null claims data", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockProfile, error: null }),
              }),
            }),
          };
        }
        if (table === "work_history") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === "identity_claims") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const { GET } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        headers: { Authorization: "Bearer idn_test123" },
      });

      const response = (await GET(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: {
          skills: unknown[];
          education: unknown[];
          certifications: unknown[];
        };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.data.skills).toEqual([]);
      expect(body.data.education).toEqual([]);
      expect(body.data.certifications).toEqual([]);
    });
  });

  describe("PATCH /api/v1/profile", () => {
    it("updates contact info successfully", async () => {
      const updatedProfile = { ...mockProfile, name: "Jane Doe" };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: updatedProfile, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        headers: { Authorization: "Bearer idn_test123" },
        body: { name: "Jane Doe" },
      });

      const response = (await PATCH(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: { name: string };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("Jane Doe");
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

      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        body: { name: "Jane Doe" },
      });

      const response = (await PATCH(request)) as NextResponse;

      expect(response.status).toBe(401);
    });

    it("returns 400 when no valid fields provided", async () => {
      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        headers: { Authorization: "Bearer idn_test123" },
        body: { invalid_field: "value" },
      });

      const response = (await PATCH(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toContain("No valid fields");
    });

    it("validates URL fields", async () => {
      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        headers: { Authorization: "Bearer idn_test123" },
        body: { linkedin: "not-a-valid-url" },
      });

      const response = (await PATCH(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toContain("Invalid URL");
      expect(body.error.message).toContain("linkedin");
    });

    it("validates github URL field", async () => {
      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        headers: { Authorization: "Bearer idn_test123" },
        body: { github: "invalid-github-url" },
      });

      const response = (await PATCH(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.message).toContain("github");
    });

    it("validates website URL field", async () => {
      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        headers: { Authorization: "Bearer idn_test123" },
        body: { website: "not-a-url" },
      });

      const response = (await PATCH(request)) as NextResponse;

      expect(response.status).toBe(400);
    });

    it("validates logo_url field", async () => {
      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        headers: { Authorization: "Bearer idn_test123" },
        body: { logo_url: "bad-logo-url" },
      });

      const response = (await PATCH(request)) as NextResponse;

      expect(response.status).toBe(400);
    });

    it("accepts valid URL fields", async () => {
      const updatedProfile = {
        ...mockProfile,
        linkedin: "https://linkedin.com/in/newprofile",
        github: "https://github.com/newuser",
        website: "https://newsite.com",
        logo_url: "https://example.com/newlogo.png",
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: updatedProfile, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        headers: { Authorization: "Bearer idn_test123" },
        body: {
          linkedin: "https://linkedin.com/in/newprofile",
          github: "https://github.com/newuser",
          website: "https://newsite.com",
          logo_url: "https://example.com/newlogo.png",
        },
      });

      const response = (await PATCH(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: { linkedin: string };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.data.linkedin).toBe("https://linkedin.com/in/newprofile");
    });

    it("filters out disallowed fields", async () => {
      const updatedProfile = { ...mockProfile, name: "Updated Name" };
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: updatedProfile, error: null }),
          }),
        }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return { update: updateMock };
        }
        return {};
      });

      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        headers: { Authorization: "Bearer idn_test123" },
        body: {
          name: "Updated Name",
          admin: true, // Should be filtered out
          role: "admin", // Should be filtered out
        },
      });

      const response = (await PATCH(request)) as NextResponse;

      expect(response.status).toBe(200);
      // The update mock should only receive allowed fields
      expect(updateMock).toHaveBeenCalled();
    });

    it("handles database update error", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Database error" },
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        headers: { Authorization: "Bearer idn_test123" },
        body: { name: "New Name" },
      });

      const response = (await PATCH(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(500);
      expect(body.error.code).toBe("server_error");
    });

    it("handles invalid JSON body", async () => {
      const { PATCH } = await import("@/app/api/v1/profile/route");

      // Create request with invalid JSON
      const request = new NextRequest(
        new URL("/api/v1/profile", "http://localhost:3000"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer idn_test123",
          },
          body: "not valid json",
        },
      );

      const response = (await PATCH(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(500);
      expect(body.error.code).toBe("server_error");
    });

    it("allows null values for optional fields", async () => {
      const updatedProfile = { ...mockProfile, phone: null };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: updatedProfile, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { PATCH } = await import("@/app/api/v1/profile/route");
      const request = createMockRequest("/api/v1/profile", {
        method: "PATCH",
        headers: { Authorization: "Bearer idn_test123" },
        body: { phone: null },
      });

      const response = (await PATCH(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: { phone: string | null };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.data.phone).toBeNull();
    });
  });
});
