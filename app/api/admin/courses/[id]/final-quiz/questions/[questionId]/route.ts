import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  deleteFinalQuizQuestion,
  updateFinalQuizQuestion,
} from "@/lib/services/admin/finalQuizService";
import { updateFinalQuizQuestionSchema } from "@/lib/validations/admin/finalQuiz";

type Ctx = { params: Promise<{ id: string; questionId: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { questionId } = await context.params;
    const body = updateFinalQuizQuestionSchema.parse(await request.json());
    const updated = await updateFinalQuizQuestion(questionId, body);
    if (!updated) return apiError("Question not found", 404);
    return apiSuccess(updated, "Question updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { questionId } = await context.params;
    const deleted = await deleteFinalQuizQuestion(questionId);
    if (!deleted) return apiError("Question not found", 404);
    return apiSuccess(deleted, "Question deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
