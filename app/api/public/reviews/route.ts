import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listPublicHomeReviews } from "@/lib/services/public/cmsService";
import { listPublicHomeReviewsQuerySchema } from "@/lib/validations/public/catalog";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const query = listPublicHomeReviewsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    return apiSuccess(await listPublicHomeReviews(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
