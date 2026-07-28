import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getAdminById } from "@/lib/services/admin/authService";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const { user } = await requireAdmin(request);
    const admin = await getAdminById(user.id);
    return apiSuccess(admin, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
