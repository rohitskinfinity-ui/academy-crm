import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getStudentFinalQuiz,
  submitStudentFinalQuiz,
} from "@/lib/services/student/finalQuizService";
import { finalQuizSubmitSchema } from "@/lib/validations/student/lms";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { id } = await context.params;
    const data = await getStudentFinalQuiz(user.id, id);
    return apiSuccess(data, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { id } = await context.params;
    const body = finalQuizSubmitSchema.parse(await request.json());
    const data = await submitStudentFinalQuiz(user.id, id, body.answers);
    return apiSuccess(
      data,
      data.passed ? "Certificate quiz passed" : "Quiz submitted",
    );
  } catch (err) {
    return handleApiError(err);
  }
}
