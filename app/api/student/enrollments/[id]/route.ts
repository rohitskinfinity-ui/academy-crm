import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getStudentEnrollmentDetail } from "@/lib/services/student/enrollmentLearningService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { id } = await context.params;
    const data = await getStudentEnrollmentDetail(user.id, id);
    return apiSuccess(data, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
