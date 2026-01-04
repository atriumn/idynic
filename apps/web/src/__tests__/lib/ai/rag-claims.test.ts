import { describe, it, expect, vi, beforeEach } from "vitest";
import { findRelevantClaimsForBatch } from "@/lib/ai/rag-claims";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Mock Supabase
const mockRpc = vi.fn();
const mockSupabase = {
  rpc: mockRpc,
} as unknown as SupabaseClient<Database>;

describe("findRelevantClaimsForBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array when no evidence provided", async () => {
    const result = await findRelevantClaimsForBatch(
      mockSupabase,
      "user-123",
      [],
    );
    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("should call RPC for each evidence embedding and deduplicate results", async () => {
    const evidence = [
      { id: "ev1", embedding: [0.1, 0.2, 0.3] },
      { id: "ev2", embedding: [0.4, 0.5, 0.6] },
    ];

    // Same claim returned for both - should deduplicate
    mockRpc.mockResolvedValue({
      data: [
        {
          id: "claim-1",
          type: "skill",
          label: "React",
          description: null,
          confidence: 0.8,
          similarity: 0.7,
        },
      ],
      error: null,
    });

    const result = await findRelevantClaimsForBatch(
      mockSupabase,
      "user-123",
      evidence,
    );

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith("find_relevant_claims_for_synthesis", {
      query_embedding: [0.1, 0.2, 0.3],
      p_user_id: "user-123",
      similarity_threshold: 0.5,
      max_claims: 25,
    });

    // Should deduplicate to 1 claim
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("React");
  });

  it("should merge unique claims from multiple evidence queries", async () => {
    const evidence = [
      { id: "ev1", embedding: [0.1, 0.2, 0.3] },
      { id: "ev2", embedding: [0.4, 0.5, 0.6] },
    ];

    mockRpc
      .mockResolvedValueOnce({
        data: [
          {
            id: "claim-1",
            type: "skill",
            label: "React",
            description: null,
            confidence: 0.8,
            similarity: 0.7,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "claim-2",
            type: "skill",
            label: "TypeScript",
            description: null,
            confidence: 0.7,
            similarity: 0.6,
          },
        ],
        error: null,
      });

    const result = await findRelevantClaimsForBatch(
      mockSupabase,
      "user-123",
      evidence,
    );

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.label).sort()).toEqual(["React", "TypeScript"]);
  });

  it("should handle RPC errors gracefully", async () => {
    const evidence = [{ id: "ev1", embedding: [0.1, 0.2, 0.3] }];

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    const result = await findRelevantClaimsForBatch(
      mockSupabase,
      "user-123",
      evidence,
    );

    // Should return empty on error, not throw
    expect(result).toEqual([]);
  });

  it("should use custom threshold and max when provided", async () => {
    const evidence = [{ id: "ev1", embedding: [0.1, 0.2, 0.3] }];

    mockRpc.mockResolvedValue({ data: [], error: null });

    await findRelevantClaimsForBatch(mockSupabase, "user-123", evidence, {
      similarityThreshold: 0.7,
      maxClaimsPerQuery: 10,
    });

    expect(mockRpc).toHaveBeenCalledWith("find_relevant_claims_for_synthesis", {
      query_embedding: [0.1, 0.2, 0.3],
      p_user_id: "user-123",
      similarity_threshold: 0.7,
      max_claims: 10,
    });
  });
});
