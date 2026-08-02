import { NextRequest } from "next/server";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getStudentMe } from "@/lib/services/public/studentAuthService";
import { AuthError } from "@/lib/auth/admin";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireStudent(request);
    const me = await getStudentMe(user.id);
    if (!me) {
      throw new AuthError("Student not found", 403);
    }
    return apiSuccess(me, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
