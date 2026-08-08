import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  attachEnrollmentCertificate,
  getCompletionStatus,
  getEnrollmentCertificate,
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

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) {
      return apiError("Upload a PDF, JPG, or PNG certificate file", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const cert = await attachEnrollmentCertificate(id, {
      buffer,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
    });
    if (!cert) return apiError("Failed to attach certificate", 500);
    return apiSuccess(cert, "Certificate uploaded", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
