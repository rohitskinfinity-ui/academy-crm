import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import { getLiveClassById, updateLiveClass } from "@/lib/services/admin/liveClassService";
import { getZoomHostStartUrl } from "@/lib/zoom/client";
import { parseZoomJoinUrl } from "@/lib/zoom/parseJoinUrl";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/live-classes/[id]/host-start
 * Returns a fresh Zoom host start URL (ZAK) so admin can start as host.
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;

    const liveClass = await getLiveClassById(id);
    if (!liveClass) return apiError("Live class not found", 404);

    const fromUrl = parseZoomJoinUrl(liveClass.meeting_url || "");
    const meetingId = (liveClass.meeting_id || fromUrl.meeting_id || "").replace(
      /\s+/g,
      "",
    );

    if (!meetingId) {
      return apiError(
        "No Zoom meeting ID on this class. Generate or paste a Zoom join URL first.",
        400,
      );
    }

    let startUrl: string;
    try {
      startUrl = await getZoomHostStartUrl(meetingId);
    } catch (err) {
      // Fallback to stored host link if ZAK refresh fails
      if (liveClass.host_start_url) {
        startUrl = liveClass.host_start_url;
      } else {
        throw err;
      }
    }

    // Keep latest meeting id; ZAK URL is ephemeral so we still store for fallback
    await updateLiveClass(id, {
      host_start_url: startUrl,
      meeting_id: meetingId,
    });

    return apiSuccess({ start_url: startUrl, meeting_id: meetingId }, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
