import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listStages, upsertStage } from "@/lib/services/admin/treatmentService";
import { upsertStageSchema } from "@/lib/validations/admin/treatment";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    return apiSuccess(await listStages(id), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = upsertStageSchema.parse(await request.json());
    return apiSuccess(await upsertStage(id, body), "Stage saved");
  } catch (err) {
    return handleApiError(err);
  }
}
