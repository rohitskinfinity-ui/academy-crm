import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listPublicCourses } from "@/lib/services/public/courseCatalogService";
import { listPublicCoursesQuerySchema } from "@/lib/validations/public/catalog";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const query = listPublicCoursesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    return apiSuccess(await listPublicCourses(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
