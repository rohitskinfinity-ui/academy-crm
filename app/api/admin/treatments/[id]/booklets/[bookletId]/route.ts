import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  softDeleteBooklet,
  updateBooklet,
} from "@/lib/services/admin/treatmentService";
import { updateBookletSchema } from "@/lib/validations/admin/treatment";

type Ctx = { params: Promise<{ id: string; bookletId: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { bookletId } = await context.params;
    const body = updateBookletSchema.parse(await request.json());
    const updated = await updateBooklet(bookletId, body);
    if (!updated) return apiError("Booklet not found", 404);
    return apiSuccess(updated, "Booklet updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { bookletId } = await context.params;
    const deleted = await softDeleteBooklet(bookletId);
    if (!deleted) return apiError("Booklet not found", 404);
    return apiSuccess(deleted, "Booklet deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
