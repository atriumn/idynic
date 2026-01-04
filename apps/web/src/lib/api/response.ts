import { NextResponse } from "next/server";

interface ApiMeta {
  request_id: string;
  count?: number;
  has_more?: boolean;
}

interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiMeta;
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

/**
 * Create a standardized success response.
 */
export function apiSuccess<T>(
  data: T,
  options?: { count?: number; has_more?: boolean },
): NextResponse<ApiSuccessResponse<T>> {
  const requestId = crypto.randomUUID().slice(0, 8);

  return NextResponse.json({
    data,
    meta: {
      request_id: requestId,
      ...(options?.count !== undefined && { count: options.count }),
      ...(options?.has_more !== undefined && { has_more: options.has_more }),
    },
  });
}

/**
 * Create a standardized error response.
 */
export function apiError(
  code: string,
  message: string,
  status: number = 400,
  headers?: Record<string, string>,
): NextResponse<ApiErrorResponse> {
  const requestId = crypto.randomUUID().slice(0, 8);

  const response = NextResponse.json(
    {
      error: {
        code,
        message,
        request_id: requestId,
      },
    },
    { status },
  );

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

/**
 * Common error responses.
 */
export const ApiErrors = {
  notFound: (resource: string) =>
    apiError("not_found", `${resource} not found`, 404),

  validationError: (message: string) =>
    apiError("validation_error", message, 400),

  serverError: (message: string = "An unexpected error occurred") =>
    apiError("server_error", message, 500),
};
