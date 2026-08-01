import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getPublicSiteChrome } from "@/lib/services/public/cmsService";

export async function GET() {
  try {
    await ensureDatabase();
    return apiSuccess(await getPublicSiteChrome(), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
