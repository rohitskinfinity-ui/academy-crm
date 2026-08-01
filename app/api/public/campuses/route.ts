import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listPublicCampuses } from "@/lib/services/public/courseCatalogService";

export async function GET() {
  try {
    await ensureDatabase();
    return apiSuccess(await listPublicCampuses(), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
