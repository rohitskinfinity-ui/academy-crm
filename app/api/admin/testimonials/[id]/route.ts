import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  deleteTestimonial,
  getTestimonialById,
  updateTestimonial,
} from "@/lib/services/admin/testimonialService";
import { updateTestimonialSchema } from "@/lib/validations/admin/testimonial";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(_request);
    const { id } = await context.params;
    const row = await getTestimonialById(id);
    if (!row) return apiError("Testimonial not found", 404);
    return apiSuccess(row, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = updateTestimonialSchema.parse(await request.json());
    const updated = await updateTestimonial(id, body);
    if (!updated) return apiError("Testimonial not found", 404);
    return apiSuccess(updated, "Testimonial updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const deleted = await deleteTestimonial(id);
    if (!deleted) return apiError("Testimonial not found", 404);
    return apiSuccess(deleted, "Testimonial deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
