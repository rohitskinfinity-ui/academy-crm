import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createTestimonial,
  listTestimonials,
} from "@/lib/services/admin/testimonialService";
import {
  createTestimonialSchema,
  listTestimonialsQuerySchema,
} from "@/lib/validations/admin/testimonial";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const query = listTestimonialsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    return apiSuccess(await listTestimonials(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const body = createTestimonialSchema.parse(await request.json());
    return apiSuccess(await createTestimonial(body), "Testimonial created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
