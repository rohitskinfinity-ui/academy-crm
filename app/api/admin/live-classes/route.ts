import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createLiveClass, listLiveClasses } from "@/lib/services/admin/liveClassService";
import { liveClassSchema } from "@/lib/validations/admin/liveClass";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const course_id = searchParams.get("course_id") || undefined;
    const treatment_id = searchParams.get("treatment_id") || undefined;
    const status = searchParams.get("status") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await listLiveClasses({
      course_id,
      treatment_id,
      status,
      page,
      limit,
    });

    return apiSuccess(
      { items: result.items, pagination: result.pagination },
      "OK",
      200,
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);

    const body = await request.json();
    const validated = liveClassSchema.parse(body);

    const created = await createLiveClass(validated);
    return apiSuccess(created, "Live class session scheduled successfully", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
