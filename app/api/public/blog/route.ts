import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listPublicBlogPosts } from "@/lib/services/public/cmsService";
import { listPublicBlogQuerySchema } from "@/lib/validations/public/catalog";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const query = listPublicBlogQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    return apiSuccess(await listPublicBlogPosts(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
