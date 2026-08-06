import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  softDeleteCourseMedia,
  updateCourseMedia,
} from "@/lib/services/admin/courseMediaService";
import { updateCourseMediaSchema } from "@/lib/validations/admin/courseMedia";

type Ctx = { params: Promise<{ id: string; mediaId: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id, mediaId } = await context.params;
    const body = updateCourseMediaSchema.parse(await request.json());
    const item = await updateCourseMedia(id, mediaId, body);
    if (!item) return apiError("Gallery item not found", 404);
    return apiSuccess(item, "Gallery item updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id, mediaId } = await context.params;
    const deleted = await softDeleteCourseMedia(id, mediaId);
    if (!deleted) return apiError("Gallery item not found", 404);
    return apiSuccess({ id: deleted.id }, "Gallery item deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
