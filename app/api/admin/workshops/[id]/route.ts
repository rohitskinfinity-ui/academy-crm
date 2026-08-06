import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getWorkshopById,
  softDeleteWorkshop,
  updateWorkshop,
} from "@/lib/services/admin/workshopService";
import { updateWorkshopSchema } from "@/lib/validations/admin/workshop";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const workshop = await getWorkshopById(id);
    if (!workshop) return apiError("Workshop not found", 404);
    return apiSuccess(workshop, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = updateWorkshopSchema.parse(await request.json());
    const workshop = await updateWorkshop(id, body);
    if (!workshop) return apiError("Workshop not found", 404);
    return apiSuccess(workshop, "Workshop updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const deleted = await softDeleteWorkshop(id);
    if (!deleted) return apiError("Workshop not found", 404);
    return apiSuccess({ id: deleted.id }, "Workshop deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
