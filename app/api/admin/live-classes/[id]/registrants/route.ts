import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getLiveClassForJoin,
  listEnrolledStudentsForLiveClass,
  syncZoomRegistrantsForLiveClass,
} from "@/lib/services/liveClassJoinService";

type Ctx = { params: Promise<{ id: string }> };

/** List enrolled students eligible for this live class. */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const event = await getLiveClassForJoin(id);
    if (!event) return apiError("Live class not found", 404);
    if (!event.course_id) {
      return apiError("Live class has no course linked", 400);
    }
    const items = await listEnrolledStudentsForLiveClass(event);
    return apiSuccess(
      {
        items,
        course_id: event.course_id,
        batch_id: event.batch_id,
      },
      "OK",
    );
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST — sync enrolled students as Zoom registrants (unique join links).
 * Requires Zoom meeting with registration enabled (default on new generates).
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const result = await syncZoomRegistrantsForLiveClass(id);
    return apiSuccess(
      result,
      `Synced ${result.synced}/${result.total_enrolled} Zoom registrants`,
    );
  } catch (err) {
    return handleApiError(err);
  }
}
