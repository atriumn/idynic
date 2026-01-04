import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDocumentJob } from "@/lib/hooks/use-document-job";
import type { DocumentJob, JobHighlight } from "@idynic/shared/types";

// Mock Supabase client
const mockUnsubscribe = vi.fn();
const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: mockUnsubscribe });
const mockOn = vi.fn().mockReturnThis();
const mockChannel = vi.fn().mockReturnValue({
  on: mockOn,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
});

const mockFrom = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    from: mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    }),
    channel: mockChannel,
  }),
}));

describe("useDocumentJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockJob = (
    overrides: Partial<DocumentJob> = {},
  ): DocumentJob => ({
    id: "job-123",
    user_id: "user-456",
    document_id: "doc-789",
    opportunity_id: null,
    job_type: "resume",
    filename: "resume.pdf",
    content_hash: "abc123",
    status: "pending",
    phase: null,
    progress: null,
    highlights: [],
    error: null,
    warning: null,
    summary: null,
    created_at: "2024-01-01T00:00:00Z",
    started_at: null,
    completed_at: null,
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  });

  describe("initial state", () => {
    it("returns null job and loading false when jobId is null", () => {
      const { result } = renderHook(() => useDocumentJob(null));

      expect(result.current.job).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.displayMessages).toEqual([]);
    });

    it("starts loading when jobId is provided", () => {
      mockSingle.mockReturnValue(new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useDocumentJob("job-123"));

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("job fetching", () => {
    it("fetches job from Supabase on mount", async () => {
      const mockJob = createMockJob();
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      renderHook(() => useDocumentJob("job-123"));

      // Advance timers to let async effects run
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockFrom).toHaveBeenCalledWith("document_jobs");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("id", "job-123");
    });

    it("sets job data after successful fetch", async () => {
      const mockJob = createMockJob();
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      const { result } = renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.job).toEqual(mockJob);
      expect(result.current.isLoading).toBe(false);
    });

    it("sets error on fetch failure", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      });

      const { result } = renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toEqual(new Error("Not found"));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.job).toBeNull();
    });

    it("clears state when jobId changes to null", async () => {
      const mockJob = createMockJob();
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      const { result, rerender } = renderHook(
        ({ jobId }) => useDocumentJob(jobId),
        { initialProps: { jobId: "job-123" as string | null } },
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.job).toEqual(mockJob);

      // Change jobId to null
      rerender({ jobId: null });

      expect(result.current.job).toBeNull();
      expect(result.current.displayMessages).toEqual([]);
    });
  });

  describe("realtime subscription", () => {
    it("subscribes to realtime updates for the job", async () => {
      const mockJob = createMockJob();
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockChannel).toHaveBeenCalledWith("job-job-123");
      expect(mockOn).toHaveBeenCalledWith(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "document_jobs",
          filter: "id=eq.job-123",
        },
        expect.any(Function),
      );
    });

    it("unsubscribes on unmount", async () => {
      const mockJob = createMockJob();
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      const { unmount } = renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("display messages", () => {
    it("formats highlights by type", async () => {
      const highlights: JobHighlight[] = [
        { text: "Skill found", type: "found" },
        { text: "Claim created", type: "created" },
        { text: "Claim updated", type: "updated" },
      ];
      const mockJob = createMockJob({
        status: "completed",
        highlights,
      });
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      const { result } = renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const messageTexts = result.current.displayMessages.map((m) => m.text);
      expect(messageTexts).toContain("Skill found");
      expect(messageTexts).toContain("+ Claim created");
      expect(messageTexts).toContain("~ Claim updated");
    });

    it("limits display messages to 8", async () => {
      // Create a lot of highlights
      const highlights: JobHighlight[] = Array.from({ length: 20 }, (_, i) => ({
        text: `Highlight ${i}`,
        type: "found" as const,
      }));
      const mockJob = createMockJob({
        status: "completed",
        highlights,
      });
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      const { result } = renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.displayMessages.length).toBeLessThanOrEqual(8);
    });

    it("shows newest highlights first", async () => {
      const highlights: JobHighlight[] = [
        { text: "First", type: "found" },
        { text: "Second", type: "found" },
        { text: "Third", type: "found" },
      ];
      const mockJob = createMockJob({
        status: "completed",
        highlights,
      });
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      const { result } = renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Since highlights are reversed (newest first), Third should be first
      expect(result.current.displayMessages[0].text).toBe("Third");
    });
  });

  describe("job status handling", () => {
    it("handles failed job status", async () => {
      const mockJob = createMockJob({
        status: "failed",
        error: "Processing failed",
      });
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      const { result } = renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.job?.status).toBe("failed");
      expect(result.current.job?.error).toBe("Processing failed");
    });

    it("handles completed job status", async () => {
      const mockJob = createMockJob({
        status: "completed",
        summary: {
          documentId: "doc-123",
          evidenceCount: 10,
          workHistoryCount: 3,
          claimsCreated: 5,
          claimsUpdated: 2,
        },
      });
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      const { result } = renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.job?.status).toBe("completed");
      expect(result.current.job?.summary?.claimsCreated).toBe(5);
    });

    it("handles processing job status", async () => {
      const mockJob = createMockJob({
        status: "processing",
        phase: "extracting",
      });
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      const { result, unmount } = renderHook(() => useDocumentJob("job-123"));

      // Only advance a small amount to avoid ticker infinite loop
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current.job?.status).toBe("processing");
      expect(result.current.job?.phase).toBe("extracting");

      // Clean up to stop ticker interval
      unmount();
    });
  });

  describe("hook return value", () => {
    it("returns expected shape", async () => {
      const mockJob = createMockJob();
      mockSingle.mockResolvedValue({ data: mockJob, error: null });

      const { result } = renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current).toHaveProperty("job");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("error");
      expect(result.current).toHaveProperty("displayMessages");
    });

    it("displayMessages is always an array", async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useDocumentJob("job-123"));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(Array.isArray(result.current.displayMessages)).toBe(true);
    });
  });
});
