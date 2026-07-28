import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import { setEnrollmentTreatments } from "@/lib/services/admin/enrollmentService";
import { setEnrollmentTreatmentsSchema } from "@/lib/validations/admin/enrollment";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = setEnrollmentTreatmentsSchema.parse(await request.json());
    const updated = await setEnrollmentTreatments(
      id,
      body.treatments,
      body.agreed_price,
    );
    if (!updated) return apiError("Enrollment not found", 404);
    return apiSuccess(updated, "Enrollment treatments updated");
  } catch (err) {
    return handleApiError(err);
  }
}
