import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getContactInquiryById,
  updateInquiryStatus,
} from "@/lib/services/admin/inquiryService";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const reviewSchema = z.object({
  status: z.enum(["new", "contacted", "closed", "spam"]),
});

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const inquiry = await getContactInquiryById(id);
    if (!inquiry) return apiError("Enquiry not found", 404);
    return apiSuccess(inquiry, "OK");
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
    const updated = await updateInquiryStatus(id, body.status);
    if (!updated) return apiError("Enquiry not found", 404);
    return apiSuccess(updated, `Enquiry marked ${body.status}`);
  } catch (err) {
    return handleApiError(err);
  }
}
