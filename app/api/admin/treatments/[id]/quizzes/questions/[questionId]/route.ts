import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  deleteQuestion,
  updateQuestion,
} from "@/lib/services/admin/treatmentService";
import { updateQuestionSchema } from "@/lib/validations/admin/treatment";

type Ctx = { params: Promise<{ id: string; questionId: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { questionId } = await context.params;
    const body = updateQuestionSchema.parse(await request.json());
    const updated = await updateQuestion(questionId, body);
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
    const deleted = await deleteQuestion(questionId);
    if (!deleted) return apiError("Question not found", 404);
    return apiSuccess(deleted, "Question deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
