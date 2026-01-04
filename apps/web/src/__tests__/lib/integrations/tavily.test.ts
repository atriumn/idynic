import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  searchTavily,
  type TavilySearchParams,
  type TavilyResponse,
} from "@/lib/integrations/tavily";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("searchTavily", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, TAVILY_API_KEY: "test-api-key" };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should throw error when TAVILY_API_KEY is not configured", async () => {
    process.env.TAVILY_API_KEY = "";

    await expect(searchTavily({ query: "test" })).rejects.toThrow(
      "TAVILY_API_KEY not configured",
    );
  });

  it("should throw error when TAVILY_API_KEY is undefined", async () => {
    delete process.env.TAVILY_API_KEY;

    await expect(searchTavily({ query: "test" })).rejects.toThrow(
      "TAVILY_API_KEY not configured",
    );
  });

  it("should call Tavily API with correct parameters", async () => {
    const mockResponse: TavilyResponse = {
      query: "test query",
      results: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const params: TavilySearchParams = {
      query: "test query",
    };

    await searchTavily(params);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: expect.any(String),
      }),
    );

    const bodyArg = mockFetch.mock.calls[0][1].body;
    const parsedBody = JSON.parse(bodyArg);
    expect(parsedBody.api_key).toBe("test-api-key");
    expect(parsedBody.query).toBe("test query");
    expect(parsedBody.topic).toBe("general");
    expect(parsedBody.search_depth).toBe("basic");
    expect(parsedBody.max_results).toBe(5);
  });

  it("should use custom parameters when provided", async () => {
    const mockResponse: TavilyResponse = {
      query: "test",
      answer: "The answer",
      results: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const params: TavilySearchParams = {
      query: "test",
      topic: "news",
      search_depth: "advanced",
      max_results: 10,
      time_range: "week",
      include_answer: true,
    };

    await searchTavily(params);

    const bodyArg = mockFetch.mock.calls[0][1].body;
    const parsedBody = JSON.parse(bodyArg);
    expect(parsedBody.topic).toBe("news");
    expect(parsedBody.search_depth).toBe("advanced");
    expect(parsedBody.max_results).toBe(10);
    expect(parsedBody.time_range).toBe("week");
    expect(parsedBody.include_answer).toBe(true);
  });

  it("should return search results on success", async () => {
    const mockResponse: TavilyResponse = {
      query: "company research",
      answer: "Company is great",
      results: [
        {
          title: "Result 1",
          url: "https://example.com/1",
          content: "Content 1",
          score: 0.95,
        },
        {
          title: "Result 2",
          url: "https://example.com/2",
          content: "Content 2",
          score: 0.85,
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await searchTavily({ query: "company research" });

    expect(result.query).toBe("company research");
    expect(result.answer).toBe("Company is great");
    expect(result.results).toHaveLength(2);
    expect(result.results[0].title).toBe("Result 1");
    expect(result.results[0].score).toBe(0.95);
  });

  it("should throw error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(searchTavily({ query: "test" })).rejects.toThrow(
      "Tavily API error: 401 - Unauthorized",
    );
  });

  it("should throw error on 500 server error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(searchTavily({ query: "test" })).rejects.toThrow(
      "Tavily API error: 500 - Internal Server Error",
    );
  });
});
