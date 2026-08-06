import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createZoomMeeting } from "@/lib/zoom/client";
import { clampLiveClassDuration } from "@/lib/liveClassDuration";

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);

    const body = await request.json();
    const topic = body.topic || "Weekly Doctor Connect Live Class";
    const startsAt = body.starts_at || new Date(Date.now() + 86400000).toISOString();
    const durationMinutes = clampLiveClassDuration(Number(body.duration_minutes));
    const agenda = body.agenda || "Skinfinity Academy Doctor Connect Class";

    const zoomResult = await createZoomMeeting({
      topic,
      starts_at: startsAt,
      duration_minutes: durationMinutes,
      agenda,
    });

    return apiSuccess(
      {
        meeting_url: zoomResult.join_url,
        meeting_id: String(zoomResult.id),
        passcode: zoomResult.password || "",
        start_url: zoomResult.start_url,
      },
      "Zoom meeting auto-generated successfully via Server-to-Server OAuth",
      201,
    );
  } catch (err) {
    console.error("[Zoom API] Failed to auto-generate Zoom meeting", err);
    return handleApiError(err);
  }
}
