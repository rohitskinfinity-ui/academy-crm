import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createStudentBookmark,
  listStudentBookmarks,
} from "@/lib/services/student/bookmarkService";
import { createBookmarkSchema } from "@/lib/validations/student/lms";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const items = await listStudentBookmarks(user.id);
    return apiSuccess({ items }, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const body = createBookmarkSchema.parse(await request.json());
    const created = await createStudentBookmark(user.id, body);
    return apiSuccess(created, "Bookmark saved", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
