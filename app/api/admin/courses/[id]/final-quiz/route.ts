import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getCourseFinalQuiz,
  upsertCourseFinalQuiz,
} from "@/lib/services/admin/finalQuizService";
import { upsertFinalQuizSchema } from "@/lib/validations/admin/finalQuiz";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    return apiSuccess(await getCourseFinalQuiz(id), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = upsertFinalQuizSchema.parse(await request.json());
    return apiSuccess(await upsertCourseFinalQuiz(id, body), "Certificate quiz saved");
  } catch (err) {
    return handleApiError(err);
  }
}
