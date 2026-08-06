import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createWorkshop,
  listWorkshops,
} from "@/lib/services/admin/workshopService";
import {
  createWorkshopSchema,
  listWorkshopsQuerySchema,
} from "@/lib/validations/admin/workshop";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const query = listWorkshopsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    return apiSuccess(await listWorkshops(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const body = createWorkshopSchema.parse(await request.json());
    return apiSuccess(await createWorkshop(body), "Workshop created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
