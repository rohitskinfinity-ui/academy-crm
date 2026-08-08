import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { deleteStudentBookmark } from "@/lib/services/student/bookmarkService";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { id } = await context.params;
    const deleted = await deleteStudentBookmark(user.id, id);
    return apiSuccess(deleted, "Bookmark removed");
  } catch (err) {
    return handleApiError(err);
  }
}
