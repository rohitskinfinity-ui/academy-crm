import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { downloadStudentCertificate } from "@/lib/services/student/certificateService";

type Ctx = { params: Promise<{ enrollmentId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { enrollmentId } = await context.params;
    const data = await downloadStudentCertificate(user.id, enrollmentId);
    return apiSuccess(data, "Download ready");
  } catch (err) {
    return handleApiError(err);
  }
}
