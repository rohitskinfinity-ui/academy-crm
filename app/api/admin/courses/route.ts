import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createCourse, listCourses } from "@/lib/services/admin/courseService";
import {
  createCourseSchema,
  listCoursesQuerySchema,
} from "@/lib/validations/admin/course";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = listCoursesQuerySchema.parse(sp);
    return apiSuccess(await listCourses(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const body = createCourseSchema.parse(await request.json());
    return apiSuccess(await createCourse(body), "Course created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
