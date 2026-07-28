import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getCourseById,
  softDeleteCourse,
  updateCourse,
} from "@/lib/services/admin/courseService";
import { updateCourseSchema } from "@/lib/validations/admin/course";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const course = await getCourseById(id);
    if (!course) return apiError("Course not found", 404);
    return apiSuccess(course, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = updateCourseSchema.parse(await request.json());
    const updated = await updateCourse(id, body);
    if (!updated) return apiError("Course not found", 404);
    return apiSuccess(updated, "Course updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const deleted = await softDeleteCourse(id);
    if (!deleted) return apiError("Course not found", 404);
    return apiSuccess(deleted, "Course deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
