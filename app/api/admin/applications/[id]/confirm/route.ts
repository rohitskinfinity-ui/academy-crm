import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { convertApplicationToEnrollment } from "@/lib/services/admin/applicationService";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const confirmSchema = z.object({
  agreed_price: z.number().nonnegative().nullable().optional(),
  batch_id: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = confirmSchema.parse(
      (await request.json().catch(() => ({}))) ?? {},
    );
    const enrollment = await convertApplicationToEnrollment(id, {
      agreed_price: body.agreed_price ?? undefined,
      batch_id: body.batch_id ?? undefined,
    });
    return apiSuccess(enrollment, "Enrollment confirmed");
  } catch (err) {
    return handleApiError(err);
  }
}
