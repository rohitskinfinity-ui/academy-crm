import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listStudents } from "@/lib/services/admin/studentService";
import { listStudentsQuerySchema } from "@/lib/validations/admin/student";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = listStudentsQuerySchema.parse(sp);
    const result = await listStudents(query);
    return apiSuccess(result, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
