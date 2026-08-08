import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createFinalQuizQuestion } from "@/lib/services/admin/finalQuizService";
import { createFinalQuizQuestionSchema } from "@/lib/validations/admin/finalQuiz";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = createFinalQuizQuestionSchema.parse(await request.json());
    return apiSuccess(
      await createFinalQuizQuestion(id, body),
      "Question created",
      201,
    );
  } catch (err) {
    return handleApiError(err);
  }
}
