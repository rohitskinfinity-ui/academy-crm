import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createBooklet,
  listBooklets,
} from "@/lib/services/admin/treatmentService";
import { createBookletSchema } from "@/lib/validations/admin/treatment";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    return apiSuccess(await listBooklets(id), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = createBookletSchema.parse(await request.json());
    return apiSuccess(await createBooklet(id, body), "Booklet created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
