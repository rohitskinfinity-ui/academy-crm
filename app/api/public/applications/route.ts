import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { submitApplication } from "@/lib/services/public/applicationSubmitService";
import { submitApplicationSchema } from "@/lib/validations/public/application";

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const body = submitApplicationSchema.parse(await request.json());
    const created = await submitApplication(body);
    return apiSuccess(created, "Enrollment created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
