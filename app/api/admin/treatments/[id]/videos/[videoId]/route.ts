import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  softDeleteVideo,
  updateVideo,
} from "@/lib/services/admin/treatmentService";
import { updateVideoSchema } from "@/lib/validations/admin/treatment";

type Ctx = { params: Promise<{ id: string; videoId: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { videoId } = await context.params;
    const body = updateVideoSchema.parse(await request.json());
    const updated = await updateVideo(videoId, body);
    if (!updated) return apiError("Video not found", 404);
    return apiSuccess(updated, "Video updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { videoId } = await context.params;
    const deleted = await softDeleteVideo(videoId);
    if (!deleted) return apiError("Video not found", 404);
    return apiSuccess(deleted, "Video deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
