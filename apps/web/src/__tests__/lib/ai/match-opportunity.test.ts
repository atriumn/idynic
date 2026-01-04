import { describe, it, expect, beforeEach, vi } from "vitest";

// Create mocks
const mockEmbeddingsCreate = vi.fn();
const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();

// Mock OpenAI for embeddings
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      embeddings = {
        create: mockEmbeddingsCreate,
      };
    },
  };
});

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc,
  })),
}));

const mockOpportunityWithReqs = {
  requirements: {
    mustHave: [
      { text: "5+ years experience", type: "experience" },
      { text: "TypeScript expertise", type: "skill" },
    ],
    niceToHave: [{ text: "AWS certification", type: "certification" }],
  },
};

const mockSkillMatches = [
  {
    id: "claim-1",
    type: "skill",
    label: "TypeScript",
    description: "Expert in TypeScript",
    confidence: 0.9,
    similarity: 0.85,
  },
  {
    id: "claim-2",
    type: "achievement",
    label: "8 years experience",
    description: "Software development experience",
    confidence: 0.95,
    similarity: 0.75,
  },
];

const mockCertificationMatches = [
  {
    id: "claim-3",
    type: "certification",
    label: "AWS Certified",
    description: "AWS Solutions Architect",
    confidence: 0.95,
    similarity: 0.8,
  },
];

