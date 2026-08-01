import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getUserDetail,
  patchUser,
  softDeleteUser,
} from "@/lib/services/admin/userService";
import { patchUserSchema } from "@/lib/validations/admin/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const user = await getUserDetail(id);
    if (!user) return apiError("User not found", 404);
    return apiSuccess(user, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = patchUserSchema.parse(await request.json());
    const user = await patchUser(id, body);
    if (!user) return apiError("User not found", 404);
    return apiSuccess(user, "User updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const deleted = await softDeleteUser(id);
    if (!deleted) return apiError("User not found", 404);
    return apiSuccess(deleted, "User deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
