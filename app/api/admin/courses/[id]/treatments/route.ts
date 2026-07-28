import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { setCourseTreatments } from "@/lib/services/admin/courseService";
import { setCourseTreatmentsSchema } from "@/lib/validations/admin/course";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = setCourseTreatmentsSchema.parse(await request.json());
    const treatments = await setCourseTreatments(id, body.treatments);
    return apiSuccess(treatments, "Course treatments updated");
  } catch (err) {
    return handleApiError(err);
  }
}
