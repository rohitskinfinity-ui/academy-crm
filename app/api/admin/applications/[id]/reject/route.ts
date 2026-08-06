import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { rejectApplication } from "@/lib/services/admin/applicationService";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const updated = await rejectApplication(id);
    return apiSuccess(updated, "Application rejected");
  } catch (err) {
    return handleApiError(err);
  }
}
