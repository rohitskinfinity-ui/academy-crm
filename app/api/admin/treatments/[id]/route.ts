import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getTreatmentById,
  softDeleteTreatment,
  updateTreatment,
} from "@/lib/services/admin/treatmentService";
import { updateTreatmentSchema } from "@/lib/validations/admin/treatment";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const treatment = await getTreatmentById(id);
    if (!treatment) return apiError("Treatment not found", 404);
    return apiSuccess(treatment, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = updateTreatmentSchema.parse(await request.json());
    const updated = await updateTreatment(id, body);
    if (!updated) return apiError("Treatment not found", 404);
    return apiSuccess(updated, "Treatment updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const deleted = await softDeleteTreatment(id);
    if (!deleted) return apiError("Treatment not found", 404);
    return apiSuccess(deleted, "Treatment deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
