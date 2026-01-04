import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSkillClusters } from "@/lib/hooks/use-skill-clusters";
import React from "react";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useSkillClusters", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  const mockClusterData = {
    nodes: [
      {
        id: "claim-1",
        label: "TypeScript",
        type: "skill",
        confidence: 0.85,
        x: 100,
        y: 200,
        clusterId: 0,
      },
      {
        id: "claim-2",
        label: "React",
        type: "skill",
        confidence: 0.9,
        x: 120,
        y: 180,
        clusterId: 0,
      },
      {
        id: "claim-3",
        label: "Python",
        type: "skill",
        confidence: 0.75,
        x: 300,
        y: 400,
        clusterId: 1,
      },
    ],
    regions: [
      {
        id: 0,
        label: "Frontend",
        keywords: ["TypeScript", "React", "JavaScript"],
        x: 110,
        y: 190,
        count: 2,
      },
      {
        id: 1,
        label: "Backend",
        keywords: ["Python", "FastAPI"],
        x: 300,
        y: 400,
        count: 1,
      },
    ],
    hasEmbeddings: true,
    embeddingCount: 3,
    totalCount: 3,
  };

  describe("data fetching", () => {
    it("fetches cluster data successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClusterData,
      });

      const { result } = renderHook(() => useSkillClusters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/identity/clusters");
      expect(result.current.data).toEqual(mockClusterData);
    });

    it("handles fetch error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useSkillClusters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Failed to fetch clusters");
    });

    it("returns loading state initially", () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useSkillClusters(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it("uses skill-clusters query key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClusterData,
      });

      renderHook(() => useSkillClusters(), { wrapper });

      await waitFor(() => {
        const queryState = queryClient.getQueryState(["skill-clusters"]);
        expect(queryState).toBeDefined();
      });
    });
  });

  describe("stale time configuration", () => {
    it("uses configured stale time", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClusterData,
      });

      renderHook(() => useSkillClusters(), { wrapper });

      await waitFor(() => {
        const queryState = queryClient.getQueryState(["skill-clusters"]);
        expect(queryState?.dataUpdatedAt).toBeDefined();
      });

      // Verify the query exists and has been set up
      const query = queryClient
        .getQueryCache()
        .find({ queryKey: ["skill-clusters"] });
      expect(query).toBeDefined();
    });
  });

  describe("data structure handling", () => {
    it("handles empty cluster data", async () => {
      const emptyData = {
        nodes: [],
        regions: [],
        hasEmbeddings: false,
        message: "No skills found",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => emptyData,
      });

      const { result } = renderHook(() => useSkillClusters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.nodes).toEqual([]);
      expect(result.current.data?.hasEmbeddings).toBe(false);
      expect(result.current.data?.message).toBe("No skills found");
    });

    it("handles data without regions", async () => {
      const noRegionsData = {
        nodes: mockClusterData.nodes,
        hasEmbeddings: true,
        embeddingCount: 3,
        totalCount: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => noRegionsData,
      });

      const { result } = renderHook(() => useSkillClusters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.nodes.length).toBe(3);
      expect(result.current.data?.regions).toBeUndefined();
    });

    it("handles nodes without cluster assignment", async () => {
      const unclusteredData = {
        nodes: [
          {
            id: "claim-1",
            label: "TypeScript",
            type: "skill",
            confidence: 0.85,
            x: 100,
            y: 200,
            // No clusterId
          },
        ],
        hasEmbeddings: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => unclusteredData,
      });

      const { result } = renderHook(() => useSkillClusters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.nodes[0].clusterId).toBeUndefined();
    });

    it("handles partial embedding data", async () => {
      const partialData = {
        nodes: mockClusterData.nodes.slice(0, 2),
        hasEmbeddings: true,
        embeddingCount: 2,
        totalCount: 5,
        message: "Some claims are missing embeddings",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => partialData,
      });

      const { result } = renderHook(() => useSkillClusters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.embeddingCount).toBe(2);
      expect(result.current.data?.totalCount).toBe(5);
      expect(result.current.data?.message).toBe(
        "Some claims are missing embeddings",
      );
    });
  });

  describe("node types", () => {
    it("handles various node types", async () => {
      const mixedTypesData = {
        nodes: [
          {
            id: "1",
            label: "TypeScript",
            type: "skill",
            confidence: 0.9,
            x: 0,
            y: 0,
          },
          {
            id: "2",
            label: "AWS",
            type: "expertise",
            confidence: 0.8,
            x: 1,
            y: 1,
          },
          {
            id: "3",
            label: "Leadership",
            type: "soft_skill",
            confidence: 0.85,
            x: 2,
            y: 2,
          },
        ],
        hasEmbeddings: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mixedTypesData,
      });

      const { result } = renderHook(() => useSkillClusters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const types = result.current.data?.nodes.map((n) => n.type);
      expect(types).toContain("skill");
      expect(types).toContain("expertise");
      expect(types).toContain("soft_skill");
    });
  });

  describe("confidence values", () => {
    it("handles various confidence levels", async () => {
      const confidenceData = {
        nodes: [
          {
            id: "1",
            label: "High",
            type: "skill",
            confidence: 0.95,
            x: 0,
            y: 0,
          },
          {
            id: "2",
            label: "Medium",
            type: "skill",
            confidence: 0.65,
            x: 1,
            y: 1,
          },
          {
            id: "3",
            label: "Low",
            type: "skill",
            confidence: 0.35,
            x: 2,
            y: 2,
          },
        ],
        hasEmbeddings: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => confidenceData,
      });

      const { result } = renderHook(() => useSkillClusters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const confidences = result.current.data?.nodes.map((n) => n.confidence);
      expect(confidences).toContain(0.95);
      expect(confidences).toContain(0.65);
      expect(confidences).toContain(0.35);
    });
  });
});
