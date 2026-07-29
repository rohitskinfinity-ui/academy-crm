import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  convertApplicationToEnrollment,
  getApplicationById,
  reviewApplication,
} from "@/lib/services/admin/applicationService";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected", "under_review"]),
});

const convertSchema = z.object({
  agreed_price: z.number().nonnegative().optional(),
  batch_id: z.string().uuid().optional(),
});

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const app = await getApplicationById(id);
    if (!app) return apiError("Application not found", 404);
    return apiSuccess(app, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = reviewSchema.parse(await request.json());
    const updated = await reviewApplication(id, body);
    if (!updated) return apiError("Application not found", 404);
    return apiSuccess(updated, `Application ${body.status}`);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = convertSchema.parse(await request.json());
    const enrollment = await convertApplicationToEnrollment(id, body);
    return apiSuccess(enrollment, "Application converted to enrollment", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
