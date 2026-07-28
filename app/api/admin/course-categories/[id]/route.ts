import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  deleteCategory,
  updateCategory,
} from "@/lib/services/admin/courseService";
import { updateCategorySchema } from "@/lib/validations/admin/course";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = updateCategorySchema.parse(await request.json());
    const updated = await updateCategory(id, body);
    if (!updated) return apiError("Category not found", 404);
    return apiSuccess(updated, "Category updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const deleted = await deleteCategory(id);
    if (!deleted) return apiError("Category not found", 404);
    return apiSuccess(deleted, "Category deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
