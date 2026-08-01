import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getCourseById,
  setCourseFaqs,
} from "@/lib/services/admin/courseService";
import { setCourseFaqsSchema } from "@/lib/validations/admin/course";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(_request);
    const { id } = await context.params;
    const course = await getCourseById(id);
    if (!course) return apiError("Course not found", 404);
    return apiSuccess(
      (course as { faqs?: unknown[] }).faqs ?? [],
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
    const body = setCourseFaqsSchema.parse(await request.json());
    const faqs = await setCourseFaqs(id, body.faqs);
    return apiSuccess(faqs, "Course FAQs updated");
  } catch (err) {
    return handleApiError(err);
  }
}
