import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createCourseMedia,
  listCourseMedia,
  reorderCourseMedia,
} from "@/lib/services/admin/courseMediaService";
import {
  createCourseMediaSchema,
  reorderCourseMediaSchema,
} from "@/lib/validations/admin/courseMedia";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const items = await listCourseMedia(id);
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
    const body = await request.json();

    if (Array.isArray(body?.ordered_ids)) {
      const parsed = reorderCourseMediaSchema.parse(body);
      const items = await reorderCourseMedia(id, parsed.ordered_ids);
      return apiSuccess({ items }, "Gallery order updated");
    }

    const input = createCourseMediaSchema.parse(body);
    const item = await createCourseMedia(id, input);
    return apiSuccess(item, "Gallery item added", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
