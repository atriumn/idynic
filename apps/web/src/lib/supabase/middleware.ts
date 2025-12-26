import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Generate or reuse request ID for correlation
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

  // Clone request with the request ID header (for downstream API routes)
  const requestWithId = new Request(request.url, {
    method: request.method,
    headers: new Headers(request.headers),
    body: request.body,
    // @ts-expect-error - duplex is required for streaming but not in types
    duplex: "half",
  });
  requestWithId.headers.set("x-request-id", requestId);

  let supabaseResponse = NextResponse.next({
    request: requestWithId,
  });

  // Add request ID to response headers for client-side correlation
  supabaseResponse.headers.set("x-request-id", requestId);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ["/identity", "/opportunities"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  // Redirect logged-in users away from login page
  if (request.nextUrl.pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/identity";
    const response = NextResponse.redirect(url);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  return supabaseResponse;
}
