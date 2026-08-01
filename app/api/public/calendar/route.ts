import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listPublicCalendarCourses } from "@/lib/services/public/calendarCoursesService";
import { listPublicCalendarCoursesQuerySchema } from "@/lib/validations/public/catalog";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const query = listPublicCalendarCoursesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    return apiSuccess(await listPublicCalendarCourses(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
