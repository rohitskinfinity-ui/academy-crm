import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import { patchEnrollmentTreatment } from "@/lib/services/admin/enrollmentService";
import { patchEnrollmentTreatmentSchema } from "@/lib/validations/admin/enrollment";

type Ctx = { params: Promise<{ id: string; treatmentId: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { treatmentId } = await context.params;
    const body = patchEnrollmentTreatmentSchema.parse(await request.json());
    const updated = await patchEnrollmentTreatment(treatmentId, body);
    if (!updated) return apiError("Enrollment treatment not found", 404);
    return apiSuccess(updated, "Enrollment treatment updated");
  } catch (err) {
    return handleApiError(err);
  }
}
