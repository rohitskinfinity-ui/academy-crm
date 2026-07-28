import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getEnrollmentById,
  patchEnrollment,
  softDeleteEnrollment,
} from "@/lib/services/admin/enrollmentService";
import { patchEnrollmentSchema } from "@/lib/validations/admin/enrollment";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const enrollment = await getEnrollmentById(id);
    if (!enrollment) return apiError("Enrollment not found", 404);
    return apiSuccess(enrollment, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = patchEnrollmentSchema.parse(await request.json());
    const updated = await patchEnrollment(id, body);
    if (!updated) return apiError("Enrollment not found", 404);
    return apiSuccess(updated, "Enrollment updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const deleted = await softDeleteEnrollment(id);
    if (!deleted) return apiError("Enrollment not found", 404);
    return apiSuccess(deleted, "Enrollment deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
