import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { patchStudentProfile } from "@/lib/services/student/dashboardService";
import { patchProfileSchema } from "@/lib/validations/student/lms";

export async function PATCH(request: NextRequest) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const body = patchProfileSchema.parse(await request.json());
    const updated = await patchStudentProfile(user.id, body);
    return apiSuccess(updated, "Profile updated");
  } catch (err) {
    return handleApiError(err);
  }
}
