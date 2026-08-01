import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import { getStudentDetail } from "@/lib/services/admin/studentService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const student = await getStudentDetail(id);
    if (!student) return apiError("Student not found", 404);
    return apiSuccess(student, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
