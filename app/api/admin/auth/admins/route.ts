import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import { createAdmin, listAdmins } from "@/lib/services/admin/authService";
import { createAdminSchema } from "@/lib/validations/admin/auth";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const admins = await listAdmins();
    return apiSuccess(admins, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const { user } = await requireAdmin(request);
    if (user.role !== "admin") {
      return apiError("Only admins can create admin/staff accounts", 403);
    }
    const body = createAdminSchema.parse(await request.json());
    const created = await createAdmin(body);
    return apiSuccess(created, "Admin created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
