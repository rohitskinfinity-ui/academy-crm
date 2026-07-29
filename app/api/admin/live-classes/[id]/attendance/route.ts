import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  listEventAttendance,
  markAttendance,
  removeAttendance,
} from "@/lib/services/admin/attendanceService";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const markSchema = z.object({
  user_id: z.string().uuid(),
  checked_in_at: z.string().datetime().optional(),
});

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const items = await listEventAttendance(id);
    return apiSuccess({ items }, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = markSchema.parse(await request.json());
    const row = await markAttendance({
      event_id: id,
      user_id: body.user_id,
      checked_in_at: body.checked_in_at,
    });
    if (!row) return apiError("Failed to mark attendance", 500);
    return apiSuccess(row, "Attendance marked", 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const userId = request.nextUrl.searchParams.get("user_id");
    if (!userId) return apiError("user_id query param required", 400);
    const removed = await removeAttendance(id, userId);
    if (!removed) return apiError("Attendance record not found", 404);
    return apiSuccess(removed, "Attendance removed");
  } catch (err) {
    return handleApiError(err);
  }
}
