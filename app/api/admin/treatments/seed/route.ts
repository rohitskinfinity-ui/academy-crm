import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { seedDummyTreatments } from "@/lib/db/seedTreatments";

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);

    let count = 1;
    const countParam = request.nextUrl.searchParams.get("count");
    if (countParam) {
      count = parseInt(countParam, 10) || 1;
    } else {
      try {
        const body = await request.json();
        if (body?.count) {
          count = Number(body.count) || 1;
        }
      } catch {
        // No JSON body passed
      }
    }

    const result = await seedDummyTreatments({ duplicateTimes: count });

    return apiSuccess(
      result,
      `Successfully seeded ${result.count} dummy treatments with stages, videos, booklets, and quiz questions.`,
      201,
    );
  } catch (err) {
    return handleApiError(err);
  }
}
