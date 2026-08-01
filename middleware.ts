import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEFAULT_ORIGIN = "*";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/public")) {
    return NextResponse.next();
  }

  const origin =
    process.env.PUBLIC_WEB_ORIGIN?.trim() ||
    request.headers.get("origin") ||
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
  matcher: "/api/public/:path*",
};
