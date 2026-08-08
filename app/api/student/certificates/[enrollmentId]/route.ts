import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getStudentCertificateDetail } from "@/lib/services/student/certificateService";

type Ctx = { params: Promise<{ enrollmentId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { enrollmentId } = await context.params;
    const data = await getStudentCertificateDetail(user.id, enrollmentId);
    return apiSuccess(data, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
