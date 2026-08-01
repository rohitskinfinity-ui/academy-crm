import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { submitContact } from "@/lib/services/public/contactService";
import { submitContactSchema } from "@/lib/validations/public/contact";

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const body = submitContactSchema.parse(await request.json());
    const created = await submitContact(body);
    return apiSuccess(created, "Inquiry submitted", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
