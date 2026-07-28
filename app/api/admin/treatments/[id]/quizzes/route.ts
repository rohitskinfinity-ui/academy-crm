import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getQuiz, upsertQuiz } from "@/lib/services/admin/treatmentService";
import { upsertQuizSchema } from "@/lib/validations/admin/treatment";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    return apiSuccess(await getQuiz(id), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = upsertQuizSchema.parse(await request.json());
    return apiSuccess(await upsertQuiz(id, body), "Quiz saved");
  } catch (err) {
    return handleApiError(err);
  }
}
