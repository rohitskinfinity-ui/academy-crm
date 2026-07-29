import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getCompletionStatus,
  getEnrollmentCertificate,
  issueCertificate,
} from "@/lib/services/admin/certificateService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const [completion, certificate] = await Promise.all([
      getCompletionStatus(id),
      getEnrollmentCertificate(id),
    ]);
    return apiSuccess({ completion, certificate }, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const cert = await issueCertificate(id);
    if (!cert) return apiError("Failed to issue certificate", 500);
    return apiSuccess(cert, "PGDCC certificate issued", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
