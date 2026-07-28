import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createQuestion } from "@/lib/services/admin/treatmentService";
import { createQuestionSchema } from "@/lib/validations/admin/treatment";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = createQuestionSchema.parse(await request.json());
    return apiSuccess(await createQuestion(id, body), "Question created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
