import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getStudentQuiz,
  submitStudentQuiz,
} from "@/lib/services/student/quizService";
import { quizSubmitSchema } from "@/lib/validations/student/lms";

type Ctx = { params: Promise<{ id: string; treatmentId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { id, treatmentId } = await context.params;
    const data = await getStudentQuiz(user.id, id, treatmentId);
    return apiSuccess(data, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { id, treatmentId } = await context.params;
    const body = quizSubmitSchema.parse(await request.json());
    const data = await submitStudentQuiz(user.id, id, treatmentId, body.answers);
    return apiSuccess(data, data.passed ? "Quiz passed" : "Quiz submitted");
  } catch (err) {
    return handleApiError(err);
  }
}
