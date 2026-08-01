import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { submitCallback } from "@/lib/services/public/contactService";
import { submitCallbackSchema } from "@/lib/validations/public/contact";

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const body = submitCallbackSchema.parse(await request.json());
    const created = await submitCallback(body);
    return apiSuccess(created, "Callback requested", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
