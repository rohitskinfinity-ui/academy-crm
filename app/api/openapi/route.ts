import { NextResponse } from "next/server";
import { getOpenApiDocument } from "@/lib/swagger/openapi";

/** Raw OpenAPI JSON — NestJS DocumentBuilder equivalent */
export async function GET() {
  return NextResponse.json(getOpenApiDocument(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
