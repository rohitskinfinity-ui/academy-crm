import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listPublicEvents } from "@/lib/services/public/eventsService";
import { listPublicEventsQuerySchema } from "@/lib/validations/public/catalog";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const query = listPublicEventsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    return apiSuccess(await listPublicEvents(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
