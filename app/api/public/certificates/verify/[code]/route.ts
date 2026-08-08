import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { verifyPublicCertificate } from "@/lib/services/student/certificateService";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { code } = await context.params;
    const data = await verifyPublicCertificate(decodeURIComponent(code));
    return apiSuccess(data, "Certificate is valid");
  } catch (err) {
    return handleApiError(err);
  }
}
