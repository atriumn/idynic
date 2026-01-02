import { describe, it, expect, beforeEach, vi } from "vitest";

// Use vi.hoisted to ensure mocks are available before vi.mock runs
const { mockOpenAICreate } = vi.hoisted(() => ({
  mockOpenAICreate: vi.fn(),
}));

// Create other mocks
const mockSupabaseFrom = vi.fn();
const mockGenerateEmbedding = vi.fn();
const mockFetchLinkedInJob = vi.fn();
const mockIsLinkedInJobUrl = vi.fn();
const mockFetchJobPageContent = vi.fn();
const mockLooksLikeJobUrl = vi.fn();

// Mock OpenAI
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockOpenAICreate,
        },
      };
    },
  };
});

// Mock embeddings
vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
}));

// Mock LinkedIn integration
vi.mock("@/lib/integrations/brightdata", () => ({
  fetchLinkedInJob: (...args: unknown[]) => mockFetchLinkedInJob(...args),
  isLinkedInJobUrl: (...args: unknown[]) => mockIsLinkedInJobUrl(...args),
}));

// Mock generic scraping
vi.mock("@/lib/integrations/scraping", () => ({
  fetchJobPageContent: (...args: unknown[]) => mockFetchJobPageContent(...args),
  looksLikeJobUrl: (...args: unknown[]) => mockLooksLikeJobUrl(...args),
}));

// Import after mocks
import { createOpportunity } from "@/lib/opportunities/create-opportunity";

function createMockSupabase() {
  return {
    from: mockSupabaseFrom,
  };
}

describe("createOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockIsLinkedInJobUrl.mockReturnValue(false);
    mockLooksLikeJobUrl.mockReturnValue(false);

    // Default OpenAI response
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Software Engineer",
              company: "Tech Corp",
              description: "Build great software",
              mustHave: [{ text: "3+ years experience", type: "experience" }],
              niceToHave: [
                { text: "AWS certification", type: "certification" },
              ],
              responsibilities: ["Write code", "Review PRs"],
            }),
          },
        },
      ],
    });

    // Default Supabase mock
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "opportunities") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "opp-123",
                  title: "Software Engineer",
                  company: "Tech Corp",
                  status: "tracking",
                  source: "manual",
                  created_at: "2024-01-01T00:00:00Z",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
  });

  describe("validation", () => {
    it("returns validation error when no description or URL provided", async () => {
      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("validation_error");
        expect(result.error.message).toContain("description is required");
      }
    });

    it("succeeds with only description", async () => {
      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        description: "Looking for a software engineer...",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.opportunity.id).toBe("opp-123");
      }
    });
  });

  describe("duplicate detection", () => {
    it("returns duplicate error when URL already exists", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "opportunities") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "existing-123",
                      title: "Existing Job",
                      company: "Existing Corp",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        url: "https://example.com/job/123",
        description: "Job description",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("duplicate");
        expect(result.error.existing?.id).toBe("existing-123");
      }
    });
  });

  describe("LinkedIn enrichment", () => {
    it("enriches from LinkedIn when URL is LinkedIn job", async () => {
      mockIsLinkedInJobUrl.mockReturnValue(true);
      mockFetchLinkedInJob.mockResolvedValue({
        job_title: "Senior Engineer",
        company_name: "LinkedIn Corp",
        job_summary: "Great opportunity at LinkedIn",
        job_location: "San Francisco",
        job_seniority_level: "Senior",
      });

      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        url: "https://linkedin.com/jobs/view/123",
      });

      expect(result.success).toBe(true);
      expect(mockFetchLinkedInJob).toHaveBeenCalledWith(
        "https://linkedin.com/jobs/view/123",
      );
    });

    it("returns scraping_failed when LinkedIn enrichment fails", async () => {
      mockIsLinkedInJobUrl.mockReturnValue(true);
      mockFetchLinkedInJob.mockRejectedValue(new Error("LinkedIn API error"));

      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        url: "https://linkedin.com/jobs/view/123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("scraping_failed");
      }
    });
  });

  describe("generic scraping", () => {
    it("scrapes job URL when not LinkedIn and no description", async () => {
      mockLooksLikeJobUrl.mockReturnValue(true);
      mockFetchJobPageContent.mockResolvedValue("Scraped job description here");

      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        url: "https://careers.example.com/job/123",
      });

      expect(result.success).toBe(true);
      expect(mockFetchJobPageContent).toHaveBeenCalledWith(
        "https://careers.example.com/job/123",
      );
    });

    it("returns scraping_failed when generic scraping returns null", async () => {
      mockLooksLikeJobUrl.mockReturnValue(true);
      mockFetchJobPageContent.mockResolvedValue(null);

      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        url: "https://careers.example.com/job/123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("scraping_failed");
      }
    });
  });

  describe("GPT extraction", () => {
    it("extracts requirements from description using GPT", async () => {
      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        description: "We are looking for a software engineer...",
      });

      expect(result.success).toBe(true);
      expect(mockOpenAICreate).toHaveBeenCalled();
      if (result.success) {
        expect(result.data.requirements.mustHave.length).toBeGreaterThan(0);
      }
    });

    it("handles GPT returning malformed JSON gracefully", async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "not valid json",
            },
          },
        ],
      });

      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        description: "Job description here",
      });

      // Should still succeed with defaults
      expect(result.success).toBe(true);
    });

    it("handles GPT returning null content", async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        description: "Job description here",
      });

      expect(result.success).toBe(true);
    });

    it("cleans markdown code blocks from GPT response", async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '```json\n{"title": "Engineer", "company": "Corp", "mustHave": [], "niceToHave": [], "responsibilities": []}\n```',
            },
          },
        ],
      });

      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        description: "Job description",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("embedding generation", () => {
    it("generates embedding for the opportunity", async () => {
      const supabase = createMockSupabase();

      await createOpportunity(supabase as never, {
        userId: "user-123",
        description: "Job description",
      });

      expect(mockGenerateEmbedding).toHaveBeenCalled();
    });
  });

  describe("database insert", () => {
    it("returns server_error when database insert fails", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "opportunities") {
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

      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        description: "Job description",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("server_error");
      }
    });

    it("returns success with opportunity data on successful insert", async () => {
      const supabase = createMockSupabase();

      const result = await createOpportunity(supabase as never, {
        userId: "user-123",
        description: "Job description",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.opportunity).toEqual({
          id: "opp-123",
          title: "Software Engineer",
          company: "Tech Corp",
          status: "tracking",
          source: "manual",
          created_at: "2024-01-01T00:00:00Z",
        });
        expect(result.data.requirements).toBeDefined();
        expect(result.data.enrichedDescription).toBeDefined();
      }
    });
  });
});
