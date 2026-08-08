import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { previewEnrollmentCertificate } from "@/lib/services/admin/certificateService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const data = await previewEnrollmentCertificate(id);
    return apiSuccess(data, "Preview ready");
  } catch (err) {
    return handleApiError(err);
  }
}
