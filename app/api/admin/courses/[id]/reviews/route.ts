import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getCourseById,
  setCourseReviews,
} from "@/lib/services/admin/courseService";
import { setCourseReviewsSchema } from "@/lib/validations/admin/course";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const course = await getCourseById(id);
    if (!course) return apiError("Course not found", 404);
    return apiSuccess(
      (course as { reviews?: unknown[] }).reviews ?? [],
      "OK",
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = setCourseReviewsSchema.parse(await request.json());
    const reviews = await setCourseReviews(id, body.reviews);
    return apiSuccess(reviews, "Course reviews updated");
  } catch (err) {
    return handleApiError(err);
  }
}
