import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { issueBookletDownload } from "@/lib/services/student/videoPlaybackService";

type Ctx = { params: Promise<{ id: string; bookletId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { id, bookletId } = await context.params;
    const data = await issueBookletDownload(user, id, bookletId);
    return apiSuccess(data, "Download ready");
  } catch (err) {
    return handleApiError(err);
  }
}
