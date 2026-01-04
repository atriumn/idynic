import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockSupabaseFrom = vi.fn();
const mockGetUser = vi.fn();

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: mockSupabaseFrom,
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

function createMockRequest(
  url: string,
  options: { method?: string; body?: unknown } = {},
): NextRequest {
  const { method = "GET", body } = options;
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function parseJson<T>(response: Response): Promise<T> {
  return JSON.parse(await response.text()) as T;
}

describe("Opportunity Notes API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
  });

  describe("GET /api/opportunity-notes", () => {
    it("returns existing notes for an opportunity", async () => {
      const mockNotes = {
        id: "note-1",
        opportunity_id: "opp-123",
        rating_tech_stack: 4,
        rating_company: 5,
        rating_industry: 3,
        rating_role_fit: 4,
        links: [
          {
            url: "https://linkedin.com/jobs/123",
            label: "Original posting",
            type: "linkedin",
          },
        ],
        notes: "Great opportunity!",
      };

      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: mockNotes, error: null }),
            }),
          }),
        }),
      }));

      const { GET } = await import("@/app/api/opportunity-notes/route");
      const request = createMockRequest(
        "/api/opportunity-notes?opportunityId=opp-123",
      );
      const response = await GET(request);
      const body = await parseJson<typeof mockNotes>(response);

      expect(response.status).toBe(200);
      expect(body.rating_tech_stack).toBe(4);
      expect(body.notes).toBe("Great opportunity!");
    });

    it("returns empty defaults when no notes exist", async () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
            }),
          }),
        }),
      }));

      const { GET } = await import("@/app/api/opportunity-notes/route");
      const request = createMockRequest(
        "/api/opportunity-notes?opportunityId=opp-123",
      );
      const response = await GET(request);
      const body = await parseJson<{ rating_tech_stack: null }>(response);

      expect(response.status).toBe(200);
      expect(body.rating_tech_stack).toBeNull();
    });

    it("returns 400 when opportunityId is missing", async () => {
      const { GET } = await import("@/app/api/opportunity-notes/route");
      const request = createMockRequest("/api/opportunity-notes");
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("returns 401 when not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const { GET } = await import("@/app/api/opportunity-notes/route");
      const request = createMockRequest(
        "/api/opportunity-notes?opportunityId=opp-123",
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /api/opportunity-notes", () => {
    it("upserts notes for an opportunity", async () => {
      const mockUpsertedNotes = {
        id: "note-1",
        opportunity_id: "opp-123",
        rating_tech_stack: 5,
        links: [],
        notes: "Updated notes",
      };

      mockSupabaseFrom.mockImplementation(() => ({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: mockUpsertedNotes, error: null }),
          }),
        }),
      }));

      const { PUT } = await import("@/app/api/opportunity-notes/route");
      const request = createMockRequest("/api/opportunity-notes", {
        method: "PUT",
        body: {
          opportunityId: "opp-123",
          rating_tech_stack: 5,
          notes: "Updated notes",
        },
      });
      const response = await PUT(request);
      const body = await parseJson<typeof mockUpsertedNotes>(response);

      expect(response.status).toBe(200);
      expect(body.rating_tech_stack).toBe(5);
    });

    it("returns 400 when opportunityId is missing", async () => {
      const { PUT } = await import("@/app/api/opportunity-notes/route");
      const request = createMockRequest("/api/opportunity-notes", {
        method: "PUT",
        body: { rating_tech_stack: 5 },
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it("returns 401 when not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const { PUT } = await import("@/app/api/opportunity-notes/route");
      const request = createMockRequest("/api/opportunity-notes", {
        method: "PUT",
        body: { opportunityId: "opp-123", rating_tech_stack: 5 },
      });
      const response = await PUT(request);

      expect(response.status).toBe(401);
    });
  });
});
