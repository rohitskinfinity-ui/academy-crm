import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  assignInquiry,
  ENQUIRY_STATUSES,
  getInquiryDetail,
  updateInquiryStatus,
} from "@/lib/services/admin/inquiryService";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    status: z.enum(ENQUIRY_STATUSES).optional(),
    assigned_to: z.string().uuid().nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.assigned_to !== undefined, {
    message: "Provide status and/or assigned_to",
  });

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const inquiry = await getInquiryDetail(id);
    if (!inquiry) return apiError("Enquiry not found", 404);
    return apiSuccess(inquiry, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireAdmin(request);
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());

    let updated = null;
    if (body.status !== undefined) {
      updated = await updateInquiryStatus(id, body.status, user.id);
    }
    if (body.assigned_to !== undefined) {
      updated = await assignInquiry(id, body.assigned_to, user.id);
    }
    if (!updated) return apiError("Enquiry not found", 404);
    return apiSuccess(updated, "Enquiry updated");
  } catch (err) {
    return handleApiError(err);
  }
}
