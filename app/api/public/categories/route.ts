import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listPublicCategories } from "@/lib/services/public/courseCatalogService";

export async function GET() {
  try {
    await ensureDatabase();
    return apiSuccess(await listPublicCategories(), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
