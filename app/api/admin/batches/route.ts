import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createBatch, listBatches } from "@/lib/services/admin/courseService";
import { createBatchSchema } from "@/lib/validations/admin/course";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const courseId = request.nextUrl.searchParams.get("course_id") ?? undefined;
    return apiSuccess(await listBatches(courseId), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const body = createBatchSchema.parse(await request.json());
    return apiSuccess(await createBatch(body), "Batch created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
