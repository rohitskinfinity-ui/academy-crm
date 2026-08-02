import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getStudentDetail,
  updateStudent,
} from "@/lib/services/admin/studentService";
import { updateStudentSchema } from "@/lib/validations/admin/student";

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

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = updateStudentSchema.parse(await request.json());
    const student = await updateStudent(id, body);
    if (!student) return apiError("Student not found", 404);
    return apiSuccess(student, "Student updated");
  } catch (err) {
    return handleApiError(err);
  }
}
