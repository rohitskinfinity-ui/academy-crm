import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createEnrollment,
  listEnrollments,
} from "@/lib/services/admin/enrollmentService";
import {
  createEnrollmentSchema,
  listEnrollmentsQuerySchema,
} from "@/lib/validations/admin/enrollment";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = listEnrollmentsQuerySchema.parse(sp);
    return apiSuccess(await listEnrollments(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const body = createEnrollmentSchema.parse(await request.json());
    const created = await createEnrollment(body);
    return apiSuccess(created, "Enrollment created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
