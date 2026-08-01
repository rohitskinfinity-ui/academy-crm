import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getPublicAbout } from "@/lib/services/public/cmsService";

export async function GET() {
  try {
    await ensureDatabase();
    return apiSuccess(await getPublicAbout(), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
