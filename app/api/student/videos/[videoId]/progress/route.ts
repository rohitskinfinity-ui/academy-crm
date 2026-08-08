import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { upsertVideoProgress } from "@/lib/services/student/progressService";
import { videoProgressSchema } from "@/lib/validations/student/lms";

type Ctx = { params: Promise<{ videoId: string }> };

export async function PUT(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { videoId } = await context.params;
    const body = videoProgressSchema.parse(await request.json());
    const data = await upsertVideoProgress(user.id, videoId, body);
    return apiSuccess(data, "Progress saved");
  } catch (err) {
    return handleApiError(err);
  }
}
