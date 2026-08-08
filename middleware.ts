import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEFAULT_ORIGIN = "*";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Access-Token",
    "Access-Control-Max-Age": "86400",
  };
}

function allowedApiPath(pathname: string) {
  return (
    pathname.startsWith("/api/public") || pathname.startsWith("/api/student")
  );
}

export function middleware(request: NextRequest) {
  if (!allowedApiPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const origin =
    request.headers.get("origin") ||
    process.env.PUBLIC_WEB_ORIGIN?.trim() ||
    process.env.STUDENT_WEB_URL?.trim() ||
    DEFAULT_ORIGIN;
  const headers = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ["/api/public/:path*", "/api/student/:path*"],
};
