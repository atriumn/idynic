import { describe, it, expect, beforeEach, vi } from "vitest";
import JSZip from "jszip";

// Create mocks
const mockSupabaseFrom = vi.fn();
const mockSupabaseAuth = vi.fn();
const mockSupabaseStorage = vi.fn();

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      from: mockSupabaseFrom,
      auth: {
        getUser: mockSupabaseAuth,
      },
      storage: {
        from: mockSupabaseStorage,
      },
    }),
  ),
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

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

const mockProfile = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  phone: "+1-555-1234",
  location: "San Francisco",
  linkedin: "https://linkedin.com/in/test",
  github: "https://github.com/test",
  website: "https://test.com",
  identity_headline: "Software Engineer",
  identity_bio: "I build things",
  identity_archetype: "Builder",
  identity_keywords: ["typescript", "react"],
  created_at: "2025-01-01T00:00:00Z",
};

const mockDocuments = [
  {
    id: "doc-1",
    type: "resume",
    filename: "resume.pdf",
    storage_path: "user-123/resume.pdf",
    raw_text: "Resume content here",
    created_at: "2025-01-01T00:00:00Z",
  },
];

const mockWorkHistory = [
  {
    id: "wh-1",
    company: "Tech Corp",
    title: "Engineer",
    start_date: "2020-01-01",
    end_date: null,
    location: "Remote",
    summary: "Did things",
    entry_type: "work",
    created_at: "2025-01-01T00:00:00Z",
  },
];

describe("Account Export API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/account/export", () => {
    it("returns 401 when not authenticated", async () => {
      mockSupabaseAuth.mockResolvedValue({ data: { user: null } });

      const { POST } = await import("@/app/api/v1/account/export/route");

      const response = await POST();

      expect(response.status).toBe(401);
      const data = await parseJsonResponse(response);
      expect(data).toMatchObject({
        error: { code: "unauthorized" },
      });
    });

    it("returns ZIP file on successful export", async () => {
      mockSupabaseAuth.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });

      // Mock database queries
      mockSupabaseFrom.mockImplementation((table: string) => {
        const mockChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        if (table === "profiles") {
          mockChain.single = vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          });
        } else if (table === "documents") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockDocuments,
                error: null,
              }),
            }),
          };
        } else if (table === "work_history") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockWorkHistory,
                error: null,
              }),
            }),
          };
        } else if (table === "shared_link_views") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        } else {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: null }),
                  }),
                }),
                single: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          };
        }

        return mockChain;
      });

      // Mock storage
      mockSupabaseStorage.mockReturnValue({
        download: vi.fn().mockResolvedValue({
          data: new Blob(["PDF content"], { type: "application/pdf" }),
          error: null,
        }),
      });

      const { POST } = await import("@/app/api/v1/account/export/route");

      const response = await POST();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/zip");
      expect(response.headers.get("Content-Disposition")).toMatch(
        /attachment; filename="idynic-export-\d{4}-\d{2}-\d{2}\.zip"/,
      );

      // Verify ZIP contents
      const arrayBuffer = await response.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      expect(zip.file("data.json")).toBeTruthy();
      expect(zip.file("README.txt")).toBeTruthy();
    });

    it("includes profile data in export", async () => {
      mockSupabaseAuth.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        };
      });

      mockSupabaseStorage.mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: null }),
      });

      const { POST } = await import("@/app/api/v1/account/export/route");

      const response = await POST();
      const arrayBuffer = await response.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const dataJson = await zip.file("data.json")?.async("string");
      expect(dataJson).toBeTruthy();

      const data = JSON.parse(dataJson!);
      expect(data.profile).toMatchObject({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        identity: {
          headline: "Software Engineer",
          bio: "I build things",
          archetype: "Builder",
        },
      });
    });

    it("exports with empty data for new user", async () => {
      mockSupabaseAuth.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });

      // All queries return empty data
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      });

      mockSupabaseStorage.mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: null }),
      });

      const { POST } = await import("@/app/api/v1/account/export/route");

      const response = await POST();

      expect(response.status).toBe(200);

      const arrayBuffer = await response.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const dataJson = await zip.file("data.json")?.async("string");
      const data = JSON.parse(dataJson!);

      expect(data.version).toBe("1.0");
      expect(data.profile).toBeNull();
      expect(data.documents).toEqual([]);
      expect(data.workHistory).toEqual([]);
    });

    it("includes README.txt with user email", async () => {
      mockSupabaseAuth.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        };
      });

      mockSupabaseStorage.mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: null }),
      });

      const { POST } = await import("@/app/api/v1/account/export/route");

      const response = await POST();
      const arrayBuffer = await response.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const readme = await zip.file("README.txt")?.async("string");
      expect(readme).toContain("Idynic Data Export");
      expect(readme).toContain("test@example.com");
      expect(readme).toContain("https://idynic.com/settings/account");
    });

    it("handles storage download errors gracefully", async () => {
      mockSupabaseAuth.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "documents") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockDocuments,
                error: null,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        };
      });

      // Storage download fails
      mockSupabaseStorage.mockReturnValue({
        download: vi.fn().mockRejectedValue(new Error("Storage error")),
      });

      const { POST } = await import("@/app/api/v1/account/export/route");

      // Should still succeed with documents in JSON but without files
      const response = await POST();

      expect(response.status).toBe(200);
    });
  });
});
