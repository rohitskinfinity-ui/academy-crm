import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getPublicCourseBySlug } from "@/lib/services/public/courseCatalogService";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    await ensureDatabase();
    const { slug } = await context.params;
    const course = await getPublicCourseBySlug(slug);
    if (!course) return apiError("Course not found", 404);
    return apiSuccess(course, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
