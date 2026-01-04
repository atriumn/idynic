import { NextRequest } from "next/server";

export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    searchParams?: Record<string, string>;
  } = {},
): NextRequest {
  const { method = "GET", headers = {}, body, searchParams = {} } = options;

  const urlWithParams = new URL(url, "http://localhost:3000");
  Object.entries(searchParams).forEach(([key, value]) => {
    urlWithParams.searchParams.set(key, value);
  });

  const requestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body && method !== "GET" ? JSON.stringify(body) : undefined,
  };

  return new NextRequest(urlWithParams, requestInit);
}

export function createAuthenticatedRequest(
  url: string,
  apiKey: string,
  options: Parameters<typeof createMockRequest>[1] = {},
): NextRequest {
  return createMockRequest(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

export async function parseSSEResponse(response: Response): Promise<string[]> {
  const reader = response.body?.getReader();
  if (!reader) return [];

  const decoder = new TextDecoder();
  const events: string[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        events.push(line.slice(6));
      }
    }
  }

  return events;
}

// Helper for generating valid API keys for tests
export function generateTestApiKey(): string {
  return "idn_" + "a".repeat(64);
}
