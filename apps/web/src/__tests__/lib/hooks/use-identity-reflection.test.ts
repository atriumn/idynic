import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useIdentityReflection,
  useInvalidateReflection,
} from "@/lib/hooks/use-identity-reflection";
import React from "react";

// Mock Supabase client
const mockGetUser = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockSelectFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    }),
  }),
}));

describe("useIdentityReflection", () => {
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

  const mockReflectionData = {
    identity_headline: "Senior Software Engineer with 10+ years of experience",
    identity_bio:
      "Passionate technologist focused on building scalable systems and mentoring teams.",
    identity_archetype: "Technical Leader",
    identity_keywords: ["TypeScript", "React", "Node.js", "AWS", "Leadership"],
    identity_matches: ["Senior Engineer", "Tech Lead", "Staff Engineer"],
    identity_generated_at: "2024-01-15T10:30:00Z",
  };

  describe("useIdentityReflection", () => {
    it("fetches reflection data for authenticated user", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSingle.mockResolvedValue({
        data: mockReflectionData,
        error: null,
      });

      const { result } = renderHook(() => useIdentityReflection(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSelectFrom).toHaveBeenCalledWith("profiles");
      expect(mockEq).toHaveBeenCalledWith("id", "user-123");
      expect(result.current.data).toEqual(mockReflectionData);
    });

    it("returns null when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
      });

      const { result } = renderHook(() => useIdentityReflection(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it("returns null on database error", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const { result } = renderHook(() => useIdentityReflection(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it("returns loading state initially", () => {
      mockGetUser.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useIdentityReflection(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it("uses identity-reflection query key", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSingle.mockResolvedValue({
        data: mockReflectionData,
        error: null,
      });

      renderHook(() => useIdentityReflection(), { wrapper });

      await waitFor(() => {
        const queryState = queryClient.getQueryState(["identity-reflection"]);
        expect(queryState).toBeDefined();
      });
    });

    it("selects correct fields from profiles table", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSingle.mockResolvedValue({
        data: mockReflectionData,
        error: null,
      });

      renderHook(() => useIdentityReflection(), { wrapper });

      await waitFor(() => {
        expect(mockSelect).toHaveBeenCalledWith(
          expect.stringContaining("identity_headline"),
        );
      });
    });
  });

  describe("useInvalidateReflection", () => {
    it("invalidates the identity-reflection query", async () => {
      // First, populate the cache
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSingle.mockResolvedValue({
        data: mockReflectionData,
        error: null,
      });

      const { result: reflectionResult } = renderHook(
        () => useIdentityReflection(),
        { wrapper },
      );

      await waitFor(() => {
        expect(reflectionResult.current.isSuccess).toBe(true);
      });

      // Now test invalidation
      const { result: invalidateResult } = renderHook(
        () => useInvalidateReflection(),
        { wrapper },
      );

      // Call the invalidate function
      invalidateResult.current();

      await waitFor(() => {
        const queryState = queryClient.getQueryState(["identity-reflection"]);
        expect(queryState?.isInvalidated).toBe(true);
      });
    });

    it("returns a function", () => {
      const { result } = renderHook(() => useInvalidateReflection(), {
        wrapper,
      });
      expect(typeof result.current).toBe("function");
    });
  });

  describe("reflection data variations", () => {
    it("handles reflection with null fields", async () => {
      const partialData = {
        identity_headline: "Software Engineer",
        identity_bio: null,
        identity_archetype: null,
        identity_keywords: [],
        identity_matches: null,
        identity_generated_at: "2024-01-01T00:00:00Z",
      };

      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSingle.mockResolvedValue({
        data: partialData,
        error: null,
      });

      const { result } = renderHook(() => useIdentityReflection(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.identity_headline).toBe("Software Engineer");
      expect(result.current.data?.identity_bio).toBeNull();
    });

    it("handles reflection with empty keywords", async () => {
      const emptyKeywordsData = {
        ...mockReflectionData,
        identity_keywords: [],
      };

      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSingle.mockResolvedValue({
        data: emptyKeywordsData,
        error: null,
      });

      const { result } = renderHook(() => useIdentityReflection(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.identity_keywords).toEqual([]);
    });

    it("handles reflection with many keywords", async () => {
      const manyKeywordsData = {
        ...mockReflectionData,
        identity_keywords: [
          "TypeScript",
          "React",
          "Node.js",
          "Python",
          "AWS",
          "Docker",
          "Kubernetes",
          "PostgreSQL",
          "MongoDB",
          "Redis",
        ],
      };

      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSingle.mockResolvedValue({
        data: manyKeywordsData,
        error: null,
      });

      const { result } = renderHook(() => useIdentityReflection(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.identity_keywords?.length).toBe(10);
    });

    it("handles missing identity_generated_at", async () => {
      const noDateData = {
        identity_headline: "Engineer",
        identity_bio: "A bio",
        identity_archetype: "Builder",
        identity_keywords: ["Code"],
        identity_matches: [],
        identity_generated_at: null,
      };

      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSingle.mockResolvedValue({
        data: noDateData,
        error: null,
      });

      const { result } = renderHook(() => useIdentityReflection(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.identity_generated_at).toBeNull();
    });
  });

  describe("error handling", () => {
    it("logs error to console on fetch failure", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Connection failed" },
      });

      const { result } = renderHook(() => useIdentityReflection(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to fetch identity reflection:",
        expect.any(Object),
      );

      consoleSpy.mockRestore();
    });
  });
});
