import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { convertInquiryToEnrollment } from "@/lib/services/admin/inquiryService";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  payment_type: z.enum(["advance", "full"]),
  course_id: z.string().uuid().nullable().optional(),
  workshop_id: z.string().uuid().nullable().optional(),
  agreed_price: z.number().nonnegative().nullable().optional(),
  amount_paid: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).optional(),
  referral_code: z.string().max(40).nullable().optional(),
  apply_referral_credit: z.boolean().optional(),
});

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireAdmin(request);
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const result = await convertInquiryToEnrollment(id, user.id, body);
    return apiSuccess(result, "Enquiry converted to enrollment");
  } catch (err) {
    return handleApiError(err);
  }
}
