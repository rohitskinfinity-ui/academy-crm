import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createTreatment,
  listTreatments,
} from "@/lib/services/admin/treatmentService";
import {
  createTreatmentSchema,
  listTreatmentsQuerySchema,
} from "@/lib/validations/admin/treatment";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = listTreatmentsQuerySchema.parse(sp);
    return apiSuccess(await listTreatments(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const body = createTreatmentSchema.parse(await request.json());
    const created = await createTreatment(body);
    return apiSuccess(created, "Treatment created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
