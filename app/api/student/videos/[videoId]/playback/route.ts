import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { issueVideoPlayback } from "@/lib/services/student/videoPlaybackService";

type Ctx = { params: Promise<{ videoId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { videoId } = await context.params;
    const data = await issueVideoPlayback(user, videoId);
    return apiSuccess(data, "Playback ready");
  } catch (err) {
    return handleApiError(err);
  }
}
