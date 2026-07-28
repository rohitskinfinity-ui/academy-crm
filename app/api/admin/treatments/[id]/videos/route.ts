import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createVideo, listVideos } from "@/lib/services/admin/treatmentService";
import { createVideoSchema } from "@/lib/validations/admin/treatment";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    return apiSuccess(await listVideos(id), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = createVideoSchema.parse(await request.json());
    return apiSuccess(await createVideo(id, body), "Video created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
