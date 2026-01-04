import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  runWithContext,
  createRequestContext,
  generateRequestId,
  getRequestContext,
} from "@/lib/request-context";
import { log } from "@/lib/logger";

type RouteHandler = (request: Request) => Promise<Response>;

/**
 * Wraps an API route handler with request context
 * - Extracts or generates request ID from headers
 * - Sets up AsyncLocalStorage context for logging
 * - Adds request ID to response headers
 * - Logs request start/end with timing
 *
 * Usage:
 *   export const POST = withRequestContext(async (request) => {
 *     log.info("Doing something");
 *     return Response.json({ ok: true });
 *   });
 */
export function withRequestContext(handler: RouteHandler): RouteHandler {
  return async (request: Request) => {
    // Get request ID from header (set by middleware) or generate new one
    const requestId =
      request.headers.get("x-request-id") || generateRequestId();

    const context = createRequestContext(requestId);

    // Set Sentry context for this request
    Sentry.setTag("request_id", requestId);

    return runWithContext(context, async () => {
      const url = new URL(request.url);
      log.info(`${request.method} ${url.pathname}`, {
        path: url.pathname,
        method: request.method,
      });

      try {
        const response = await handler(request);

        // Clone response to add headers
        const newResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers),
        });
        newResponse.headers.set("x-request-id", requestId);

        log.info(`${request.method} ${url.pathname} completed`, {
          status: response.status,
        });

        // Flush logs to Axiom before response completes
        await log.flush();

        return newResponse;
      } catch (error) {
        log.error(`${request.method} ${url.pathname} failed`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Capture to Sentry with full context
        Sentry.captureException(error, {
          extra: {
            requestId,
            path: url.pathname,
            method: request.method,
          },
        });

        // Flush logs to Axiom even on error
        await log.flush();

        const errorResponse = NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
        errorResponse.headers.set("x-request-id", requestId);
        return errorResponse;
      }
    });
  };
}

/**
 * Set user ID in the current request context
 * Call this after authenticating the user
 */
export function setContextUserId(userId: string): void {
  // Note: This modifies the context in place
  // AsyncLocalStorage maintains the same reference
  const context = getRequestContext();
  if (context) {
    context.userId = userId;
  }

  // Also set Sentry user context
  Sentry.setUser({ id: userId });
}
