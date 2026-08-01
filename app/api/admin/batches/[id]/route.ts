import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { updateBatch } from "@/lib/services/admin/courseService";
import { updateBatchSchema } from "@/lib/validations/admin/course";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = updateBatchSchema.parse(await request.json());
    const updated = await updateBatch(id, body);
    if (!updated) return apiError("Batch not found", 404);
    return apiSuccess(updated, "Batch updated");
  } catch (err) {
    return handleApiError(err);
  }
}
