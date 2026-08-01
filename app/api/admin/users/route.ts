import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import { createUser, listUsers } from "@/lib/services/admin/userService";
import { createUserSchema, listUsersQuerySchema } from "@/lib/validations/admin/auth";

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

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const { user } = await requireAdmin(request);
    const body = createUserSchema.parse(await request.json());
    if (
      (body.role === "admin" || body.role === "staff") &&
      user.role !== "admin"
    ) {
      return apiError("Only admins can create admin or staff accounts", 403);
    }
    const created = await createUser(body);
    return apiSuccess(created, "User created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
