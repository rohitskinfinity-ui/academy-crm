import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listUsers } from "@/lib/services/admin/userService";
import { listUsersQuerySchema } from "@/lib/validations/admin/auth";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = listUsersQuerySchema.parse(sp);
    const result = await listUsers(query);
    return apiSuccess(result, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
