import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useAddOpportunity } from "../../hooks/use-add-opportunity";
import { createWrapper } from "../test-utils";
import { mockSession } from "../mocks/api-responses";
import { supabase } from "../../lib/supabase";

// Mock supabase
jest.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;

function setupAuthenticatedSession() {
  mockGetSession.mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });
  mockOnAuthStateChange.mockImplementation((callback) => {
    callback("SIGNED_IN", mockSession);
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
}

describe("useAddOpportunity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it("initializes with default state", () => {
    setupAuthenticatedSession();

    const { result } = renderHook(() => useAddOpportunity(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.addOpportunity).toBe("function");
    expect(typeof result.current.reset).toBe("function");
  });

  it("submits opportunity successfully", async () => {
    setupAuthenticatedSession();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: "job-123" }),
    });

    const { result } = renderHook(() => useAddOpportunity(), {
      wrapper: createWrapper(),
    });

    let response: { jobId: string } | undefined;
    await act(async () => {
      response = await result.current.addOpportunity("https://example.com/job");
    });

    expect(response).toEqual({ jobId: "job-123" });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/process-opportunity"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockSession.access_token}`,
        }),
        body: JSON.stringify({
          url: "https://example.com/job",
          description: undefined,
        }),
      }),
    );
  });

  it("submits with description", async () => {
    setupAuthenticatedSession();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: "job-456" }),
    });

    const { result } = renderHook(() => useAddOpportunity(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.addOpportunity(
        "https://example.com/job",
        "Software Engineer role",
      );
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          url: "https://example.com/job",
          description: "Software Engineer role",
        }),
      }),
    );
  });

  it("throws on API error response", async () => {
    setupAuthenticatedSession();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Invalid URL" }),
    });

    const { result } = renderHook(() => useAddOpportunity(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.addOpportunity("invalid-url");
      }),
    ).rejects.toThrow("Invalid URL");
  });

  it("throws on network error", async () => {
    setupAuthenticatedSession();
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useAddOpportunity(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.addOpportunity("https://example.com/job");
      }),
    ).rejects.toThrow("Network error");
  });

  it("throws when not authenticated", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockOnAuthStateChange.mockImplementation((callback) => {
      callback("SIGNED_OUT", null);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    const { result } = renderHook(() => useAddOpportunity(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.addOpportunity("https://example.com/job");
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("reset clears state", () => {
    setupAuthenticatedSession();

    const { result } = renderHook(() => useAddOpportunity(), {
      wrapper: createWrapper(),
    });

    // Just verify reset function works
    act(() => {
      result.current.reset();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });

  it("sets isSubmitting during request", async () => {
    setupAuthenticatedSession();

    let resolveResponse: (value: unknown) => void;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    mockFetch.mockReturnValueOnce(responsePromise);

    const { result } = renderHook(() => useAddOpportunity(), {
      wrapper: createWrapper(),
    });

    // Start submission
    let submissionPromise: Promise<unknown>;
    act(() => {
      submissionPromise = result.current.addOpportunity(
        "https://example.com/job",
      );
    });

    // Should be submitting
    expect(result.current.isSubmitting).toBe(true);

    // Complete request
    await act(async () => {
      resolveResponse!({
        ok: true,
        json: () => Promise.resolve({ jobId: "job-789" }),
      });
      await submissionPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });
});
