import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Create mocks
const mockSupabaseFrom = vi.fn();
const mockSupabaseAuth = vi.fn();
const mockSupabaseStorage = vi.fn();
const mockServiceFrom = vi.fn();
const mockServiceAuth = vi.fn();
const mockServiceStorage = vi.fn();
const mockStripeSubscriptionsCancel = vi.fn();

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      from: mockSupabaseFrom,
      auth: {
        getUser: mockSupabaseAuth,
        signInWithPassword: vi.fn(),
      },
      storage: {
        from: mockSupabaseStorage,
      },
    }),
  ),
}));

// Mock Supabase service role client
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn().mockImplementation(() => ({
    from: mockServiceFrom,
    auth: {
      admin: {
        deleteUser: mockServiceAuth,
      },
    },
    storage: {
      from: mockServiceStorage,
    },
  })),
}));

// Mock Stripe
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: vi.fn().mockImplementation(() => ({
    subscriptions: {
      cancel: mockStripeSubscriptionsCancel,
    },
  })),
}));

// Mock response helpers
vi.mock("@/lib/api/response", () => ({
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
  const { method = "DELETE", headers = {}, body } = options;

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

describe("Account API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DELETE /api/v1/account", () => {
    it("returns 401 when not authenticated", async () => {
      mockSupabaseAuth.mockResolvedValue({ data: { user: null } });

      const { DELETE } = await import("@/app/api/v1/account/route");
      const request = createMockRequest(
        "http://localhost:3000/api/v1/account",
        {
          body: { password: "password123", confirmation: "DELETE MY ACCOUNT" },
        },
      );

      const response = await DELETE(request);

      expect(response.status).toBe(401);
      const data = await parseJsonResponse(response);
      expect(data).toMatchObject({
        error: { code: "unauthorized" },
      });
    });

    it("returns 400 when confirmation text is incorrect", async () => {
      mockSupabaseAuth.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });

      const { DELETE } = await import("@/app/api/v1/account/route");
      const request = createMockRequest(
        "http://localhost:3000/api/v1/account",
        {
          body: { password: "password123", confirmation: "wrong text" },
        },
      );

      const response = await DELETE(request);

      expect(response.status).toBe(400);
      const data = await parseJsonResponse(response);
      expect(data).toMatchObject({
        error: { code: "invalid_confirmation" },
      });
    });

    it("returns 400 when password is missing", async () => {
      mockSupabaseAuth.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });

      const { DELETE } = await import("@/app/api/v1/account/route");
      const request = createMockRequest(
        "http://localhost:3000/api/v1/account",
        {
          body: { confirmation: "DELETE MY ACCOUNT" },
        },
      );

      const response = await DELETE(request);

      expect(response.status).toBe(400);
      const data = await parseJsonResponse(response);
      expect(data).toMatchObject({
        error: { code: "invalid_password" },
      });
    });

    it("returns 403 when password verification fails", async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        error: { message: "Invalid credentials" },
      });

      vi.doMock("@/lib/supabase/server", () => ({
        createClient: vi.fn().mockImplementation(() =>
          Promise.resolve({
            from: mockSupabaseFrom,
            auth: {
              getUser: () =>
                Promise.resolve({
                  data: { user: { id: "user-123", email: "test@example.com" } },
                }),
              signInWithPassword: mockSignIn,
            },
          }),
        ),
      }));

      // Re-import to get fresh module with new mock
      vi.resetModules();
      const { DELETE } = await import("@/app/api/v1/account/route");

      const request = createMockRequest(
        "http://localhost:3000/api/v1/account",
        {
          body: {
            password: "wrongpassword",
            confirmation: "DELETE MY ACCOUNT",
          },
        },
      );

      const response = await DELETE(request);

      expect(response.status).toBe(403);
      const data = await parseJsonResponse(response);
      expect(data).toMatchObject({
        error: { code: "invalid_password" },
      });
    });

    it("returns 204 on successful account deletion", async () => {
      const mockSignIn = vi.fn().mockResolvedValue({ error: null });

      vi.doMock("@/lib/supabase/server", () => ({
        createClient: vi.fn().mockImplementation(() =>
          Promise.resolve({
            from: mockSupabaseFrom,
            auth: {
              getUser: () =>
                Promise.resolve({
                  data: { user: { id: "user-123", email: "test@example.com" } },
                }),
              signInWithPassword: mockSignIn,
            },
          }),
        ),
      }));

      // Mock service client responses
      mockServiceFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      mockServiceStorage.mockReturnValue({
        list: vi.fn().mockResolvedValue({ data: [] }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      });

      mockServiceAuth.mockResolvedValue({ error: null });

      vi.resetModules();
      const { DELETE } = await import("@/app/api/v1/account/route");

      const request = createMockRequest(
        "http://localhost:3000/api/v1/account",
        {
          body: {
            password: "correctpassword",
            confirmation: "DELETE MY ACCOUNT",
          },
        },
      );

      const response = await DELETE(request);

      expect(response.status).toBe(204);
    });

    it("cancels Stripe subscription if exists", async () => {
      const mockSignIn = vi.fn().mockResolvedValue({ error: null });

      vi.doMock("@/lib/supabase/server", () => ({
        createClient: vi.fn().mockImplementation(() =>
          Promise.resolve({
            from: mockSupabaseFrom,
            auth: {
              getUser: () =>
                Promise.resolve({
                  data: { user: { id: "user-123", email: "test@example.com" } },
                }),
              signInWithPassword: mockSignIn,
            },
          }),
        ),
      }));

      // Mock subscription with Stripe ID
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { stripe_subscription_id: "sub_123" },
          }),
        }),
      });

      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockServiceFrom.mockReturnValue({
        select: selectMock,
        delete: deleteMock,
      });

      mockServiceStorage.mockReturnValue({
        list: vi.fn().mockResolvedValue({ data: [] }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      });

      mockServiceAuth.mockResolvedValue({ error: null });
      mockStripeSubscriptionsCancel.mockResolvedValue({});

      vi.resetModules();
      const { DELETE } = await import("@/app/api/v1/account/route");

      const request = createMockRequest(
        "http://localhost:3000/api/v1/account",
        {
          body: {
            password: "correctpassword",
            confirmation: "DELETE MY ACCOUNT",
          },
        },
      );

      await DELETE(request);

      expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith("sub_123");
    });

    it("deletes storage files", async () => {
      const mockSignIn = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });

      vi.doMock("@/lib/supabase/server", () => ({
        createClient: vi.fn().mockImplementation(() =>
          Promise.resolve({
            from: mockSupabaseFrom,
            auth: {
              getUser: () =>
                Promise.resolve({
                  data: { user: { id: "user-123", email: "test@example.com" } },
                }),
              signInWithPassword: mockSignIn,
            },
          }),
        ),
      }));

      mockServiceFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      mockServiceStorage.mockReturnValue({
        list: vi.fn().mockResolvedValue({
          data: [{ name: "resume.pdf" }, { name: "doc.pdf" }],
        }),
        remove: mockRemove,
      });

      mockServiceAuth.mockResolvedValue({ error: null });

      vi.resetModules();
      const { DELETE } = await import("@/app/api/v1/account/route");

      const request = createMockRequest(
        "http://localhost:3000/api/v1/account",
        {
          body: {
            password: "correctpassword",
            confirmation: "DELETE MY ACCOUNT",
          },
        },
      );

      await DELETE(request);

      expect(mockRemove).toHaveBeenCalledWith([
        "user-123/resume.pdf",
        "user-123/doc.pdf",
      ]);
    });

    it("returns 400 for invalid JSON body", async () => {
      mockSupabaseAuth.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });

      const { DELETE } = await import("@/app/api/v1/account/route");

      const request = new NextRequest(
        new URL("http://localhost:3000/api/v1/account"),
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: "not valid json",
        },
      );

      const response = await DELETE(request);

      expect(response.status).toBe(400);
      const data = await parseJsonResponse(response);
      expect(data).toMatchObject({
        error: { code: "invalid_request" },
      });
    });
  });
});
