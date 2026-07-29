import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listRecordingsForTreatment } from "@/lib/services/admin/liveClassRecordingService";

type Ctx = { params: Promise<{ id: string }> };

/** Live class recordings under a treatment (not master treatment_videos). */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const items = await listRecordingsForTreatment(id);
    return apiSuccess({ items }, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
