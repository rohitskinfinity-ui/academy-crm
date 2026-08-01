import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { subscribeNewsletter } from "@/lib/services/public/contactService";
import { submitNewsletterSchema } from "@/lib/validations/public/contact";

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const body = submitNewsletterSchema.parse(await request.json());
    const created = await subscribeNewsletter(body.email);
    return apiSuccess(created, "Subscribed", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