describe("match-opportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default embedding mock
    mockEmbeddingsCreate.mockResolvedValue({
      object: "list",
      data: [
        { embedding: new Array(1536).fill(0.1), index: 0 },
        { embedding: new Array(1536).fill(0.2), index: 1 },
        { embedding: new Array(1536).fill(0.3), index: 2 },
      ],
      model: "text-embedding-3-small",
      usage: { prompt_tokens: 30, total_tokens: 30 },
    });

    // Default Supabase mock for opportunity fetch
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockOpportunityWithReqs,
            error: null,
          }),
        }),
      }),
    });

    // Default RPC mock - returns appropriate matches for each call
    mockSupabaseRpc.mockResolvedValue({
      data: [...mockSkillMatches, ...mockCertificationMatches],
      error: null,
    });
  });

  describe("computeOpportunityMatches", () => {
    it("returns empty result when opportunity has no requirements", async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { requirements: null },
              error: null,
            }),
          }),
        }),
      });

      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      const result = await computeOpportunityMatches("opp-123", "user-456");

      expect(result.overallScore).toBe(0);
      expect(result.requirementMatches).toEqual([]);
      expect(result.gaps).toEqual([]);
    });

    it("returns empty result when requirements are empty", async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { requirements: { mustHave: [], niceToHave: [] } },
              error: null,
            }),
          }),
        }),
      });

      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      const result = await computeOpportunityMatches("opp-123", "user-456");

      expect(result.overallScore).toBe(0);
    });

    it("generates embeddings for all requirements", async () => {
      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      await computeOpportunityMatches("opp-123", "user-456");

      expect(mockEmbeddingsCreate).toHaveBeenCalled();
    });

    it("calls match_identity_claims RPC for each requirement", async () => {
      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      await computeOpportunityMatches("opp-123", "user-456");

      // 2 mustHave + 1 niceToHave = 3 requirements
      expect(mockSupabaseRpc).toHaveBeenCalledTimes(3);
      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        "match_identity_claims",
        expect.objectContaining({
          match_user_id: "user-456",
          match_threshold: 0.4,
          match_count: 10,
        }),
      );
    });

    it("calculates scores correctly with all matches", async () => {
      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      const result = await computeOpportunityMatches("opp-123", "user-456");

      // All requirements have matches
      expect(result.mustHaveScore).toBe(100);
      expect(result.niceToHaveScore).toBe(100);
      expect(result.overallScore).toBe(100);
    });

    it("calculates scores correctly with partial matches", async () => {
      // First requirement matches, second doesn't, third matches
      mockSupabaseRpc
        .mockResolvedValueOnce({ data: mockSkillMatches, error: null })
        .mockResolvedValueOnce({ data: [], error: null }) // No match for TypeScript
        .mockResolvedValueOnce({ data: mockCertificationMatches, error: null });

      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      const result = await computeOpportunityMatches("opp-123", "user-456");

      // 1/2 mustHave = 50%
      expect(result.mustHaveScore).toBe(50);
      // 1/1 niceToHave = 100%
      expect(result.niceToHaveScore).toBe(100);
      // Overall = 50 * 0.7 + 100 * 0.3 = 35 + 30 = 65
      expect(result.overallScore).toBe(65);
    });

    it("identifies gaps for requirements without matches", async () => {
      mockSupabaseRpc
        .mockResolvedValueOnce({ data: mockSkillMatches, error: null })
        .mockResolvedValueOnce({ data: [], error: null }) // Gap
        .mockResolvedValueOnce({ data: [], error: null }); // Gap

      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      const result = await computeOpportunityMatches("opp-123", "user-456");

      expect(result.gaps).toHaveLength(2);
      expect(result.gaps[0].text).toBe("TypeScript expertise");
    });

    it("identifies strengths for high-similarity matches", async () => {
      const highSimilarityMatch = [
        { ...mockSkillMatches[0], similarity: 0.85 },
        { ...mockCertificationMatches[0], similarity: 0.85 },
      ];
      mockSupabaseRpc.mockResolvedValue({
        data: highSimilarityMatch,
        error: null,
      });

      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      const result = await computeOpportunityMatches("opp-123", "user-456");

      // All 3 requirements have high similarity matches
      expect(result.strengths.length).toBeGreaterThan(0);
    });

    it("handles legacy string format requirements", async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                requirements: {
                  mustHave: ["5+ years experience", "TypeScript"],
                  niceToHave: ["AWS"],
                },
              },
              error: null,
            }),
          }),
        }),
      });

      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      const result = await computeOpportunityMatches("opp-123", "user-456");

      // Should still process legacy format
      expect(result.requirementMatches).toHaveLength(3);
    });

    it("filters matches by valid claim types", async () => {
      // Return matches of wrong type for education requirement
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                requirements: {
                  mustHave: [{ text: "BS in CS", type: "education" }],
                  niceToHave: [],
                },
              },
              error: null,
            }),
          }),
        }),
      });

      // Return skill-type matches which shouldn't match education
      mockSupabaseRpc.mockResolvedValue({
        data: [{ ...mockSkillMatches[0], type: "skill" }],
        error: null,
      });

      mockEmbeddingsCreate.mockResolvedValue({
        object: "list",
        data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
        model: "text-embedding-3-small",
        usage: { prompt_tokens: 10, total_tokens: 10 },
      });

      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      const result = await computeOpportunityMatches("opp-123", "user-456");

      // Education requirement shouldn't match skill claims
      expect(result.requirementMatches[0].matches).toHaveLength(0);
    });

    it("handles RPC errors gracefully", async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: "RPC error" },
      });

      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");

      // Should not throw, just log error and continue
      const result = await computeOpportunityMatches("opp-123", "user-456");

      expect(result.requirementMatches).toHaveLength(3);
      expect(result.requirementMatches[0].matches).toHaveLength(0);
    });

    it("limits matches to top 3 per requirement", async () => {
      const manyMatches = Array(10)
        .fill(null)
        .map((_, i) => ({
          ...mockSkillMatches[0],
          id: `claim-${i}`,
          similarity: 0.9 - i * 0.05,
        }));

      mockSupabaseRpc.mockResolvedValue({
        data: manyMatches,
        error: null,
      });

      const { computeOpportunityMatches } =
        await import("@/lib/ai/match-opportunity");
      const result = await computeOpportunityMatches("opp-123", "user-456");

      result.requirementMatches.forEach((rm) => {
        expect(rm.matches.length).toBeLessThanOrEqual(3);
      });
    });
  });
});
