import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listPublicTestimonials } from "@/lib/services/public/cmsService";
import { listPublicTestimonialsQuerySchema } from "@/lib/validations/public/catalog";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const query = listPublicTestimonialsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    return apiSuccess(await listPublicTestimonials(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
