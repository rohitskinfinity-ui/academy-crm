import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { deleteLiveClass, getLiveClassById, updateLiveClass } from "@/lib/services/admin/liveClassService";
import { liveClassSchema } from "@/lib/validations/admin/liveClass";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase();
    await requireAdmin(request);

    const { id } = await params;
    const item = await getLiveClassById(id);
    if (!item) {
      throw new Error("Live class session not found");
    }

    return apiSuccess(item, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase();
    await requireAdmin(request);

    const { id } = await params;
    const body = await request.json();
    const validated = liveClassSchema.partial().parse(body);

    const updated = await updateLiveClass(id, validated);
    return apiSuccess(updated, "Live class session updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDatabase();
    await requireAdmin(request);

    const { id } = await params;
    await deleteLiveClass(id);
    return apiSuccess({ success: true }, "Live class session deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
