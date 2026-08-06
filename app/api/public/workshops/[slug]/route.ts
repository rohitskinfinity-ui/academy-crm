import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getWorkshopBySlug } from "@/lib/services/admin/workshopService";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { slug } = await context.params;
    const workshop = await getWorkshopBySlug(slug, true);
    if (!workshop) return apiError("Workshop not found", 404);
    return apiSuccess(workshop, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
