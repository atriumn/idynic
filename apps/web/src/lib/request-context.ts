import { AsyncLocalStorage } from "async_hooks";

export interface RequestContext {
  requestId: string;
  userId?: string;
  startTime: number;
}

// AsyncLocalStorage for request-scoped context
// Works in Node.js runtime (API routes, server components)
// Does NOT work in Edge runtime (middleware) - use headers there
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Get current request context from AsyncLocalStorage
 * Returns undefined if not in a request context (e.g., Edge runtime)
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Get the current request ID, or undefined if not available
 */
export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}

/**
 * Run a function with request context
 * Use this to wrap API route handlers
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}

/**
 * Create a new request context
 */
export function createRequestContext(
  requestId: string,
  userId?: string,
): RequestContext {
  return {
    requestId,
    userId,
    startTime: Date.now(),
  };
}

/**
 * Generate a new request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
